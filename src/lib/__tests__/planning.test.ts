import { describe, expect, it } from "vitest";
import { format, parseISO } from "date-fns";
import {
  computeSchedule,
  squadVelocity,
  validateFeature,
  parseDate,
  durationWeeks,
  peakDevs,
  totalDevWeeks,
} from "../planning";
import { BARCELONA_HOLIDAYS, isHoliday } from "../barcelonaHolidays";
import { EMPTY_FEATURE, type Feature, type PlannerMember, type Vacation } from "@/types/planner";

const member: PlannerMember = {
  id: "backend",
  team_id: "team",
  name: "Ada",
  can_edit: true,
  vacation_token: null,
  role: "backend",
};
const feature = (id = "one", weeks = 1): Feature => ({
  ...EMPTY_FEATURE,
  id,
  project_id: "project",
  name: id,
  in_backlog: true,
  delivered: false,
  priority: 0,
  backend_devs: 1,
  backend_weeks: weeks,
});
const date = (value: string) => parseISO(value);
const end = (result: ReturnType<typeof computeSchedule>, index = 0) =>
  format(result.schedule[index]!.end!, "yyyy-MM-dd");

const squad: PlannerMember[] = [
  member,
  { ...member, id: "backend-2" },
  { ...member, id: "frontend", role: "frontend" },
];
const exampleFeatures: Feature[] = [
  { ...feature("Back Task", 2), backend_devs: 2, priority: 0 },
  { ...feature("1 Back Task Second", 2), priority: 1 },
  { ...feature("1 Back Task", 2), priority: 2 },
  {
    ...feature("Front", 2),
    backend_devs: 0,
    backend_weeks: 0,
    frontend_devs: 1,
    frontend_weeks: 2,
    priority: 3,
  },
  {
    ...feature("Mixed Project", 2),
    backend_devs: 2,
    frontend_devs: 1,
    frontend_weeks: 2,
    priority: 4,
  },
];

