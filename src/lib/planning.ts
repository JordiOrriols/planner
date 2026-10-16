import i18n from "@/i18n";
import { addDays, addWeeks, format, isValid, parseISO, startOfWeek } from "date-fns";
import { hasHolidayCalendar, isHoliday } from "./barcelonaHolidays";
import {
  ROLES,
  type Role,
  type Project,
  type ProjectInput,
  type PlannerMember,
  type Availability,
} from "@/types/planner";

export { ROLES };
export const ROLE_LABELS: Record<Role, string> = {
  get backend() {
    return i18n.t("planningRoles.backend");
  },
  get frontend() {
    return i18n.t("planningRoles.frontend");
  },
  get design() {
    return i18n.t("planningRoles.design");
  },
  get qa() {
    return i18n.t("planningRoles.qa");
  },
};
export const roleDevs = (p: ProjectInput, role: Role) => p[`${role}_devs`];
export const roleWeeks = (p: ProjectInput, role: Role) => p[`${role}_weeks`];
export const peakDevs = (p: ProjectInput) =>
  ROLES.reduce((sum, role) => sum + roleDevs(p, role), 0);
export const durationWeeks = (p: ProjectInput) =>
  roleWeeks(p, "design") +
  Math.max(roleWeeks(p, "backend"), roleWeeks(p, "frontend")) +
  roleWeeks(p, "qa");
export const totalDevWeeks = (p: ProjectInput) =>
  ROLES.reduce((sum, role) => sum + roleDevs(p, role) * roleWeeks(p, role), 0);
export const getMonday = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });
export const fmtDate = (date: Date) =>
  new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
export const fmtShortDate = (date: Date) =>
  new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: "short", day: "numeric" }).format(date);
export const fmtMonth = (date: Date, compact = false) =>
  new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    month: compact ? "short" : "long",
    year: compact ? "2-digit" : "numeric",
  }).format(date);

export function validateProject(input: ProjectInput) {
  if (!input.name.trim()) throw new Error(i18n.t("planning.validation.featureNameRequired"));
  for (const role of ROLES) {
    const devs = roleDevs(input, role),
      weeks = roleWeeks(input, role);
    if (
      !Number.isInteger(devs) ||
      !Number.isInteger(weeks) ||
      devs < 0 ||
      weeks < 0 ||
      devs > 100 ||
      weeks > 104
    )
      throw new Error(i18n.t("planning.validation.estimateBounds", { role: ROLE_LABELS[role] }));
    if ((devs === 0) !== (weeks === 0))
      throw new Error(i18n.t("planning.validation.rolePairRequired", { role: ROLE_LABELS[role] }));
  }
}

export function parseDate(value: string): Date {
  const date = parseISO(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(date) || format(date, "yyyy-MM-dd") !== value)
    throw new Error(i18n.t("planning.validation.invalidDate"));
  return date;
}

export function isWorking(
  member: Pick<PlannerMember, "id">,
  date: Date,
  availability: Availability[]
) {
  const key = format(date, "yyyy-MM-dd");
  const override = availability.find((item) => item.member_id === member.id && item.date === key);
  if (!hasHolidayCalendar(key))
    throw new Error(
      i18n.t("planning.validation.unverifiedWorkingYear", { year: date.getFullYear() })
    );
  return override?.is_working ?? (date.getDay() !== 0 && date.getDay() !== 6 && !isHoliday(key));
}

export interface CapacityWeek {
  weekStart: Date;
  capacity: number;
  allocated: number;
}
export interface ScheduledProject {
  project: Project;
  startIdx: number | null;
  endIdx: number | null;
  start: Date | null;
  end: Date | null;
  reason: string | null;
  complete: boolean;
  roles: ScheduledRole[];
}
export interface ScheduledRole {
  role: Role;
  start: Date | null;
  end: Date | null;
  complete: boolean;
  allocations: {
    weekIndex: number;
    personDays: number;
    start: Date;
    end: Date;
    days: { date: Date; personDays: number }[];
  }[];
}
export function squadVelocity(
  members: PlannerMember[],
  availability: Availability[],
  startDate: Date,
  numWeeks = 16
): CapacityWeek[] {
  const start = getMonday(startDate);
  const weeks: CapacityWeek[] = [];
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = addWeeks(start, i);
    const verifiedDays = Array.from({ length: 7 }, (_, day) => addDays(weekStart, day)).filter(
      (date) => hasHolidayCalendar(format(date, "yyyy-MM-dd"))
    );
    if (!verifiedDays.length) break;
    const capacity = verifiedDays.reduce(
      (sum, date) =>
        sum +
        members.filter((member) => member.role !== null && isWorking(member, date, availability))
          .length /
          5,
      0
    );
    weeks.push({ weekStart, capacity, allocated: 0 });
  }
  return weeks;
}

