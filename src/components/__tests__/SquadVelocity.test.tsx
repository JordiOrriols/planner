import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseISO } from "date-fns";
import SquadVelocity from "@/components/organisms/squad-velocity";
import type { PlannerMember, SprintResult } from "@/types/planner";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="velocity-chart" data-weeks={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({
    name,
    stackId,
    dataKey,
    fill,
  }: {
    name: string;
    stackId?: string;
    dataKey: string;
    fill: string;
  }) => (
    <div data-testid={`series-${name}`} data-stack={stackId} data-key={dataKey} data-color={fill} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  CartesianGrid: () => null,
}));
const members: PlannerMember[] = [
  {
    id: "back1",
    team_id: "product",
    name: "Ada",
    role: "backend",
    can_edit: false,
    vacation_token: null,
  },
  {
    id: "back2",
    team_id: "platform",
    name: "Alan",
    role: "backend",
    can_edit: false,
    vacation_token: null,
  },
  {
    id: "front",
    team_id: "product",
    name: "Grace",
    role: "frontend",
    can_edit: false,
    vacation_token: null,
  },
  {
    id: "design",
    team_id: "platform",
    name: "Diana",
    role: "design",
    can_edit: false,
    vacation_token: null,
  },
  {
    id: "qa",
    team_id: "platform",
    name: "Quinn",
    role: "qa",
    can_edit: false,
    vacation_token: null,
  },
  {
    id: "unassigned",
    team_id: "product",
    name: "Unassigned",
    role: null,
    can_edit: false,
    vacation_token: null,
  },
];
const linkedTeams = [
  { id: "product", name: "Product" },
  { id: "platform", name: "Platform" },
];
const vacations = [
  { member_id: "front", date: "2026-02-02", is_working: false },
  { member_id: "front", date: "2026-02-07", is_working: true },
  ...["2026-02-02", "2026-02-03", "2026-02-04"].map((date) => ({
    member_id: "back2",
    date,
    is_working: false,
  })),
];
function renderVelocity(startDate = "2026-02-02") {
  return render(
    <SquadVelocity
      members={members}
      linkedTeams={linkedTeams}
      vacations={vacations}
      startDate={parseISO(startDate)}
      sprintStart="2026-02-02"
      history={[]}
    />
  );
}
function firstWeek() {
  const rows = within(screen.getByRole("table", { name: /per sprint/ })).getAllByRole("row");
  return within(rows[1]!)
    .getAllByRole("cell")
    .map((cell) => Number(cell.textContent));
}
afterEach(() => vi.useRealTimers());
describe("Squad velocity area and team series", () => {
  it("stacks all areas by default and preserves vacation/working-day capacity without counting unassigned members", () => {
    renderVelocity();
    expect(
      screen.getByRole("table", { name: "Available person-weeks per sprint" }).parentElement
    ).toHaveClass("sr-only");
    for (const selector of [
      screen.getByRole("combobox", { name: "Velocity grouping" }),
      screen.getByRole("button", { name: "Select velocity areas" }),
    ])
      expect(selector).toHaveClass("h-9", "w-36");
    const legend = screen.getByRole("list", { name: "Velocity legend" });
    expect(legend).toHaveClass("text-[11px]");
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["Backend", "Frontend", "Design", "QA"]);
    expect(firstWeek()).toEqual([3.4, 2, 2, 2]);
    expect(JSON.parse(screen.getByTestId("velocity-chart").getAttribute("data-weeks")!)[0]).toEqual(
      {
        date: "2026-02-02",
        label: "Feb 2 – Feb 15",
        series0: 3.4,
        series1: 2,
        series2: 2,
        series3: 2,
      }
    );
    expect(firstWeek().reduce((sum, value) => sum + value, 0)).toBeCloseTo(9.4);
    for (const name of ["Backend", "Frontend", "Design", "QA"]) {
      expect(screen.getByTestId(`series-${name}`)).toHaveAttribute("data-stack", "capacity");
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(screen.getByTestId("series-Backend")).toHaveAttribute("data-color", "#0369a1");
  });

  it("renders one selected area as a single bar and multiple selected areas as a stack", async () => {
    renderVelocity();
    await userEvent.click(screen.getByRole("button", { name: "Select velocity areas" }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "All areas" }));
    expect(screen.getByRole("status")).toHaveTextContent("Select at least one");
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Backend", exact: true }));
    expect(firstWeek()).toEqual([3.4]);
    expect(screen.getByTestId("series-Backend")).not.toHaveAttribute("data-stack");
    expect(screen.queryByTestId("series-Frontend")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Velocity legend" })).toHaveTextContent("Backend");
    expect(
      within(screen.getByRole("list", { name: "Velocity legend" })).queryByText("Frontend")
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Frontend", exact: true }));
    expect(firstWeek()).toEqual([3.4, 2]);
    expect(screen.getByTestId("series-Backend")).toHaveAttribute("data-stack", "capacity");
    expect(screen.getByTestId("series-Frontend")).toHaveAttribute("data-stack", "capacity");
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "All areas" }));
    expect(firstWeek()).toEqual([3.4, 2, 2, 2]);
  });

  it("switches the second dropdown to linked teams and filters them independently of areas", async () => {
    renderVelocity();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Velocity grouping" }),
      "teams"
    );
    expect(firstWeek()).toEqual([4, 5.4]);
    expect(screen.getByTestId("series-Product")).toHaveAttribute("data-stack", "capacity");
    await userEvent.click(screen.getByRole("button", { name: "Select velocity teams" }));
    expect(screen.queryByRole("menuitemcheckbox", { name: "Backend" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Platform", exact: true }));
    expect(firstWeek()).toEqual([4]);
    expect(screen.getByTestId("series-Product")).not.toHaveAttribute("data-stack");
    await userEvent.keyboard("{Escape}");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Velocity grouping" }),
      "areas"
    );
    expect(firstWeek()).toEqual([3.4, 2, 2, 2]);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Velocity grouping" }),
      "teams"
    );
    expect(firstWeek()).toEqual([4]);
  });

  it("uses saved sprint boundaries and never forecasts an incomplete verified sprint", () => {
    const rendered = renderVelocity("2026-12-21");
    expect(firstWeek()).toEqual([3.2, 1.6, 1.6, 1.6]);
    rendered.rerender(
      <SquadVelocity
        members={members}
        linkedTeams={linkedTeams}
        vacations={vacations}
        startDate={parseISO("2027-12-27")}
        sprintStart="2026-02-02"
        history={[]}
      />
    );
    expect(screen.getAllByRole("row")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("No complete sprints");
  });

  it("handles empty teams explicitly and picks up newly linked teams", async () => {
    const rendered = render(
      <SquadVelocity
        members={[]}
        linkedTeams={[]}
        vacations={[]}
        startDate={parseISO("2026-02-02")}
        sprintStart="2026-02-02"
        history={[]}
      />
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Velocity grouping" }),
      "teams"
    );
    expect(screen.getByRole("button", { name: "Select velocity teams" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Add a team in Configuration");
    rendered.rerender(
      <SquadVelocity
        members={members}
        linkedTeams={linkedTeams}
        vacations={vacations}
        startDate={parseISO("2026-02-02")}
        sprintStart="2026-02-02"
        history={[]}
      />
    );
    expect(screen.getByRole("button", { name: "Select velocity teams" })).toBeEnabled();
    expect(firstWeek()).toEqual([4, 5.4]);
  });

  it("uses one workspace rate for all filters and updates predictions when vacations change", async () => {
    const history: SprintResult[] = [{ start_date: "2026-02-02", story_points: 94 }];
    const props = {
      members,
      linkedTeams,
      vacations,
      history,
      sprintStart: "2026-02-02",
      startDate: parseISO("2026-03-02"),
    };
    const rendered = render(<SquadVelocity {...props} />);
    expect(firstWeek()).toEqual([40, 20, 20, 20]);
    expect(screen.getByRole("table", { name: "Estimated story points per sprint" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Calibrate velocity" })).not.toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Velocity grouping" }),
      "teams"
    );
    expect(firstWeek()).toEqual([40, 60]);
    rendered.rerender(
      <SquadVelocity
        {...props}
        vacations={[...vacations, { member_id: "front", date: "2026-03-02", is_working: false }]}
      />
    );
    expect(firstWeek()).toEqual([38, 60]);
  });

  it("saves calibration through the gear and retains saved dates and points on reopening", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 1, 16));
    const save = vi.fn().mockResolvedValue(undefined);
    const props = {
      members,
      linkedTeams,
      vacations,
      startDate: parseISO("2026-02-16"),
      sprintStart: "2026-02-02",
      history: [] as SprintResult[],
      onSaveCalibration: save,
    };
    const rendered = render(<SquadVelocity {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Calibrate velocity" }));
    await userEvent.click(screen.getByRole("button", { name: "Add sprint" }));
    expect(screen.getByLabelText("Sprint start")).toHaveValue("2026-02-02");
    await userEvent.type(screen.getByLabelText("Delivered story points"), "94");
    expect(screen.getByText("10 story points per available person-week")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save calibration" }));
    expect(save).toHaveBeenCalledExactlyOnceWith("2026-02-02", [
      { start_date: "2026-02-02", story_points: 94 },
    ]);
    rendered.rerender(
      <SquadVelocity {...props} history={[{ start_date: "2026-02-02", story_points: 94 }]} />
    );
    expect(firstWeek()).toEqual([40, 20, 20, 20]);
    await userEvent.click(screen.getByRole("button", { name: "Calibrate velocity" }));
    expect(screen.getByLabelText("Delivered story points")).toHaveValue(94);
    expect(screen.getByLabelText("Sprint cadence starts")).toHaveValue("2026-02-02");
  });
});
