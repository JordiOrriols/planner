import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseISO } from "date-fns";
import GanttChart from "@/components/organisms/gantt-chart";
import { computeSchedule } from "@/lib/planning";
import { EMPTY_FEATURE, type PlannerMember, type Feature } from "@/types/planner";

const members: PlannerMember[] = [
  {
    id: "back",
    team_id: "team",
    name: "Back",
    role: "backend",
    can_edit: true,
    vacation_token: null,
  },
  {
    id: "front",
    team_id: "team",
    name: "Front",
    role: "frontend",
    can_edit: true,
    vacation_token: null,
  },
  {
    id: "design",
    team_id: "team",
    name: "Design",
    role: "design",
    can_edit: true,
    vacation_token: null,
  },
  { id: "qa", team_id: "team", name: "QA", role: "qa", can_edit: true, vacation_token: null },
];
const mixed: Feature = {
  ...EMPTY_FEATURE,
  id: "mixed",
  project_id: "project",
  name: "Mixed",
  in_backlog: true,
  status: "pending",
  priority: 1,
  backend_devs: 1,
  backend_weeks: 2,
  frontend_devs: 1,
  frontend_weeks: 2,
};
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

function renderSchedule(features: Feature[], horizon = 6) {
  const result = computeSchedule(features, members, [], parseISO("2026-02-02"), horizon);
  render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
  return result;
}