describe("the two-backend / one-frontend backlog", () => {
  it("fills weeks 1–2, overlaps single-backend tasks in weeks 3–4, and separates mixed roles", () => {
    const result = computeSchedule(exampleFeatures, squad, [], date("2026-02-02"), 6);
    expect(
      result.schedule.map((item) => ({
        name: item.feature.name,
        complete: item.complete,
        start: format(item.start!, "yyyy-MM-dd"),
        end: format(item.end!, "yyyy-MM-dd"),
        roles: item.roles.map((role) => ({
          role: role.role,
          start: format(role.start!, "yyyy-MM-dd"),
          end: format(role.end!, "yyyy-MM-dd"),
          weeks: role.allocations.map((allocation) => allocation.weekIndex),
          effort: role.allocations.reduce((sum, allocation) => sum + allocation.personDays, 0),
        })),
      }))
    ).toEqual([
      {
        name: "Back Task",
        complete: true,
        start: "2026-02-02",
        end: "2026-02-27",
        roles: [
          { role: "backend", start: "2026-02-02", end: "2026-02-13", weeks: [0, 1], effort: 20 },
        ],
      },
      {
        name: "1 Back Task Second",
        complete: true,
        start: "2026-02-16",
        end: "2026-03-13",
        roles: [
          { role: "backend", start: "2026-02-16", end: "2026-02-27", weeks: [2, 3], effort: 10 },
        ],
      },
      {
        name: "1 Back Task",
        complete: true,
        start: "2026-02-16",
        end: "2026-03-13",
        roles: [
          { role: "backend", start: "2026-02-16", end: "2026-02-27", weeks: [2, 3], effort: 10 },
        ],
      },
      {
        name: "Front",
        complete: true,
        start: "2026-02-02",
        end: "2026-02-27",
        roles: [
          { role: "frontend", start: "2026-02-02", end: "2026-02-13", weeks: [0, 1], effort: 10 },
        ],
      },
      {
        name: "Mixed Project",
        complete: true,
        start: "2026-02-16",
        end: "2026-03-27",
        roles: [
          { role: "backend", start: "2026-03-02", end: "2026-03-13", weeks: [4, 5], effort: 20 },
          { role: "frontend", start: "2026-02-16", end: "2026-02-27", weeks: [2, 3], effort: 10 },
        ],
      },
    ]);
    result.weeks.forEach((week, index) => {
      expect(week.allocated).toBeCloseTo(index < 4 ? 3 : index < 6 ? 2 : 0);
      expect(week.allocated).toBeLessThanOrEqual(week.capacity + 1e-8);
    });
    for (const item of result.schedule) {
      expect(
        item.roles.flatMap((role) => role.allocations).reduce((sum, a) => sum + a.personDays / 5, 0)
      ).toBe(totalDevWeeks(item.feature));
    }
  });

  it("uses backlog priority, not input order, when the mixed project precedes Front", () => {
    const reordered = exampleFeatures.map((item) => ({
      ...item,
      priority: item.name === "Mixed Project" ? 3 : item.name === "Front" ? 4 : item.priority,
    }));
    const result = computeSchedule(reordered.reverse(), squad, [], date("2026-02-02"), 6);
    const mixed = result.schedule.find((item) => item.feature.name === "Mixed Project")!;
    const front = result.schedule.find((item) => item.feature.name === "Front")!;
    expect(format(mixed.roles.find((role) => role.role === "frontend")!.start!, "yyyy-MM-dd")).toBe(
      "2026-02-02"
    );
    expect(format(front.start!, "yyyy-MM-dd")).toBe("2026-02-16");
    expect(exampleFeatures[4]!.priority).toBe(4);
  });

  it("records partial-week vacation work without allocating effort to an idle role", () => {
    const result = computeSchedule(
      exampleFeatures,
      squad,
      [{ member_id: "frontend", date: "2026-02-03", is_working: false }],
      date("2026-02-02"),
      7
    );
    const front = result.schedule[3]!.roles[0]!;
    expect(front.allocations.map((a) => a.personDays)).toEqual([4, 5, 1]);
    const mixedFrontend = result.schedule[4]!.roles.find((role) => role.role === "frontend")!;
    expect(format(mixedFrontend.start!, "yyyy-MM-dd")).toBe("2026-02-17");
    expect(mixedFrontend.allocations.map((a) => a.personDays)).toEqual([4, 5, 1]);
    for (const week of result.weeks)
      expect(week.allocated).toBeLessThanOrEqual(week.capacity + 1e-8);
  });
});

