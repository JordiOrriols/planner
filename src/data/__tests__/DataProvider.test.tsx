import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DataProvider, useData } from "../DataProvider";

const { auth, state } = vi.hoisted(() => {
  const state: { listener?: (event: string, session: unknown) => void } = {};
  return {
    state,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn((listener: typeof state.listener) => {
        state.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  };
});
vi.mock("../supabaseClient", () => ({ supabase: { auth }, authCallback: null }));

describe("Planner authentication composition", () => {
  it("creates the Planner repository and shared workspace API only after shared authentication restores a user", async () => {
    const { result } = renderHook(() => useData(), { wrapper: DataProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.repository).toBeNull();
    expect(result.current.workspaceApi).toBeNull();
    await act(async () => state.listener?.("SIGNED_IN", { user: { id: "one" } }));
    expect(result.current.repository?.loadWorkspace).toBeTypeOf("function");
    expect(result.current.workspaceApi?.listWorkspaces).toBeTypeOf("function");
    expect(result.current.repository).not.toHaveProperty("listEvaluations");
    await act(async () => state.listener?.("SIGNED_OUT", null));
    expect(result.current.repository).toBeNull();
    expect(result.current.workspaceApi).toBeNull();
  });
  it("uses the same shared recovery actions and deployment redirect", async () => {
    const { result } = renderHook(() => useData(), { wrapper: DataProvider });
    await act(async () => {
      await result.current.requestPasswordReset("member@example.com");
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("member@example.com", {
      redirectTo: `${window.location.origin}${window.location.pathname}?auth_app=planner`,
    });
    await act(async () => state.listener?.("PASSWORD_RECOVERY", { user: { id: "one" } }));
    expect(result.current.passwordRecovery).toBe(true);
    await act(async () => {
      await result.current.updatePassword("a-long-password");
    });
    expect(result.current.passwordRecovery).toBe(false);
  });
});
