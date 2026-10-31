import { describe, expect, it } from "vitest";
import { vacationTimelineRows } from "../vacationTimeline";
import { parseDate } from "../planning";
import type { PlannerMember, Vacation } from "@/types/planner";

const members: PlannerMember[] = [
  { id: "a", name: "Anna", team_id: "product", role: null, can_edit: false, vacation_token: null },
  {
    id: "j",
    name: "Jordi",
    team_id: "platform",
    role: "backend",
    can_edit: true,
    vacation_token: null,
  },
  { id: "m", name: "Marc", team_id: "platform", role: null, can_edit: false, vacation_token: null },
];
const teams = [
  { id: "platform", name: "Platform" },
  { id: "product", name: "Product" },
];
describe("vacationTimelineRows", () => {
  it("includes roleless members and empty rows grouped by team without mutating members", () => {
    const rows = vacationTimelineRows(members, teams, [], parseDate("2026-10-01"), 31);
    expect(rows.map((row) => row.member.id)).toEqual(["j", "m", "a"]);
    expect(rows.every((row) => !row.runs.length)).toBe(true);
    expect(members[0]?.id).toBe("a");
  });
  it("merges contiguous explicit vacation dates, deduplicates, excludes working overrides and clips the window", () => {
    const vacations: Vacation[] = [
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-02",
      "2026-10-04",
      "2026-11-01",
    ].map((date) => ({ member_id: "j", date, is_working: false }));
    vacations.push({ member_id: "j", date: "2026-10-03", is_working: true });
    const rows = vacationTimelineRows(members, teams, vacations, parseDate("2026-10-01"), 31);
    expect(rows[0]?.runs.map(({ offset, length }) => [offset, length])).toEqual([
      [0, 2],
      [3, 1],
    ]);
    expect(rows[1]?.runs).toEqual([]);
  });
  it("uses calendar days across DST and month/year boundaries", () => {
    const vacations = ["2026-10-24", "2026-10-25", "2026-10-26"].map((date) => ({
      member_id: "a",
      date,
      is_working: false,
    }));
    const rows = vacationTimelineRows(members, teams, vacations, parseDate("2026-10-01"), 364);
    expect(rows[2]?.runs.map(({ offset, length }) => [offset, length])).toEqual([[23, 3]]);
  });
});
