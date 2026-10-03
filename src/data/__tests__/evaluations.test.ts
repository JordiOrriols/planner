import { describe, it, expect } from "vitest";
import enLocale from "@/locales/en.json";
import esLocale from "@/locales/es.json";
import caLocale from "@/locales/ca.json";
import { VERTICALS } from "@/components/atoms/levelSelector";
import type { Evaluation } from "@/types";
import { latestOf, toMemberSummary, versionLabel } from "../evaluations";
import { LADDER_TEMPLATES, findTemplate } from "../ladderTemplates";

const evaluation = (overrides: Partial<Evaluation>): Evaluation => ({
  id: "e",
  memberId: "m",
  kind: "manager",
  status: "published",
  authorName: null,
  currentLevels: {},
  goalLevels: {},
  comments: {},
  createdAt: "2026-03-10T10:00:00.000Z",
  ...overrides,
});

describe("versionLabel", () => {
  it("shows only month and year when it is the only version that month", () => {
    const only = evaluation({ id: "a" });
    expect(versionLabel(only, [only], "en")).toBe("March 2026");
  });

  it("adds the day when the same author saved several versions that month", () => {
    const a = evaluation({ id: "a" });
    const b = evaluation({ id: "b", createdAt: "2026-03-20T10:00:00.000Z" });
    expect(versionLabel(a, [a, b], "en")).toMatch(/10/);
  });

  it("does not clash across different kinds", () => {
    const a = evaluation({ id: "a" });
    const b = evaluation({ id: "b", kind: "self" });
    expect(versionLabel(a, [a, b], "en")).toBe("March 2026");
  });
});

describe("summaries and imports", () => {
  it("builds a member summary from the latest manager and published self versions", () => {
    const summary = toMemberSummary(
      {
        id: "m",
        name: "Ada",
        role: "",
        templateId: null,
        selfToken: null,
        peerToken: null,
        viewToken: null,
        viewEnabled: false,
        createdAt: "",
      },
      [
        evaluation({ id: "old", currentLevels: { Technology: 1 }, createdAt: "2026-01-01" }),
        evaluation({ id: "new", currentLevels: { Technology: 3 }, createdAt: "2026-02-01" }),
        evaluation({ id: "s", kind: "self", status: "draft", currentLevels: { Technology: 5 } }),
      ]
    );
    expect(summary.currentLevels).toEqual({ Technology: 3 });
    expect(summary.selfAssessmentLevels).toEqual({});
  });

  it("latestOf filters by kind and status", () => {
    const list = [
      evaluation({ id: "a", kind: "self", status: "draft", createdAt: "2026-02-01" }),
      evaluation({ id: "b", kind: "self", createdAt: "2026-01-01" }),
    ];
    expect(latestOf(list, "self")?.id).toBe("a");
    expect(latestOf(list, "self", true)?.id).toBe("b");
  });
});

describe("ladder templates", () => {
  it("defines a level 1-5 for every vertical", () => {
    for (const template of LADDER_TEMPLATES) {
      for (const vertical of VERTICALS) {
        const level = template.levels[vertical] ?? 0;
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(5);
      }
    }
    expect(findTemplate("D3")?.levels["Process"]).toBe(3);
    expect(findTemplate(null)).toBeUndefined();
  });

  it("has a summary in every locale", () => {
    for (const locale of [enLocale, esLocale, caLocale]) {
      for (const template of LADDER_TEMPLATES) {
        expect((locale.templates.summaries as Record<string, string>)[template.id]).toBeTruthy();
      }
    }
  });
});
