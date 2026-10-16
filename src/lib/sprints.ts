import { addDays, differenceInCalendarDays, format } from "date-fns";
import i18n from "@/i18n";
import { hasHolidayCalendar } from "@/lib/barcelonaHolidays";
import { isWorking, parseDate } from "@/lib/planning";
import type { Vacation, PlannerMember, SprintResult } from "@/types/planner";

export function sprintDays(start: Date) {
  return Array.from({ length: 14 }, (_, day) => addDays(start, day));
}

function verifySprint(start: Date) {
  if (sprintDays(start).some((date) => !hasHolidayCalendar(format(date, "yyyy-MM-dd"))))
    throw new Error(i18n.t("velocity.calibration.errors.calendar"));
}

export function validateSprintSettings(anchor: string, history: SprintResult[]) {
  const start = parseDate(anchor);
  verifySprint(start);
  const dates = new Set<string>();
  for (const result of history) {
    const date = parseDate(result.start_date);
    verifySprint(date);
    if (differenceInCalendarDays(date, start) % 14 !== 0)
      throw new Error(i18n.t("velocity.calibration.errors.alignment"));
    if (dates.has(result.start_date))
      throw new Error(i18n.t("velocity.calibration.errors.duplicate"));
    dates.add(result.start_date);
    if (!Number.isFinite(result.story_points) || result.story_points < 0)
      throw new Error(i18n.t("velocity.calibration.errors.points"));
  }
}

export function sprintCapacity(members: PlannerMember[], vacations: Vacation[], start: Date) {
  verifySprint(start);
  const assigned = members.filter((member) => member.role !== null);
  return (
    sprintDays(start).reduce(
      (sum, date) => sum + assigned.filter((member) => isWorking(member, date, vacations)).length,
      0
    ) / 5
  );
}

export function calibratedRate(
  anchor: string,
  history: SprintResult[],
  members: PlannerMember[],
  vacations: Vacation[],
  reference = new Date()
): number | null {
  validateSprintSettings(anchor, history);
  if (!history.length) return null;
  let totalCapacity = 0;
  let totalPoints = 0;
  for (const result of history) {
    if (differenceInCalendarDays(reference, parseDate(result.start_date)) < 14)
      throw new Error(i18n.t("velocity.calibration.errors.unfinished"));
    const capacity = sprintCapacity(members, vacations, parseDate(result.start_date));
    if (capacity === 0) throw new Error(i18n.t("velocity.calibration.errors.noCapacity"));
    totalCapacity += capacity;
    totalPoints += result.story_points;
  }
  return totalPoints / totalCapacity;
}

export function forecastSprints(anchor: string, reference: Date, count = 8) {
  const start = parseDate(anchor);
  verifySprint(start);
  const offset = Math.max(0, Math.floor(differenceInCalendarDays(reference, start) / 14));
  const sprints: { start: Date; end: Date }[] = [];
  for (let index = 0; index < count; index++) {
    const date = addDays(start, (offset + index) * 14);
    const end = addDays(date, 13);
    if (!hasHolidayCalendar(format(end, "yyyy-MM-dd"))) break;
    sprints.push({ start: date, end });
  }
  return sprints;
}
