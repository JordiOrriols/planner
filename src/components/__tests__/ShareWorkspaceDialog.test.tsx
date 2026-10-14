import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import { ShareWorkspaceDialog } from "@/components/molecules/ShareWorkspaceDialog";
import AppLayout from "@/components/organisms/app-layout";

const { repository, refresh, state, selectWorkspace, createWorkspace } = vi.hoisted(() => ({
  selectWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  state: { isOwner: true, canEdit: true },
  repository: {
    listWorkspaceShares: vi.fn(),
    shareWorkspace: vi.fn(),
    updateWorkspaceShare: vi.fn(),
    removeWorkspaceShare: vi.fn(),
  },
  refresh: vi.fn(),
}));
vi.mock("@/data/DataProvider", () => ({
  useData: () => ({ repository, user: { id: "owner" } }),
}));
vi.mock("@/data/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: { id: "workspace", name: "Platform" },
    workspaces: [
      { id: "workspace", name: "Platform" },
      { id: "second", name: "Product" },
    ],
    selectWorkspace,
    createWorkspace,
    ...state,
    refresh,
  }),
}));
function renderDialog() {
  const close = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ShareWorkspaceDialog onClose={close} />
      </QueryClientProvider>
    </I18nextProvider>
  );
  return close;
}
beforeEach(async () => {
  vi.resetAllMocks();
  state.isOwner = true;
  state.canEdit = true;
  await i18n.changeLanguage("en");
  repository.listWorkspaceShares.mockResolvedValue([
    { user_id: "ada", email: "ada@example.com", access_level: "viewer" },
  ]);
  refresh.mockResolvedValue(undefined);
});
describe("Shared UI workspace sharing", () => {
  it("keeps workspace switching, creation and sharing in the tab bar", async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    );
    const tabs = screen.getByRole("navigation", { name: "Planner pages" });
    expect(within(tabs).getByRole("link", { name: "Vacations" })).toBeVisible();
    expect(within(tabs).getByRole("button", { name: "Share" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "New workspace" })).not.toBeInTheDocument();
    await userEvent.click(within(tabs).getByRole("button", { name: "Workspace" }));
    expect(screen.getByRole("menuitemradio", { name: "Platform" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Product" }));
    expect(selectWorkspace).toHaveBeenCalledExactlyOnceWith("second");
    expect(within(tabs).getByRole("button", { name: "Workspace" })).toHaveFocus();
    await userEvent.click(within(tabs).getByRole("button", { name: "Workspace" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New workspace" }));
    expect(createWorkspace).toHaveBeenCalledOnce();
    await userEvent.click(within(tabs).getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("alertdialog", { name: "Share Platform" })).toBeVisible();
  });

  it.each([true, false])("exposes workspace sharing only to the owner (owner=%s)", (isOwner) => {
    state.isOwner = isOwner;
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      </I18nextProvider>
    );
    if (isOwner) {
      expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
      expect(screen.getByText("Owner", { exact: true })).toBeVisible();
    } else {
      expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
      expect(screen.getByText("Edit", { exact: true })).toBeVisible();
    }
  });

  it("shares registered emails and manages View/Edit permissions with the same shared dialog as teams", async () => {
    const close = renderDialog();
    await screen.findByLabelText("Permission for ada@example.com");
    expect(screen.getByRole("alertdialog", { name: "Share Platform" })).toBeVisible();
    await userEvent.type(screen.getByLabelText("Email"), "GRACE@EXAMPLE.COM");
    await userEvent.selectOptions(screen.getByLabelText("Permission"), "editor");
    await userEvent.click(screen.getByRole("button", { name: "Share", exact: true }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(repository.shareWorkspace).toHaveBeenCalledExactlyOnceWith(
      "workspace",
      "grace@example.com",
      "editor"
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Permission for ada@example.com"),
      "editor"
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(repository.updateWorkspaceShare).toHaveBeenCalledExactlyOnceWith(
      "workspace",
      "ada",
      "editor"
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove ada@example.com" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(3));
    expect(repository.removeWorkspaceShare).toHaveBeenCalledExactlyOnceWith("workspace", "ada");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("shows save errors and does not report successful sharing", async () => {
    repository.shareWorkspace.mockRejectedValue(new Error("User not found"));
    renderDialog();
    await screen.findByLabelText("Permission for ada@example.com");
    await userEvent.type(screen.getByLabelText("Email"), "missing@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Share", exact: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("User not found");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows initial load failures with retry instead of an empty collaborator list", async () => {
    repository.listWorkspaceShares.mockRejectedValueOnce(new Error("Shares could not be loaded"));
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent("Shares could not be loaded");
    expect(screen.queryByText("This workspace has not been shared yet.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByLabelText("Permission for ada@example.com");
  });
});
