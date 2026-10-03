import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn utility", () => {
  it("should combine class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("should handle undefined values", () => {
    expect(cn("px-2", undefined, "py-1")).toBe("px-2 py-1");
  });

  it("should handle empty strings", () => {
    expect(cn("px-2", "", "py-1")).toBe("px-2 py-1");
  });

  it("should handle objects with true values", () => {
    expect(cn("px-2", { "py-1": true, "py-2": false })).toBe("px-2 py-1");
  });

  it("should handle arrays", () => {
    expect(cn(["px-2", "py-1"], "text-blue-500")).toBe("px-2 py-1 text-blue-500");
  });
});
