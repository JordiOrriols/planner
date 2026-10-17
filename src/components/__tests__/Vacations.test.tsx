import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Vacations from "@/pages/vacations";
import TeamConfiguration from "@/pages/team-configuration";

const { setVacations, clearVacation, setSprintCalibration, createTeam, refresh, state } =
  vi.hoisted(() => ({
    setVacations: vi.fn(),
    createTeam: vi.fn(),
    clearVacation: vi.fn(),
    setSprintCalibration: vi.fn(),
    refresh: vi.fn(),
    state: { canEdit: true, isOwner: false, linkedToGrace: false },
  }));
vi.mock("@/data/DataProvider", () => ({
  useData: () => ({
    repository: {
      setVacations,
      clearVacation,
      setSprintCalibration,
      createTeam,
    },
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
        can_edit: state.linkedToGrace,
        vacation_token: null,
      },
    ],
    linkedTeams: [{ id: "team", name: "Team" }],
    vacations: [{ member_id: "grace", date: "2026-11-02", is_working: false }],
    workspace: { id: "workspace", sprint_start_date: "2026-02-02", sprint_history: [] },
    isOwner: state.isOwner,
    canEdit: state.canEdit,
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
  state.linkedToGrace = false;
  setVacations.mockResolvedValue(undefined);
  createTeam.mockResolvedValue({ id: "new", name: "Platform" });
  refresh.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("Team vacations shared editor", () => {
  it("saves calibration to the selected workspace and refreshes without moving with the calendar", async () => {
    render(<Vacations />);
    const description = screen.getByRole("region", { name: "Squad velocity" }).textContent;
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("region", { name: "Squad velocity" }).textContent).toBe(description);
    await userEvent.click(screen.getByRole("button", { name: "Calibrate velocity" }));
    await userEvent.click(screen.getByRole("button", { name: "Save calibration" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(setSprintCalibration).toHaveBeenCalledExactlyOnceWith("workspace", "2026-02-02", []);
  });

  it.each([false, true])("separates calendar from configuration for owner=%s", (isOwner) => {
    state.isOwner = isOwner;
    const rendered = render(<Vacations />);
    expect(screen.getAllByRole("region")).toEqual([
      screen.getByRole("region", { name: "Squad velocity" }),
      screen.getByRole("region", { name: "Vacation calendar" }),
    ]);
    expect(screen.queryByRole("heading", { name: "Team members" })).not.toBeInTheDocument();
    rendered.unmount();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TeamConfiguration />
      </QueryClientProvider>
    );
    const configuration = screen.getByRole("region", { name: "Team members" });
    expect(within(configuration).getByRole("heading", { name: "Team members" })).toBeVisible();
    expect(
      within(configuration).getByRole("combobox", { name: "Planning role for Ada" })
    ).toBeVisible();
    const teams = screen.getByRole("region", { name: "Teams" });
    expect(within(teams).getByText("Team")).toBeVisible();
    if (isOwner) {
      expect(within(teams).getByRole("button", { name: "Add team" })).toBeDisabled();
    } else {
      expect(within(teams).queryByRole("button", { name: "Add team" })).not.toBeInTheDocument();
    }
  });

  it("lists the workspace teams read-only and lets the owner add one to this workspace", async () => {
    state.isOwner = true;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TeamConfiguration />
      </QueryClientProvider>
    );
    const teams = screen.getByRole("region", { name: "Teams" });
    expect(within(teams).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(teams).getByText(/stay in the workspace they were created in/)).toBeVisible();
    await userEvent.type(
      within(teams).getByRole("textbox", { name: "New team name" }),
      " Platform "
    );
    await userEvent.click(within(teams).getByRole("button", { name: "Add team" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(createTeam).toHaveBeenCalledExactlyOnceWith("workspace", " Platform ");
    expect(within(teams).getByRole("textbox", { name: "New team name" })).toHaveValue("");
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
    expect(setVacations).toHaveBeenCalledExactlyOnceWith("ada", "2026-11-02", "2026-11-04", false);
    expect(screen.getByRole("button", { name: "2026-11-03" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await userEvent.click(screen.getByRole("button", { name: "Working Day" }));
    await waitFor(() =>
      expect(setVacations).toHaveBeenLastCalledWith("ada", "2026-11-02", "2026-11-04", true)
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
    expect(setVacations).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Calibrate velocity" })).not.toBeInTheDocument();
  });

  it("starts a viewer linked to a member on their own, editable calendar", async () => {
    state.canEdit = false;
    state.linkedToGrace = true;
    render(<Vacations />);
    expect(screen.getByRole("combobox", { name: "Member" })).toHaveValue("grace");
    await userEvent.click(screen.getByRole("button", { name: "2026-11-09" }));
    await userEvent.click(screen.getByRole("button", { name: "2026-11-10" }));
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    await waitFor(() =>
      expect(setVacations).toHaveBeenCalledExactlyOnceWith(
        "grace",
        "2026-11-09",
        "2026-11-10",
        false
      )
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Member" }), "ada");
    expect(screen.getByRole("button", { name: "Vacations", exact: true })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Calibrate velocity" })).not.toBeInTheDocument();
  });

  it("sends viewers away from team configuration", () => {
    state.canEdit = false;
    render(
      <MemoryRouter initialEntries={["/team-configuration"]}>
        <Routes>
          <Route path="/" element={<p>Estimation</p>} />
          <Route path="/team-configuration" element={<TeamConfiguration />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Estimation")).toBeInTheDocument();
  });
});
