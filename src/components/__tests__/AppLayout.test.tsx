import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import AppLayout from "@/components/organisms/app-layout";

vi.mock("@/data/DataProvider", () => ({
  useData: () => ({ user: { email: "viewer@example.com" }, signOut: vi.fn() }),
}));
const { workspaceApi, selectWorkspace } = vi.hoisted(() => ({
  workspaceApi: {
    listWorkspaces: vi.fn(),
    createWorkspace: vi.fn(),
    listShares: vi.fn(async () => []),
    share: vi.fn(),
    updateShare: vi.fn(),
    removeShare: vi.fn(),
  },
  selectWorkspace: vi.fn(),
}));
vi.mock("@/data/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: { id: "workspace", name: "Team" },
    workspaces: [
      { id: "workspace", name: "Team", owner_id: "owner", access_level: "owner" },
      { id: "other", name: "Shared", owner_id: "someone", access_level: "viewer" },
    ],
    workspaceApi,
    isOwner: true,
    canEdit: true,
    selectWorkspace,
    refresh: vi.fn(),
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
    expect(screen.getByRole("link", { name: "Team configuration" })).toHaveAttribute(
      "href",
      "/team-configuration"
    );
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

  it("uses the shared page canvas behind the white header and page body", () => {
    const { container } = render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <AppLayout />
        </I18nextProvider>
      </MemoryRouter>
    );
    expect(container.firstElementChild).toHaveClass("min-h-screen", "bg-page");
    expect(screen.getByRole("banner")).toHaveClass("bg-background");
    expect(screen.getByRole("main")).toHaveClass("mx-auto", "max-w-7xl");
  });

  it("uses the shared workspace bar to switch and share workspaces next to the tabs", async () => {
    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <AppLayout />
        </I18nextProvider>
      </MemoryRouter>
    );
    const navigation = screen.getByRole("navigation");
    await userEvent.click(within(navigation).getByRole("button", { name: "Workspace" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /Shared/ }));
    expect(selectWorkspace).toHaveBeenCalledWith("other");
    await userEvent.click(within(navigation).getByTestId("workspace-share"));
    expect(await screen.findByTestId("share-workspace-dialog")).toBeInTheDocument();
    expect(workspaceApi.listShares).toHaveBeenCalledWith("workspace");
  });
});