// Daily person-days prevent partial-week leave and role capacity from being rounded away.
export function computeSchedule(
  projects: Project[],
  members: PlannerMember[],
  availability: Availability[],
  startDate: Date,
  horizon = 52
) {
  if (!isValid(startDate) || !hasHolidayCalendar(format(startDate, "yyyy-MM-dd")))
    throw new Error(i18n.t("planning.validation.unverifiedStart"));
  const weeks = squadVelocity(members, availability, startDate, horizon);
  const sorted = [...projects]
    .filter((p) => p.in_backlog)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const schedule: ScheduledProject[] = sorted.map((project) => {
    validateProject(project);
    const missing = ROLES.filter(
      (role) => roleDevs(project, role) > 0 && !members.some((member) => member.role === role)
    );
    return {
      project,
      startIdx: null,
      endIdx: null,
      start: null,
      end: null,
      complete: false,
      roles: ROLES.filter((role) => roleDevs(project, role) > 0).map((role) => ({
        role,
        start: null,
        end: null,
        complete: false,
        allocations: [],
      })),
      reason:
        totalDevWeeks(project) === 0
          ? i18n.t("planning.unscheduled.noEstimates")
          : missing.length
            ? i18n.t("planning.unscheduled.noRoleCapacity", {
                roles: missing.map((role) => ROLE_LABELS[role]).join(", "),
              })
            : null,
    };
  });
  const remaining = new Map(
    sorted.map((project) => [
      project.id,
      Object.fromEntries(
        ROLES.map((role) => [role, roleDevs(project, role) * roleWeeks(project, role) * 5])
      ) as Record<Role, number>,
    ])
  );
  weeks.forEach((week, weekIndex) => {
    for (let day = 0; day < 7; day++) {
      const date = addDays(week.weekStart, day);
      if (date < startDate || !hasHolidayCalendar(format(date, "yyyy-MM-dd"))) continue;
      const free = Object.fromEntries(
        ROLES.map((role) => [
          role,
          members.filter((member) => member.role === role && isWorking(member, date, availability))
            .length,
        ])
      ) as Record<Role, number>;
      for (const item of schedule) {
        if (item.reason || item.complete) continue;
        const effort = remaining.get(item.project.id)!;
        // Snapshot dependencies before today's work so successive phases start on later days.
        const designDone = effort.design === 0;
        const developmentDone = designDone && effort.backend === 0 && effort.frontend === 0;
        for (const roleSchedule of item.roles) {
          const { role } = roleSchedule;
          if (role !== "design" && !designDone) continue;
          if (role === "qa" && !developmentDone) continue;
          const allocated = Math.min(free[role], roleDevs(item.project, role), effort[role]);
          if (allocated <= 0) continue;
          effort[role] = Math.max(0, effort[role] - allocated);
          free[role] -= allocated;
          week.allocated += allocated / 5;
          item.start ??= date;
          item.startIdx ??= weekIndex;
          item.endIdx = weekIndex;
          roleSchedule.start ??= date;
          let allocation = roleSchedule.allocations.at(-1);
          if (!allocation || allocation.weekIndex !== weekIndex) {
            allocation = { weekIndex, personDays: 0, start: date, end: date, days: [] };
            roleSchedule.allocations.push(allocation);
          }
          allocation.personDays += allocated;
          allocation.end = date;
          allocation.days.push({ date, personDays: allocated });
          if (effort[role] === 0) {
            roleSchedule.complete = true;
            roleSchedule.end = date;
          }
        }
        if (ROLES.every((role) => effort[role] < 1e-8)) {
          item.complete = true;
          item.end = date;
        }
      }
    }
  });
  for (const item of schedule) {
    if (!item.complete && !item.reason)
      item.reason = i18n.t("planning.unscheduled.horizonExceeded");
  }
  const finalWeek = weeks.at(-1);
  return {
    weeks,
    schedule,
    calendarLimited:
      weeks.length < horizon ||
      (!!finalWeek && !hasHolidayCalendar(format(addDays(finalWeek.weekStart, 6), "yyyy-MM-dd"))),
  };
}