describe("role-aware Gantt allocations", () => {
  it("keeps priority order and adds a project heading whenever the project changes", () => {
    const projects = [
      { id: "payments", workspace_id: "workspace", name: "Payments" },
      { id: "growth", workspace_id: "workspace", name: "Growth" },
    ];
    const features = ["Pay A", "Pay B", "Loose", "Grow", "Pay C"].map((name, index) => ({
      ...mixed,
      id: name,
      name,
      priority: index,
      project_id: [`payments`, "payments", null, "growth", "payments"][index]!,
    }));
    const result = computeSchedule(features, members, [], parseISO("2026-02-02"), 12);
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} projects={projects} />);
    const order = screen
      .getAllByRole("heading")
      .concat(screen.getAllByLabelText(/^Schedule row:/))
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((element) => element.getAttribute("aria-label"));
    expect(order).toEqual([
      "Project: Payments",
      "Schedule row: Pay A",
      "Schedule row: Pay B",
      "Project: No project",
      "Schedule row: Loose",
      "Project: Growth",
      "Schedule row: Grow",
      "Project: Payments",
      "Schedule row: Pay C",
    ]);
  });

  it("omits project headings when no scheduled feature belongs to a project", () => {
    renderSchedule([mixed, { ...mixed, id: "other", name: "Other", priority: 2 }]);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("supports opening the row menu and selecting actions from the keyboard", async () => {
    const result = computeSchedule([mixed], members, [], parseISO("2026-02-02"), 4);
    const changeStatus = vi.fn();
    render(
      <GanttChart weeks={result.weeks} schedule={result.schedule} onStatusChange={changeStatus} />
    );
    screen.getByLabelText("Schedule row: Mixed").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(screen.getByRole("menuitemradio", { name: "Pending" })).toBeChecked();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith("mixed", "done");
  });

  it("opens row actions from the project bar without inline action buttons", async () => {
    const result = computeSchedule([mixed], members, [], parseISO("2026-02-02"), 4);
    const remove = vi.fn();
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} onRemove={remove} />);
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole("group", { name: /^Mixed:/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove from roadmap" }));
    expect(remove).toHaveBeenCalledExactlyOnceWith("mixed");
  });

  it("replaces all role halves and gray gaps with one fully green delivered bar", () => {
    const pending = computeSchedule([mixed], members, [], parseISO("2026-02-02"), 4);
    const delivered = computeSchedule(
      [{ ...mixed, status: "done" }],
      members,
      [],
      parseISO("2026-02-02"),
      4
    );
    expect(delivered.weeks).toEqual(pending.weeks);
    expect(delivered.schedule[0]!.start).toEqual(pending.schedule[0]!.start);
    expect(delivered.schedule[0]!.end).toEqual(pending.schedule[0]!.end);
    render(<GanttChart weeks={delivered.weeks} schedule={delivered.schedule} />);
    const bar = screen.getByRole("group", { name: /Mixed:.* · Done$/ });
    expect(bar).toHaveClass("bg-emerald-600");
    expect(bar).not.toHaveClass("bg-slate-400/40");
    expect(bar).toBeEmptyDOMElement();
    expect(screen.queryByRole("img", { name: /^Mixed ·/ })).not.toBeInTheDocument();
    expect(bar.parentElement).toHaveStyle({ gridColumn: "2 / 6" });
  });

  it("places the blue Today marker at the day center and spans the full chart", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 1, 4, 12));
    renderSchedule([mixed], 2);
    const marker = screen.getByRole("img", { name: "Today: Feb 4, 2026" });
    expect(marker).toHaveClass("inset-y-0", "bg-blue-500");
    expect(marker.parentElement).toHaveClass("inset-y-0", "pointer-events-none");
    expect(marker.parentElement).toHaveStyle({ left: "220px" });
    expect(parseFloat(marker.style.left)).toBeCloseTo((2.5 / 28) * 100);
  });

  it.each(["2026-02-01", "2026-03-02"])(
    "omits Today when %s is outside the visible weeks",
    (today) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(parseISO(today));
      renderSchedule([mixed], 2);
      expect(screen.queryByRole("img", { name: /^Today:/ })).not.toBeInTheDocument();
    }
  );

  it("updates the Today marker across local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 8, 23, 59, 30));
    renderSchedule([mixed], 2);
    expect(screen.getByRole("img", { name: "Today: Feb 8, 2026" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    const marker = screen.getByRole("img", { name: "Today: Feb 9, 2026" });
    expect(parseFloat(marker.style.left)).toBeCloseTo((7.5 / 28) * 100);
  });
  it("stacks simultaneous two-week roles inside one 24px project bar without weekly breaks", () => {
    renderSchedule([mixed]);
    const container = screen.getByRole("group", {
      name: "Mixed: Feb 2, 2026 to Feb 27, 2026 · Pending",
    });
    const backend = screen.getByRole("img", { name: /^Mixed · Backend:/ });
    const frontend = screen.getByRole("img", { name: /^Mixed · Frontend:/ });
    for (const bar of [backend, frontend]) {
      expect(bar.parentElement).toBe(container);
      expect(bar).toHaveStyle({ left: "0%", height: "50%" });
      expect(parseFloat(bar.style.width)).toBeCloseTo((12 / 26) * 100);
      expect(bar).toBeEmptyDOMElement();
    }
    expect(container.parentElement!.parentElement).toHaveStyle({
      gridTemplateRows: "minmax(32px, auto)",
    });
    expect(backend).toHaveStyle({ top: "0" });
    expect(frontend).toHaveStyle({ top: "50%" });
    expect(container.parentElement).toHaveStyle({ gridColumn: "2 / 6" });
    expect(parseFloat(container.style.width)).toBeCloseTo((26 / 28) * 100);
    expect(screen.getByRole("img", { name: /^UAT:/ })).toHaveClass("inset-y-0");
    expect(screen.queryByText("Project and role dates")).not.toBeInTheDocument();
  });

  it("exposes a vacation pause inside a week as gray space, preserving exact work and effort", () => {
    const result = computeSchedule(
      [{ ...mixed, backend_weeks: 1, frontend_devs: 0, frontend_weeks: 0 }],
      members,
      [{ member_id: "back", date: "2026-02-04", is_working: false }],
      parseISO("2026-02-02"),
      3
    );
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
    const container = screen.getByRole("group", {
      name: "Mixed: Feb 2, 2026 to Feb 23, 2026 · Pending",
    });
    const bars = screen.getAllByRole("img", { name: /^Mixed · Backend:/ });
    expect(bars).toHaveLength(2);
    expect(container).toHaveClass("bg-slate-400/40");
    expect(parseFloat(bars[0]!.style.width)).toBeCloseTo((2 / 22) * 100);
    expect(parseFloat(bars[1]!.style.left)).toBeCloseTo((3 / 22) * 100);
    expect(parseFloat(bars[1]!.style.width)).toBeCloseTo((5 / 22) * 100);
    expect(bars[0]).toHaveAccessibleName(/Feb 2, 2026 to Feb 3, 2026.*0.4 person-weeks/);
    expect(bars[1]).toHaveAccessibleName(/Feb 5, 2026 to Feb 9, 2026.*0.6 person-weeks/);
    expect(
      result.schedule[0]!.roles[0]!.allocations.flatMap((a) => a.days).map((day) =>
        day.date.getDate()
      )
    ).toEqual([2, 3, 5, 6, 9]);
    expect(screen.getByText("Gray · waiting / paused")).toBeInTheDocument();
  });

  it("leaves an entirely paused week gray within the same project envelope", () => {
    const result = computeSchedule(
      [{ ...mixed, frontend_devs: 0, frontend_weeks: 0 }],
      members,
      [9, 10, 11, 12, 13].map((day) => ({
        member_id: "back",
        date: `2026-02-${day.toString().padStart(2, "0")}`,
        is_working: false,
      })),
      parseISO("2026-02-02"),
      4
    );
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
    const container = screen.getByRole("group", {
      name: "Mixed: Feb 2, 2026 to Mar 6, 2026 · Pending",
    });
    const bars = screen.getAllByRole("img", { name: /^Mixed · Backend:/ });
    expect(bars).toHaveLength(2);
    expect(bars.every((bar) => bar.parentElement === container)).toBe(true);
    expect(container.parentElement).toHaveStyle({ gridColumn: "2 / 7" });
    expect(parseFloat(bars[0]!.style.width)).toBeCloseTo((5 / 33) * 100);
    expect(parseFloat(bars[1]!.style.left)).toBeCloseTo((14 / 33) * 100);
    expect(result.weeks[1]!.allocated).toBe(0);
  });

  it("connects work over a normal holiday without marking the role as stopped", () => {
    const result = computeSchedule(
      [{ ...mixed, backend_weeks: 1, frontend_devs: 0, frontend_weeks: 0 }],
      members,
      [],
      parseISO("2026-05-22"),
      3
    );
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
    expect(screen.getAllByRole("img", { name: /^Mixed · Backend:/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: /^Mixed · Backend:/ })).toHaveAccessibleName(
      /May 22, 2026 to May 29, 2026.*1.0 person-weeks/
    );
  });

  it("shows requested people without misrepresenting reduced available capacity", () => {
    renderSchedule([{ ...mixed, backend_devs: 2, backend_weeks: 1 }]);
    const backend = screen.getAllByRole("img", { name: /^Mixed · Backend:/ });
    expect(backend).toHaveLength(1);
    for (const bar of backend) {
      expect(bar).toHaveAccessibleName(/2 people requested · 2.0 person-weeks/);
    }
    expect(screen.getByRole("img", { name: /^Mixed · Frontend:/ })).toHaveAccessibleName(
      /1 person requested · 2.0 person-weeks/
    );
  });

  it("joins each role across weeks inside one full-span project bar", () => {
    renderSchedule([
      {
        ...mixed,
        id: "first",
        name: "Backend first",
        priority: 0,
        frontend_devs: 0,
        frontend_weeks: 0,
      },
      mixed,
    ]);
    const backend = screen.getAllByRole("img", { name: /^Mixed · Backend:/ });
    const frontend = screen.getAllByRole("img", { name: /^Mixed · Frontend:/ });
    expect(backend).toHaveLength(1);
    expect(frontend).toHaveLength(1);
    expect(backend[0]!.parentElement).toBe(frontend[0]!.parentElement);
    expect(backend[0]).toHaveStyle({ top: "0", height: "50%" });
    expect(frontend[0]).toHaveStyle({ top: "50%", height: "50%" });
    const container = screen.getByRole("group", {
      name: "Mixed: Feb 2, 2026 to Mar 13, 2026 · Pending",
    });
    expect(container.parentElement).toHaveStyle({ gridColumn: "2 / 8" });
    expect(parseFloat(backend[0]!.style.left)).toBeGreaterThan(parseFloat(frontend[0]!.style.left));
    expect(backend[0]).toHaveAccessibleName(
      "Mixed · Backend: Feb 16, 2026 to Feb 27, 2026 · 1 person requested · 2.0 person-weeks"
    );
    expect(frontend[0]).toHaveAccessibleName(
      "Mixed · Frontend: Feb 2, 2026 to Feb 13, 2026 · 1 person requested · 2.0 person-weeks"
    );
    expect(screen.getByText("Backend (top)")).toBeInTheDocument();
    expect(screen.getByText("Frontend (bottom)")).toBeInTheDocument();
  });

  it("uses full height for design and QA, with development between them", () => {
    renderSchedule([
      {
        ...mixed,
        backend_weeks: 1,
        frontend_weeks: 1,
        design_devs: 1,
        design_weeks: 1,
        qa_devs: 1,
        qa_weeks: 1,
      },
    ]);
    const design = screen.getByRole("img", { name: /^Mixed · Design:/ });
    const qa = screen.getByRole("img", { name: /^Mixed · QA:/ });
    expect(design.parentElement).toBe(qa.parentElement);
    expect(design).toHaveStyle({ top: "0", height: "100%" });
    expect(qa).toHaveStyle({ top: "0", height: "100%" });
    expect(screen.getByRole("img", { name: /^Mixed · Backend:/ })).toHaveStyle({
      top: "0",
      height: "50%",
    });
    expect(screen.getByRole("img", { name: /^Mixed · Frontend:/ })).toHaveStyle({
      top: "50%",
      height: "50%",
    });
  });

  it("positions successive phases within the same week without overlapping their bars", () => {
    const feature = {
      ...mixed,
      backend_weeks: 1,
      frontend_weeks: 0,
      frontend_devs: 0,
      design_devs: 1,
      design_weeks: 1,
      qa_devs: 1,
      qa_weeks: 1,
    };
    const vacations = members.flatMap((member) =>
      ["2026-02-07", "2026-02-08"].map((date) => ({
        member_id: member.id,
        date,
        is_working: true,
      }))
    );
    const result = computeSchedule([feature], members, vacations, parseISO("2026-02-02"), 3);
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
    const design = screen.getByRole("img", { name: /^Mixed · Design:/ });
    const backend = screen.getAllByRole("img", { name: /^Mixed · Backend:/ })[0]!;
    expect(design.parentElement).toBe(backend.parentElement);
    expect(parseFloat(design.style.left) + parseFloat(design.style.width)).toBeCloseTo(
      parseFloat(backend.style.left)
    );
  });

  it("keeps a frontend-only project's work in the bottom lane", () => {
    renderSchedule([{ ...mixed, backend_devs: 0, backend_weeks: 0 }]);
    expect(screen.queryByRole("img", { name: /Backend:/ })).not.toBeInTheDocument();
    for (const bar of screen.getAllByRole("img", { name: /^Mixed · Frontend:/ }))
      expect(bar).toHaveStyle({ top: "50%", height: "50%" });
  });

  it("shows actual work and explicit incompletion without inventing a finish date", () => {
    renderSchedule([mixed], 1);
    const work = screen.getAllByRole("img", { name: /^(Mixed ·|UAT:)/ });
    expect(work).toHaveLength(2);
    expect(work[0]).toHaveAccessibleName(/partial forecast/);
    expect(screen.getByText("Not completed within the verified planning horizon")).toHaveStyle({
      gridRow: "2",
    });
    expect(screen.getByRole("group", { name: /not completed/ })).toBeInTheDocument();
  });

  it("renders missing capacity explicitly, without any allocated bars", () => {
    const result = computeSchedule([mixed], [], [], parseISO("2026-02-02"), 2);
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
    expect(screen.getByText("No Backend, Frontend capacity")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^(Mixed ·|UAT:)/ })).not.toBeInTheDocument();
  });

  it("orders each row as drag handle, priority, status dot and name", () => {
    const result = computeSchedule([mixed], members, [], parseISO("2026-02-02"), 4);
    render(
      <GanttChart
        weeks={result.weeks}
        schedule={result.schedule}
        onReorder={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );
    const label = screen.getByLabelText("Schedule row: Mixed").firstElementChild!;
    expect(label).toHaveAttribute("draggable", "true");
    const parts = Array.from(label.children);
    expect(parts[0]).toHaveAccessibleName("Reorder Mixed");
    expect(parts[1]).toHaveTextContent("1");
    expect(parts[2]).toHaveAccessibleName("Change status of Mixed");
    expect(parts[3]).toHaveTextContent("Mixed");
  });

  it("keeps the status read-only for viewers and dims paused features", () => {
    renderSchedule([{ ...mixed, status: "paused" }]);
    expect(screen.getByRole("img", { name: "Status: Paused" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change status/ })).not.toBeInTheDocument();
    expect(screen.getByTitle("Mixed")).toHaveClass("opacity-50");
    expect(screen.getByRole("group", { name: /^Mixed:.* · Paused$/ }).parentElement).toHaveClass(
      "opacity-50"
    );
    expect(screen.getAllByRole("img", { name: /^Mixed · / }).length).toBeGreaterThan(0);
  });

  it("wraps titles and widens the name column from the shared display toolbar", async () => {
    renderSchedule([mixed]);
    expect(screen.getByTitle("Mixed")).toHaveClass("truncate");
    await userEvent.click(screen.getByRole("button", { name: "Wrap titles" }));
    expect(screen.getByTitle("Mixed")).toHaveClass("break-words");
    expect(screen.getByLabelText("Schedule row: Mixed")).toHaveStyle({
      gridTemplateColumns: "220px repeat(6, minmax(28px, 1fr))",
    });
    await userEvent.click(screen.getByRole("button", { name: "Full width" }));
    expect(screen.getByLabelText("Schedule row: Mixed")).toHaveStyle({
      gridTemplateColumns: "300px repeat(6, minmax(28px, 1fr))",
    });
  });

  it("draws light weekly lines and a stronger line where a new month starts", () => {
    const { weeks } = renderSchedule([mixed], 6);
    const lines = document.querySelectorAll<HTMLElement>("[data-guide]");
    expect(lines).toHaveLength(weeks.length - 1);
    const month = document.querySelectorAll<HTMLElement>('[data-guide="month"]');
    expect(month).toHaveLength(1);
    expect(parseFloat(month[0]!.style.left)).toBeCloseTo((4 / weeks.length) * 100);
  });
});
