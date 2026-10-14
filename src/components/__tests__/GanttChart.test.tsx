import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseISO } from "date-fns";
import GanttChart from "@/components/organisms/gantt-chart";
import { computeSchedule } from "@/lib/planning";
import { EMPTY_PROJECT, type PlannerMember, type Project } from "@/types/planner";

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
const mixed: Project = {
  ...EMPTY_PROJECT,
  id: "mixed",
  workspace_id: "workspace",
  name: "Mixed",
  in_backlog: true,
  priority: 1,
  backend_devs: 1,
  backend_weeks: 2,
  frontend_devs: 1,
  frontend_weeks: 2,
};

function renderSchedule(projects: Project[], horizon = 6) {
  const result = computeSchedule(projects, members, [], parseISO("2026-02-02"), horizon);
  render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
  return result;
}

describe("role-aware Gantt allocations", () => {
  it("stacks simultaneous two-week roles inside one 24px project bar without weekly breaks", () => {
    renderSchedule([mixed]);
    const container = screen.getByRole("group", { name: "Mixed: Feb 2, 2026 to Feb 13, 2026" });
    const backend = screen.getByRole("img", { name: /^Mixed · Backend:/ });
    const frontend = screen.getByRole("img", { name: /^Mixed · Frontend:/ });
    for (const bar of [backend, frontend]) {
      expect(bar.parentElement).toBe(container);
      expect(bar).toHaveStyle({ left: "0%", width: "100%", height: "50%" });
      expect(bar).toBeEmptyDOMElement();
    }
    expect(container.parentElement!.parentElement).toHaveStyle({ gridTemplateRows: "32px" });
    expect(backend).toHaveStyle({ top: "0" });
    expect(frontend).toHaveStyle({ top: "50%" });
    expect(container.parentElement).toHaveStyle({ gridColumn: "2 / 4" });
    expect(parseFloat(container.style.width)).toBeCloseTo((12 / 14) * 100);
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
    const container = screen.getByRole("group", { name: "Mixed: Feb 2, 2026 to Feb 9, 2026" });
    const bars = screen.getAllByRole("img", { name: /^Mixed · Backend:/ });
    expect(bars).toHaveLength(2);
    expect(container).toHaveClass("bg-slate-400/40");
    expect(bars[0]).toHaveStyle({ left: "0%", width: "25%" });
    expect(bars[1]).toHaveStyle({ left: "37.5%", width: "62.5%" });
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
    const container = screen.getByRole("group", { name: "Mixed: Feb 2, 2026 to Feb 20, 2026" });
    const bars = screen.getAllByRole("img", { name: /^Mixed · Backend:/ });
    expect(bars).toHaveLength(2);
    expect(bars.every((bar) => bar.parentElement === container)).toBe(true);
    expect(container.parentElement).toHaveStyle({ gridColumn: "2 / 5" });
    expect(parseFloat(bars[0]!.style.width)).toBeCloseTo((5 / 19) * 100);
    expect(parseFloat(bars[1]!.style.left)).toBeCloseTo((14 / 19) * 100);
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
    const container = screen.getByRole("group", { name: "Mixed: Feb 2, 2026 to Feb 27, 2026" });
    expect(container.parentElement).toHaveStyle({ gridColumn: "2 / 6" });
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
    const project = {
      ...mixed,
      backend_weeks: 1,
      frontend_weeks: 0,
      frontend_devs: 0,
      design_devs: 1,
      design_weeks: 1,
      qa_devs: 1,
      qa_weeks: 1,
    };
    const availability = members.flatMap((member) =>
      ["2026-02-07", "2026-02-08"].map((date) => ({
        member_id: member.id,
        date,
        is_working: true,
      }))
    );
    const result = computeSchedule([project], members, availability, parseISO("2026-02-02"), 3);
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
    for (const bar of screen.getAllByRole("img"))
      expect(bar).toHaveStyle({ top: "50%", height: "50%" });
  });

  it("shows actual work and explicit incompletion without inventing a finish date", () => {
    renderSchedule([mixed], 1);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getAllByRole("img")[0]).toHaveAccessibleName(/partial forecast/);
    expect(screen.getByText("Not completed within the verified planning horizon")).toHaveStyle({
      gridRow: "2",
    });
    expect(screen.getByRole("group", { name: /not completed/ })).toBeInTheDocument();
  });

  it("renders missing capacity explicitly, without any allocated bars", () => {
    const result = computeSchedule([mixed], [], [], parseISO("2026-02-02"), 2);
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
    expect(screen.getByText("No Backend, Frontend capacity")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
