import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import Vacations from "@/pages/vacations";

const { setAvailability, clearAvailability, refresh, state } = vi.hoisted(() => ({
  setAvailability: vi.fn(),
  clearAvailability: vi.fn(),
  refresh: vi.fn(),
  state: { canEdit: true, isOwner: false },
}));
vi.mock("@/data/DataProvider", () => ({
  useData: () => ({
    repository: { setAvailability, clearAvailability, listTeams: async () => [] },
  }),
}));
vi.mock("@/data/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    members: [
      {
        id: "ada",
        name: "Ada",
        team_id: "team",
        role: "backend",
        can_edit: state.canEdit,
        vacation_token: null,
      },
      {
        id: "grace",
        name: "Grace",
        team_id: "team",
        role: "frontend",
        can_edit: false,
        vacation_token: null,
      },
    ],
    linkedTeams: [{ id: "team", name: "Team" }],
    availability: [{ member_id: "grace", date: "2026-11-02", is_working: false }],
    workspace: { id: "workspace" },
    isOwner: state.isOwner,
    refresh,
  }),
}));
vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 1));
  state.canEdit = true;
  state.isOwner = false;
  setAvailability.mockResolvedValue(undefined);
  refresh.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("Team vacations shared editor", () => {
  it.each([false, true])("shows velocity, calendar, then configuration for owner=%s", (isOwner) => {
    state.isOwner = isOwner;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Vacations />
      </QueryClientProvider>
    );
    const configuration = screen.getByRole("region", { name: "Configuration" });
    expect(screen.getAllByRole("region")).toEqual([
      screen.getByRole("region", { name: "Squad velocity" }),
      screen.getByRole("region", { name: "Vacation calendar" }),
      configuration,
    ]);
    expect(within(configuration).getByRole("heading", { name: "Team members" })).toBeVisible();
    expect(
      within(configuration).getByRole("combobox", { name: "Planning role for Ada" })
    ).toBeVisible();
    if (isOwner) {
      expect(within(configuration).getByRole("heading", { name: "Ladders teams" })).toBeVisible();
      expect(
        within(configuration).getByRole("button", { name: "Save linked teams" })
      ).toBeVisible();
    } else {
      expect(screen.queryByRole("button", { name: "Save linked teams" })).not.toBeInTheDocument();
    }
  });

  it("uses highlighted calendar ranges and one-click actions for the selected member", async () => {
    render(<Vacations />);
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save availability" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Team vacation legend")).toHaveTextContent("Grace");
    expect(screen.getByLabelText("Grace: vacation")).toHaveTextContent("GGrace");
    await userEvent.click(screen.getByRole("button", { name: "2026-11-02" }));
    await userEvent.click(screen.getByRole("button", { name: "2026-11-04" }));
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(setAvailability).toHaveBeenCalledExactlyOnceWith(
      "ada",
      "2026-11-02",
      "2026-11-04",
      false
    );
    expect(screen.getByRole("button", { name: "2026-11-03" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await userEvent.click(screen.getByRole("button", { name: "Working Day" }));
    await waitFor(() =>
      expect(setAvailability).toHaveBeenLastCalledWith("ada", "2026-11-02", "2026-11-04", true)
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Member" }), "grace");
    expect(screen.getByRole("button", { name: "2026-11-03" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Vacations", exact: true })).toBeDisabled();
  });

  it("cannot select or apply vacations for a read-only member", () => {
    state.canEdit = false;
    render(<Vacations />);
    expect(screen.getByRole("button", { name: "2026-11-02" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vacations", exact: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working Day" })).toBeDisabled();
    expect(setAvailability).not.toHaveBeenCalled();
  });
});
