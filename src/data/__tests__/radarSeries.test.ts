import { describe, expect, it } from "vitest";
import type { Evaluation } from "@/types";
import { SERIES_COLORS } from "@/components/atoms/radarChart";
import { comparisonColor } from "../radarSeries";

const peer = (id: string, authorName: string): Evaluation => ({
  id,
  memberId: "member",
  kind: "peer",
  status: "published",
  authorName,
  currentLevels: {},
  goalLevels: {},
  comments: {},
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("comparisonColor", () => {
  it("keeps the same color for every version by the same peer", () => {
    expect(comparisonColor(peer("version-1", "Alice"))).toBe(
      comparisonColor(peer("version-2", " alice "))
    );
  });

  it("assigns distinct peer colors without using reserved series colors", () => {
    const alice = comparisonColor(peer("a", "Alice"));
    const bob = comparisonColor(peer("b", "Bob"));
    expect(alice).not.toBe(bob);
    expect([
      SERIES_COLORS.current,
      SERIES_COLORS.goal,
      SERIES_COLORS.self,
      SERIES_COLORS.template,
    ]).not.toContain(alice);
    expect([
      SERIES_COLORS.current,
      SERIES_COLORS.goal,
      SERIES_COLORS.self,
      SERIES_COLORS.template,
    ]).not.toContain(bob);
  });

  it("uses the dedicated self-assessment color", () => {
    expect(comparisonColor({ ...peer("self", "Ada"), kind: "self" })).toBe(SERIES_COLORS.self);
  });
});
