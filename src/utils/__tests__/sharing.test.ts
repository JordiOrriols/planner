import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildShareLink, copyToClipboard } from "../sharing";

describe("sharing helpers", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/app/index.html#/old"),
      writable: false,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: false,
      configurable: true,
    });
  });

  it("builds a hash-based share link", () => {
    const url = buildShareLink("e/11111111-1111-4111-8111-111111111111");
    expect(url).toBe("https://example.com/app/index.html#/e/11111111-1111-4111-8111-111111111111");
  });

  it("copies to clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // @ts-expect-error mock clipboard
    navigator.clipboard = { writeText };
    await copyToClipboard("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
  });
});
