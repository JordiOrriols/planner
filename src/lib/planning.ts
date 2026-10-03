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
  backend: "Backend",
  frontend: "Frontend",
  design: "Design",
  qa: "QA",
};
export const ROLE_COLORS: Record<Role, string> = {
  backend: "bg-indigo-500",
  frontend: "bg-sky-500",
  design: "bg-amber-500",
  qa: "bg-emerald-500",
};
export const roleDevs = (p: ProjectInput, role: Role) => p[`${role}_devs`];
export const roleWeeks = (p: ProjectInput, role: Role) => p[`${role}_weeks`];
export const peakDevs = (p: ProjectInput) =>
  ROLES.reduce((sum, role) => sum + roleDevs(p, role), 0);
export const durationWeeks = (p: ProjectInput) =>
  Math.max(0, ...ROLES.map((role) => roleWeeks(p, role)));
export const totalDevWeeks = (p: ProjectInput) =>
  ROLES.reduce((sum, role) => sum + roleDevs(p, role) * roleWeeks(p, role), 0);
export const getMonday = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });
export const fmtDate = (date: Date) => format(date, "MMM d, yyyy");

export function validateProject(input: ProjectInput) {
  if (!input.name.trim()) throw new Error("A project name is required.");
  for (const role of ROLES) {
    const devs = roleDevs(input, role),
      weeks = roleWeeks(input, role);
    if (
      !Number.isFinite(devs) ||
      !Number.isFinite(weeks) ||
      devs < 0 ||
      weeks < 0 ||
      devs > 100 ||
      weeks > 104
    )
      throw new Error(
        `${ROLE_LABELS[role]} estimates must be between 0 and 100 people / 104 weeks.`
      );
    if ((devs === 0) !== (weeks === 0))
      throw new Error(`Set both people and weeks for ${ROLE_LABELS[role]}, or leave both at zero.`);
  }
}

export function parseDate(value: string): Date {
  const date = parseISO(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(date) || format(date, "yyyy-MM-dd") !== value)
    throw new Error("Choose a valid calendar date.");
  return date;
}

export function isWorking(member: PlannerMember, date: Date, availability: Availability[]) {
  const key = format(date, "yyyy-MM-dd");
  const override = availability.find((item) => item.member_id === member.id && item.date === key);
  if (!hasHolidayCalendar(key))
    throw new Error(`Barcelona holidays are not verified for ${date.getFullYear()}.`);
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
    if (!hasHolidayCalendar(format(addDays(weekStart, 6), "yyyy-MM-dd"))) break;
    const capacity = Array.from({ length: 7 }, (_, day) => addDays(weekStart, day)).reduce(
      (sum, date) =>
        sum + members.filter((member) => isWorking(member, date, availability)).length / 5,
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
    throw new Error("Choose a start date in a verified holiday year (2026 or 2027).");
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
      reason:
        totalDevWeeks(project) === 0
          ? "No estimates set"
          : missing.length
            ? `No ${missing.map((role) => ROLE_LABELS[role]).join(", ")} capacity`
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
      if (date < startDate) continue;
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
        for (const role of ROLES) {
          const allocated = Math.min(free[role], roleDevs(item.project, role), effort[role]);
          if (allocated <= 0) continue;
          effort[role] = Math.max(0, effort[role] - allocated);
          free[role] -= allocated;
          week.allocated += allocated / 5;
          item.start ??= date;
          item.startIdx ??= weekIndex;
          item.endIdx = weekIndex;
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
      item.reason = "Not completed within the verified planning horizon";
  }
  return { weeks, schedule, calendarLimited: weeks.length < horizon };
}
