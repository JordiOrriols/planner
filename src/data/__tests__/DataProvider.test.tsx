import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { Header } from "@/components/molecules/Header";
import { DataProvider, useData } from "../DataProvider";

const { auth, state } = vi.hoisted(() => {
  const state: { listener?: (event: string, session: unknown) => void } = {};
  return {
    state,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        state.listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async () => ({ data: { provider: "github" }, error: null })),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
});

vi.mock("../supabaseClient", () => ({ supabase: { auth } }));
function RepoKind() {
  const {
    repository,
    loading,
    passwordRecovery,
    requestPasswordReset,
    updatePassword,
    signInWithGitHub,
  } = useData();
  return (
    <div>
      <span data-testid="repo">{loading ? "loading" : (repository?.kind ?? "none")}</span>
      <span data-testid="recovery">{String(passwordRecovery)}</span>
      <button onClick={() => void requestPasswordReset("a@b.co")}>Request reset</button>
      <button onClick={() => void updatePassword("new-password")}>Update password</button>
      <button onClick={() => void signInWithGitHub()}>GitHub</button>
    </div>
  );
}

const renderApp = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <DataProvider>
        <Header onAddMember={vi.fn()} onShowReference={vi.fn()} />
        <RepoKind />
      </DataProvider>
    </I18nextProvider>
  );

describe("DataProvider + login", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("has no repository until signed in, then uses the remote repository", async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId("repo")).toHaveTextContent("none"));

    await userEvent.click(screen.getByTestId("sign-in-button"));
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "supersecret",
    });

    await act(async () => state.listener?.("SIGNED_IN", { user: { id: "u1", email: "a@b.co" } }));
    await waitFor(() => expect(screen.getByTestId("repo")).toHaveTextContent("remote"));

    await userEvent.click(screen.getByTestId("sign-out-button"));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("asks to confirm the email after sign up and shows auth errors", async () => {
    renderApp();
    await userEvent.click(await screen.findByTestId("sign-in-button"));
    await userEvent.click(screen.getByText("No account? Create one"));
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();

    auth.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Weak password" },
    } as never);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Weak password");
  });

  it("requests a reset email with the deployment base URL", async () => {
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Request reset" }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.co", {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
  });

  it("starts GitHub OAuth with the deployment base URL", async () => {
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "GitHub" }));
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
    });
  });

  it("opens recovery on the Supabase event and updates the password", async () => {
    renderApp();
    await act(async () =>
      state.listener?.("PASSWORD_RECOVERY", { user: { id: "u1", email: "a@b.co" } })
    );
    await waitFor(() => expect(screen.getByTestId("recovery")).toHaveTextContent("true"));

    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    await waitFor(() => expect(screen.getByTestId("recovery")).toHaveTextContent("false"));
  });
});
