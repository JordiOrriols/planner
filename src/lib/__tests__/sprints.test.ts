import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import {
  calibratedRate,
  forecastSprints,
  sprintCapacity,
  validateSprintSettings,
} from "@/lib/sprints";
import { parseDate } from "@/lib/planning";
import type { PlannerMember } from "@/types/planner";

const members: PlannerMember[] = [
  {
    id: "back",
    name: "Ada",
    team_id: "one",
    role: "backend",
    can_edit: true,
    vacation_token: null,
  },
  {
    id: "front",
    name: "Grace",
    team_id: "one",
    role: "frontend",
    can_edit: true,
    vacation_token: null,
  },
  { id: "other", name: "Other", team_id: "one", role: null, can_edit: true, vacation_token: null },
];
describe("Two-week sprint forecasts", () => {
  it("uses exact 14-day windows, including non-Monday starts", () => {
    const result = forecastSprints("2026-02-04", parseDate("2026-03-05"), 3);
    expect(
      result.map(({ start, end }) => [format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")])
    ).toEqual([
      ["2026-03-04", "2026-03-17"],
      ["2026-03-18", "2026-03-31"],
      ["2026-04-01", "2026-04-14"],
    ]);
    expect(
      format(forecastSprints("2026-02-04", parseDate("2026-01-01"))[0]!.start, "yyyy-MM-dd")
    ).toBe("2026-02-04");
    expect(forecastSprints("2027-12-13", parseDate("2027-12-13"))).toHaveLength(1);
    expect(forecastSprints("2026-02-02", parseDate("2028-02-02"))).toEqual([]);
  });

  it("counts vacations, holidays and working overrides but not unassigned members", () => {
    expect(sprintCapacity(members, [], parseDate("2026-02-02"))).toBe(4);
    const availability = [
      { member_id: "back", date: "2026-02-02", is_working: false },
      { member_id: "front", date: "2026-02-07", is_working: true },
      { member_id: "back", date: "2026-02-03", is_working: false },
    ];
    expect(sprintCapacity(members, availability, parseDate("2026-02-02"))).toBe(3.8);
    expect(sprintCapacity(members, [], parseDate("2026-12-21"))).toBe(3.2);
  });

  it("uses total points / total person-weeks, not an unweighted mean", () => {
    const availability = ["02", "03", "04", "05", "06", "09", "10", "11", "12", "13"].map(
      (day) => ({ member_id: "back", date: `2026-02-${day}`, is_working: false })
    );
    const rate = calibratedRate(
      "2026-02-02",
      [
        { start_date: "2026-02-02", story_points: 50 },
        { start_date: "2026-02-16", story_points: 30 },
      ],
      members,
      availability
    );
    expect(rate).toBeCloseTo(80 / 6);
    expect(rate! * sprintCapacity(members, [], parseDate("2026-03-02"))).toBeCloseTo(53.3333);
    expect(calibratedRate("2026-02-02", [], members, [])).toBeNull();
    expect(
      calibratedRate("2026-02-02", [{ start_date: "2026-02-02", story_points: 0 }], members, [])
    ).toBe(0);
  });

  it("rejects zero capacity, invalid points, duplicate or misaligned dates and unverified periods", () => {
    expect(() =>
      calibratedRate("2026-02-02", [{ start_date: "2026-02-02", story_points: 50 }], [], [])
    ).toThrow();
    for (const history of [
      [{ start_date: "2026-02-03", story_points: 5 }],
      [{ start_date: "2026-02-02", story_points: Infinity }],
      [{ start_date: "2026-02-02", story_points: -1 }],
      [{ start_date: "2026-02-30", story_points: 1 }],
      [{ start_date: "2027-12-27", story_points: 1 }],
      [
        { start_date: "2026-02-02", story_points: 1 },
        { start_date: "2026-02-02", story_points: 2 },
      ],
    ])
      expect(() => validateSprintSettings("2026-02-02", history)).toThrow();
  });
});
