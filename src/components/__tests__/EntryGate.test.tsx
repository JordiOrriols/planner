import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import { EntryGate } from "../EntryGate";

const { dataState } = vi.hoisted(() => ({
  dataState: {
    user: null as { id: string } | null,
    loading: false,
    authEnabled: true,
    linkError: null as string | null,
    signIn: vi.fn(),
    signUp: vi.fn(),
  },
}));

vi.mock("@/data/DataProvider", () => ({ useData: () => dataState }));

function renderGate(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nextProvider i18n={i18n}>
        <EntryGate>
          <p>Owned application</p>
        </EntryGate>
      </I18nextProvider>
    </MemoryRouter>
  );
}

describe("EntryGate", () => {
  beforeEach(() => {
    dataState.user = null;
    dataState.loading = false;
    dataState.authEnabled = true;
    dataState.linkError = null;
    vi.clearAllMocks();
  });

  it("says why a sign-in link did not work on the welcome page", () => {
    dataState.linkError = "Email link is invalid or has expired";
    renderGate();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This link did not work: Email link is invalid or has expired. Ask for a new one from Sign in."
    );
  });

  it("offers account access on an owned route", () => {
    renderGate();
    expect(
      screen.getByRole("heading", { name: "Make room for the work ahead." })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue anonymously" })).not.toBeInTheDocument();
  });

  it("opens account creation directly in sign-up mode", async () => {
    const errors = vi.spyOn(console, "error");
    renderGate();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("heading", { name: "Create an account" })).toBeInTheDocument();
    expect(errors.mock.calls.flat().join(" ")).not.toContain("cannot be given refs");
    errors.mockRestore();
  });

  it("bypasses the welcome page for authenticated users", () => {
    dataState.user = { id: "u1" };
    renderGate();
    expect(screen.getByText("Owned application")).toBeInTheDocument();
  });

  it("shows the shared pulsing skeleton while restoring authentication", () => {
    dataState.loading = true;
    renderGate();
    const skeleton = screen.getByRole("status", { name: "Loading Planner" });
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Owned application")).not.toBeInTheDocument();
  });

  it.each(["/e/11111111-1111-4111-8111-111111111111", "/v/11111111-1111-4111-8111-111111111111"])(
    "does not expose obsolete Ladders shared route %s anonymously",
    (path) => {
      renderGate(path);
      expect(screen.queryByText("Owned application")).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Make room for the work ahead." })
      ).toBeInTheDocument();
    }
  );
});
