import { describe, expect, it } from "vitest";
import { format, parseISO } from "date-fns";
import { computeSchedule, squadVelocity, validateProject, parseDate } from "../planning";
import { BARCELONA_HOLIDAYS, isHoliday } from "../barcelonaHolidays";
import {
  EMPTY_PROJECT,
  type Project,
  type PlannerMember,
  type Availability,
} from "@/types/planner";

const member: PlannerMember = {
  id: "backend",
  workspace_id: "workspace",
  name: "Ada",
  email: "ada@example.com",
  user_id: "ada",
  role: "backend",
};
const project = (id = "one", weeks = 1): Project => ({
  ...EMPTY_PROJECT,
  id,
  workspace_id: "workspace",
  name: id,
  in_backlog: true,
  priority: 0,
  backend_devs: 1,
  backend_weeks: weeks,
});
const date = (value: string) => parseISO(value);
const end = (result: ReturnType<typeof computeSchedule>, index = 0) =>
  format(result.schedule[index]!.end!, "yyyy-MM-dd");

describe("daily role-based capacity", () => {
  it("schedules one person for eight weeks as forty working days", () => {
    const result = computeSchedule([project("one", 8)], [member], [], date("2026-02-02"));
    expect(end(result)).toBe("2026-03-27");
  });
  it("counts partial-week vacations once, without dropping the entire person/week", () => {
    const availability: Availability[] = ["2026-02-03", "2026-02-04"].map((date) => ({
      member_id: member.id,
      date,
      is_working: false,
    }));
    expect(squadVelocity([member], availability, date("2026-02-02"), 1)[0]?.capacity).toBeCloseTo(
      0.6
    );
    expect(end(computeSchedule([project()], [member], availability, date("2026-02-02")))).toBe(
      "2026-02-10"
    );
  });
  it("does not subtract weekend holidays from weekday capacity", () => {
    expect(squadVelocity([member], [], date("2026-08-10"), 1)[0]?.capacity).toBe(1);
  });
  it("includes Barcelona's local Whit Monday and verified 2027 dates", () => {
    expect(isHoliday("2026-05-25")).toBe(true);
    expect(isHoliday("2027-05-17")).toBe(true);
    expect(BARCELONA_HOLIDAYS.filter((item) => item.date.startsWith("2026"))).toHaveLength(14);
    expect(BARCELONA_HOLIDAYS.filter((item) => item.date.startsWith("2027"))).toHaveLength(14);
  });
  it("supports working on a holiday and excludes earlier days than the plan start", () => {
    const override = [{ member_id: member.id, date: "2026-05-25", is_working: true }];
    expect(end(computeSchedule([project()], [member], override, date("2026-05-25")))).toBe(
      "2026-05-29"
    );
    expect(end(computeSchedule([project()], [member], [], date("2026-02-04")))).toBe("2026-02-10");
  });
  it("allows parallel projects when role capacity is free and respects priority when it is not", () => {
    const second = { ...project("two"), priority: 1 };
    const single = computeSchedule([second, project()], [member], [], date("2026-02-02"));
    expect(end(single, 0)).toBe("2026-02-06");
    expect(end(single, 1)).toBe("2026-02-13");
    const parallel = computeSchedule(
      [project(), second],
      [member, { ...member, id: "other" }],
      [],
      date("2026-02-02")
    );
    expect(end(parallel, 1)).toBe("2026-02-06");
    expect(parallel.weeks[0]?.allocated).toBeCloseTo(2);
  });
  it("never uses backend people to satisfy frontend effort", () => {
    const frontend = {
      ...project(),
      backend_devs: 0,
      backend_weeks: 0,
      frontend_devs: 1,
      frontend_weeks: 1,
    };
    const result = computeSchedule([frontend], [member], [], date("2026-02-02"));
    expect(result.schedule[0]?.reason).toBe("No Frontend capacity");
    expect(result.weeks[0]?.allocated).toBe(0);
  });
  it("allocates each concurrent role independently without exceeding available capacity", () => {
    const mixed = { ...project(), frontend_devs: 1, frontend_weeks: 2 };
    const result = computeSchedule(
      [mixed],
      [member, { ...member, id: "fe", role: "frontend" }],
      [],
      date("2026-02-02")
    );
    expect(end(result)).toBe("2026-02-13");
    expect(result.weeks[0]?.allocated).toBeCloseTo(2);
    expect(result.weeks[1]?.allocated).toBeCloseTo(1);
    for (const week of result.weeks)
      expect(week.allocated).toBeLessThanOrEqual(week.capacity + 1e-8);
  });
  it("slows a two-person estimate down if only one person is available", () => {
    expect(
      end(computeSchedule([{ ...project(), backend_devs: 2 }], [member], [], date("2026-02-02")))
    ).toBe("2026-02-13");
  });
  it("does not schedule unselected projects or pretend incomplete projects are finished", () => {
    expect(
      computeSchedule([{ ...project(), in_backlog: false }], [member], [], date("2026-02-02"))
        .schedule
    ).toHaveLength(0);
    const result = computeSchedule([project("long", 100)], [member], [], date("2027-12-20"));
    expect(result.calendarLimited).toBe(true);
    expect(result.schedule[0]?.end).toBeNull();
    expect(result.schedule[0]?.complete).toBe(false);
    expect(result.schedule[0]?.reason).toMatch(/Not completed/);
  });
  it("fails explicitly on invalid estimates and unknown calendar years", () => {
    expect(() => validateProject({ ...project(), backend_weeks: 0 })).toThrow(/both/);
    expect(() => validateProject({ ...project(), backend_devs: NaN })).toThrow(/estimates/);
    expect(() => parseDate("2026-02-30")).toThrow(/valid/);
    expect(() => computeSchedule([project()], [member], [], date("2028-01-03"))).toThrow(
      /verified/
    );
  });
});
