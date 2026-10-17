import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSharedSupabaseClient, redirectAuthCallback, takeAuthCallback } = vi.hoisted(() => ({
  createSharedSupabaseClient: vi.fn(() => ({ auth: {} })),
  redirectAuthCallback: vi.fn(() => false),
  takeAuthCallback: vi.fn(() => ({ kind: "code", code: "abc" })),
}));
vi.mock("@jordiorriols/ui", () => ({
  createSharedSupabaseClient,
  redirectAuthCallback,
  takeAuthCallback,
}));

describe("Planner auth callback initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    redirectAuthCallback.mockReturnValue(false);
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("checks the destination and takes the link out of the URL before creating the client", async () => {
    const { supabase, authCallback } = await import("../supabaseClient");
    expect(redirectAuthCallback).toHaveBeenCalledWith("planner");
    expect(redirectAuthCallback.mock.invocationCallOrder[0]).toBeLessThan(
      takeAuthCallback.mock.invocationCallOrder[0]!
    );
    expect(takeAuthCallback.mock.invocationCallOrder[0]).toBeLessThan(
      createSharedSupabaseClient.mock.invocationCallOrder[0]!
    );
    expect(authCallback).toEqual({ kind: "code", code: "abc" });
    expect(createSharedSupabaseClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-publishable-key"
    );
    expect(supabase).not.toBeNull();
  });

  it("does not consume a callback destined for another app", async () => {
    redirectAuthCallback.mockReturnValue(true);
    const { supabase } = await import("../supabaseClient");
    expect(supabase).toBeNull();
    expect(createSharedSupabaseClient).not.toHaveBeenCalled();
    expect(takeAuthCallback).not.toHaveBeenCalled();
  });
});
