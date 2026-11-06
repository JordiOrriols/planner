import { describe, expect, it } from "vitest";
import {
  reorderPriority,
  validatePriorityOrder,
  type PriorityFeature,
} from "../featureDependencies";

const features: PriorityFeature[] = [
  { id: "a", name: "API", status: "pending" },
  { id: "b", name: "Web", status: "paused", dependency_ids: ["a"] },
  { id: "c", name: "Design", status: "pending" },
];

describe("shared priority validation", () => {
  it("allows independent moves without mutating the input and names violated prerequisites", () => {
    expect(reorderPriority(features, "c", "a")).toEqual(["c", "a", "b"]);
    expect(features.map((feature) => feature.id)).toEqual(["a", "b", "c"]);
    expect(() => reorderPriority(features, "b", "a")).toThrow(
      '"Web" must come after its dependency "API".'
    );
  });
  it("rejects partial, duplicate, unknown and missing-feature orders", () => {
    for (const ids of [
      ["a", "b"],
      ["a", "a", "c"],
      ["a", "b", "unknown"],
    ])
      expect(() => validatePriorityOrder(features, ids)).toThrow(/roadmap has changed/i);
    expect(() => reorderPriority(features, "unknown", "a")).toThrow(/roadmap has changed/i);
    expect(() => reorderPriority(features, "a", "unknown")).toThrow(/roadmap has changed/i);
    expect(() => validatePriorityOrder([features[1]!], ["b"])).toThrow(/dependency "a"/);
    expect(() => validatePriorityOrder([], [])).not.toThrow();
  });
  it("locks every row through the last done/in-progress row, not just the active rows", () => {
    for (const status of ["done", "in_progress"]) {
      const locked = features.map((feature, index) =>
        index === 1 ? { ...feature, status } : feature
      );
      expect(() => reorderPriority(locked, "c", "a", true)).toThrow(/Only pending or paused/);
      expect(() => validatePriorityOrder(locked, ["a", "b", "c"], true)).not.toThrow();
    }
  });
});