describe("design and QA phase dependencies", () => {
  const phased = {
    ...feature("phased"),
    design_devs: 1,
    design_weeks: 1,
    frontend_devs: 1,
    frontend_weeks: 2,
    qa_devs: 1,
    qa_weeks: 1,
  };
  const fullSquad: PlannerMember[] = [
    ...squad,
    { ...member, id: "designer", role: "design" },
    { ...member, id: "qa", role: "qa" },
  ];

  it("counts the peak team from the busiest phase, not every role at once", () => {
    expect(peakDevs(phased)).toBe(2);
    expect(peakDevs({ ...phased, backend_devs: 2 })).toBe(3);
    expect(peakDevs({ ...phased, qa_devs: 4 })).toBe(4);
    expect(peakDevs({ ...phased, design_devs: 5 })).toBe(5);
  });

  it("finishes design before development and waits for both development roles before QA", () => {
    const result = computeSchedule([phased], fullSquad, [], date("2026-02-02"), 4);
    expect(durationWeeks(phased)).toBe(6);
    expect(
      result.schedule[0]!.roles.map((role) => [
        role.role,
        format(role.start!, "yyyy-MM-dd"),
        format(role.end!, "yyyy-MM-dd"),
        role.complete,
      ])
    ).toEqual([
      ["backend", "2026-02-09", "2026-02-13", true],
      ["frontend", "2026-02-09", "2026-02-20", true],
      ["design", "2026-02-02", "2026-02-06", true],
      ["qa", "2026-02-23", "2026-02-27", true],
    ]);
    expect(end(result)).toBe("2026-03-13");
  });

  it("keeps QA pending when backend is blocked even after frontend completes", () => {
    const vacations = Array.from({ length: 14 }, (_, i) => ({
      member_id: member.id,
      date: format(new Date(2026, 1, 9 + i), "yyyy-MM-dd"),
      is_working: false,
    }));
    const result = computeSchedule(
      [phased],
      fullSquad.filter((m) => m.id !== "backend-2"),
      vacations,
      date("2026-02-02"),
      4
    );
    const item = result.schedule[0]!;
    expect(item.complete).toBe(false);
    expect(item.end).toBeNull();
    expect(item.reason).toMatch(/Not completed/);
    expect(item.roles.find((role) => role.role === "qa")).toMatchObject({
      start: null,
      end: null,
      complete: false,
      allocations: [],
    });
    expect(item.roles.find((role) => role.role === "backend")!.complete).toBe(true);
  });

  it("allows design-only and QA-only projects without nonexistent dependencies", () => {
    for (const role of ["design", "qa"] as const) {
      const only = {
        ...feature(),
        backend_devs: 0,
        backend_weeks: 0,
        [`${role}_devs`]: 1,
        [`${role}_weeks`]: 1,
      };
      const result = computeSchedule([only], fullSquad, [], date("2026-02-02"), 1);
      expect(end(result)).toBe("2026-02-20");
      expect(result.schedule[0]!.roles).toHaveLength(1);
      expect(result.schedule[0]!.roles[0]!.complete).toBe(true);
    }
  });

  it("does not allocate any phase of a project that is missing a required role", () => {
    const result = computeSchedule([phased], squad, [], date("2026-02-02"), 4);
    expect(result.schedule[0]!.reason).toBe("No Design, QA capacity");
    expect(result.schedule[0]!.roles.every((role) => role.allocations.length === 0)).toBe(true);
    expect(result.weeks.every((week) => week.allocated === 0)).toBe(true);
  });
});

