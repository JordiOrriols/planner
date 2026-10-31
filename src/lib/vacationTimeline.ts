import { addDays, differenceInCalendarDays, format } from "date-fns";
import type { LinkedTeam, PlannerMember, Vacation } from "@/types/planner";
import { parseDate } from "./planning";

export function vacationTimelineRows(
  members: PlannerMember[],
  teams: LinkedTeam[],
  vacations: Vacation[],
  start: Date,
  days: number
) {
  const end = format(addDays(start, days - 1), "yyyy-MM-dd");
  const first = format(start, "yyyy-MM-dd");
  const byMember = new Map<string, string[]>();
  for (const vacation of vacations) {
    if (vacation.is_working || vacation.date < first || vacation.date > end) continue;
    const dates = byMember.get(vacation.member_id) ?? [];
    dates.push(vacation.date);
    byMember.set(vacation.member_id, dates);
  }
  const teamOrder = new Map(teams.map((team, index) => [team.id, index]));
  return [...members]
    .sort(
      (a, b) =>
        (teamOrder.get(a.team_id) ?? teams.length) - (teamOrder.get(b.team_id) ?? teams.length) ||
        a.team_id.localeCompare(b.team_id) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
    )
    .map((member) => {
      const runs: { start: Date; end: Date; offset: number; length: number }[] = [];
      for (const value of [...new Set(byMember.get(member.id) ?? [])].sort()) {
        const date = parseDate(value);
        const previous = runs.at(-1);
        if (previous && differenceInCalendarDays(date, previous.end) === 1) {
          previous.end = date;
          previous.length++;
        } else {
          runs.push({
            start: date,
            end: date,
            offset: differenceInCalendarDays(date, start),
            length: 1,
          });
        }
      }
      return { member, runs };
    });
}
