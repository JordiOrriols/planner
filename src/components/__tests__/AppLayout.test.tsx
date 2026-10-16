import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import AppLayout from "@/components/organisms/app-layout";

vi.mock("@/data/DataProvider", () => ({
  useData: () => ({ user: { email: "viewer@example.com" }, signOut: vi.fn() }),
}));
vi.mock("@/data/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: { id: "workspace", name: "Team" },
    workspaces: [{ id: "workspace", name: "Team" }],
    isOwner: false,
    canEdit: false,
    selectWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
  }),
}));

describe("Planner shared project navigation", () => {
  it("opens the shared registry from the header icon and restores focus", async () => {
    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <AppLayout />
        </I18nextProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Planner" })).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Switch project" });
    await userEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Ladders" })).toHaveAttribute(
      "href",
      "https://ladders.jordiorriols.cat/"
    );
    expect(screen.getByRole("menuitem", { name: "Planner" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
