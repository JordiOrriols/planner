import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, redirectAuthCallback } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ auth: {} })),
  redirectAuthCallback: vi.fn(() => false),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@jordiorriols/ui", () => ({ redirectAuthCallback }));

describe("Planner auth callback initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    redirectAuthCallback.mockReturnValue(false);
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("checks the destination before creating the PKCE client", async () => {
    const { supabase } = await import("../supabaseClient");
    expect(redirectAuthCallback).toHaveBeenCalledWith("planner");
    expect(redirectAuthCallback.mock.invocationCallOrder[0]).toBeLessThan(
      createClient.mock.invocationCallOrder[0]!
    );
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-publishable-key",
      { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } }
    );
    expect(supabase).not.toBeNull();
  });

  it("does not consume a callback destined for another app", async () => {
    redirectAuthCallback.mockReturnValue(true);
    const { supabase } = await import("../supabaseClient");
    expect(supabase).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});