describe("daily role-based capacity", () => {
  it("excludes unassigned Ladders members instead of silently assuming a role", () => {
    const unassigned: PlannerMember = { ...member, role: null };
    expect(squadVelocity([unassigned], [], date("2026-02-02"), 1)[0]?.capacity).toBe(0);
    expect(
      computeSchedule([feature()], [unassigned], [], date("2026-02-02")).schedule[0]?.reason
    ).toBe("No Backend capacity");
  });
  it("schedules one person for eight weeks as forty working days", () => {
    const result = computeSchedule([feature("one", 8)], [member], [], date("2026-02-02"));
    expect(end(result)).toBe("2026-04-10");
  });
  it("counts partial-week vacations once, without dropping the entire person/week", () => {
    const vacations: Vacation[] = ["2026-02-03", "2026-02-04"].map((date) => ({
      member_id: member.id,
      date,
      is_working: false,
    }));
    expect(squadVelocity([member], vacations, date("2026-02-02"), 1)[0]?.capacity).toBeCloseTo(0.6);
    expect(end(computeSchedule([feature()], [member], vacations, date("2026-02-02")))).toBe(
      "2026-02-24"
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
    expect(end(computeSchedule([feature()], [member], override, date("2026-05-25")))).toBe(
      "2026-06-12"
    );
    expect(end(computeSchedule([feature()], [member], [], date("2026-02-04")))).toBe("2026-02-24");
  });
  it("allows parallel projects when role capacity is free and respects priority when it is not", () => {
    const second = { ...feature("two"), priority: 1 };
    const single = computeSchedule([second, feature()], [member], [], date("2026-02-02"));
    expect(end(single, 0)).toBe("2026-02-20");
    expect(end(single, 1)).toBe("2026-02-27");
    const parallel = computeSchedule(
      [feature(), second],
      [member, { ...member, id: "other" }],
      [],
      date("2026-02-02")
    );
    expect(end(parallel, 1)).toBe("2026-02-20");
    expect(parallel.weeks[0]?.allocated).toBeCloseTo(2);
  });
  it("never uses backend people to satisfy frontend effort", () => {
    const frontend = {
      ...feature(),
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
    const mixed = { ...feature(), frontend_devs: 1, frontend_weeks: 2 };
    const result = computeSchedule(
      [mixed],
      [member, { ...member, id: "fe", role: "frontend" }],
      [],
      date("2026-02-02")
    );
    expect(end(result)).toBe("2026-02-27");
    expect(result.weeks[0]?.allocated).toBeCloseTo(2);
    expect(result.weeks[1]?.allocated).toBeCloseTo(1);
    for (const week of result.weeks)
      expect(week.allocated).toBeLessThanOrEqual(week.capacity + 1e-8);
  });
  it("slows a two-person estimate down if only one person is available", () => {
    expect(
      end(computeSchedule([{ ...feature(), backend_devs: 2 }], [member], [], date("2026-02-02")))
    ).toBe("2026-02-27");
  });
  it("does not schedule unselected projects or pretend incomplete projects are finished", () => {
    expect(
      computeSchedule([{ ...feature(), in_backlog: false }], [member], [], date("2026-02-02"))
        .schedule
    ).toHaveLength(0);
    const result = computeSchedule([feature("long", 100)], [member], [], date("2027-12-20"));
    expect(result.calendarLimited).toBe(true);
    expect(result.schedule[0]?.end).toBeNull();
    expect(result.schedule[0]?.complete).toBe(false);
    expect(result.schedule[0]?.reason).toMatch(/Not completed/);
  });
  it("fails explicitly on invalid estimates and unknown calendar years", () => {
    expect(() => validateFeature({ ...feature(), backend_weeks: 0 })).toThrow(/both/);
    expect(() => validateFeature({ ...feature(), backend_devs: NaN })).toThrow(/estimates/);
    for (const role of ["backend", "frontend", "design", "qa"] as const) {
      expect(() =>
        validateFeature({ ...feature(), [`${role}_devs`]: 1.5, [`${role}_weeks`]: 1 })
      ).toThrow(/whole numbers/);
      expect(() =>
        validateFeature({ ...feature(), [`${role}_devs`]: 1, [`${role}_weeks`]: 1.5 })
      ).toThrow(/whole numbers/);
    }
    expect(() => parseDate("2026-02-30")).toThrow(/valid/);
    expect(() => computeSchedule([feature()], [member], [], date("2028-01-03"))).toThrow(
      /verified/
    );
  });
  it("uses verified days in partial weeks at both calendar boundaries", () => {
    const first = computeSchedule([feature()], [member], [], date("2026-01-01"));
    expect(end(first)).toBe("2026-01-23");
    const last = computeSchedule([feature()], [member], [], date("2027-12-30"));
    expect(last.weeks[0]?.allocated).toBeCloseTo(0.4);
    expect(last.schedule[0]?.end).toBeNull();
    expect(last.calendarLimited).toBe(true);
  });

  describe("calendar UAT", () => {
    it("adds fourteen days after delivery, extends the display horizon and leaves capacity free", () => {
      const result = computeSchedule(
        [feature(), { ...feature("next"), priority: 1 }],
        [member],
        [],
        date("2026-02-02"),
        2
      );
      expect(result.schedule[0]!.uat).toEqual({
        start: date("2026-02-07"),
        end: date("2026-02-20"),
      });
      expect(result.schedule[1]!.start).toEqual(date("2026-02-09"));
      expect(result.weeks).toHaveLength(4);
      expect(result.weeks.map((week) => week.allocated)).toEqual([1, 1, 0, 0]);
      expect(totalDevWeeks(feature())).toBe(1);
      expect(durationWeeks(feature())).toBe(3);
    });
    it("does not invent UAT dates for incomplete or unestimated features", () => {
      const result = computeSchedule(
        [feature("long", 10), { ...feature("empty"), backend_devs: 0, backend_weeks: 0 }],
        [member],
        [],
        date("2026-02-02"),
        1
      );
      expect(result.schedule.every((item) => !item.uat && item.end === null)).toBe(true);
    });
    it("uses calendar dates across daylight saving changes", () => {
      const result = computeSchedule([feature()], [member], [], date("2026-03-23"), 1);
      expect(end(result)).toBe("2026-04-10");
      expect(result.schedule[0]!.endIdx).toBe(2);
    });
  });
});
