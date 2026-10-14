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
  it("shows requested people without misrepresenting reduced available capacity", () => {
    renderSchedule([{ ...mixed, backend_devs: 2, backend_weeks: 1 }]);
    const backend = screen.getAllByRole("img", { name: /^Mixed · Backend:/ });
    expect(backend).toHaveLength(2);
    for (const bar of backend) {
      expect(bar).toHaveTextContent("B2");
      expect(bar).toHaveAccessibleName(/2 people requested · 1.0 person-weeks/);
    }
    for (const bar of screen.getAllByRole("img", { name: /^Mixed · Frontend:/ }))
      expect(bar).toHaveTextContent("F1");
  });

  it("renders independently delayed backend and frontend work instead of one full-span bar", () => {
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
    expect(backend).toHaveLength(2);
    expect(frontend).toHaveLength(2);
    expect(backend.map((bar) => bar.parentElement!.style.gridColumn)).toEqual(["4", "5"]);
    expect(frontend.map((bar) => bar.parentElement!.style.gridColumn)).toEqual(["2", "3"]);
    for (const bar of backend) expect(bar.parentElement).toHaveStyle({ gridRow: "1" });
    for (const bar of frontend) expect(bar.parentElement).toHaveStyle({ gridRow: "2" });
    expect(backend[0]).toHaveAccessibleName(
      "Mixed · Backend: Feb 16, 2026 to Feb 20, 2026 · 1 person requested · 1.0 person-weeks"
    );
    expect(frontend[0]).toHaveAccessibleName(
      "Mixed · Frontend: Feb 2, 2026 to Feb 6, 2026 · 1 person requested · 1.0 person-weeks"
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
    expect(design.parentElement).toHaveStyle({ gridRow: "1 / 3", gridColumn: "2" });
    expect(qa.parentElement).toHaveStyle({ gridRow: "1 / 3", gridColumn: "4" });
    expect(screen.getByRole("img", { name: /^Mixed · Backend:/ }).parentElement).toHaveStyle({
      gridRow: "1",
      gridColumn: "3",
    });
    expect(screen.getByRole("img", { name: /^Mixed · Frontend:/ }).parentElement).toHaveStyle({
      gridRow: "2",
      gridColumn: "3",
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
    expect(design.parentElement!.style.gridColumn).toBe(backend.parentElement!.style.gridColumn);
    expect(parseFloat(design.style.left) + parseFloat(design.style.width)).toBeCloseTo(
      parseFloat(backend.style.left)
    );
  });

  it("keeps a frontend-only project's work in the bottom lane", () => {
    renderSchedule([{ ...mixed, backend_devs: 0, backend_weeks: 0 }]);
    expect(screen.queryByRole("img", { name: /Backend:/ })).not.toBeInTheDocument();
    for (const bar of screen.getAllByRole("img"))
      expect(bar.parentElement).toHaveStyle({ gridRow: "2" });
  });

  it("shows actual work and explicit incompletion without inventing a finish date", () => {
    renderSchedule([mixed], 1);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getAllByRole("img")[0]).toHaveAccessibleName(/partial forecast/);
    expect(screen.getByText("Not completed within the verified planning horizon")).toHaveStyle({
      gridRow: "3",
    });
    expect(screen.getAllByText(/Not completed/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Mixed · Backend").parentElement).toHaveTextContent("Not completed");
  });

  it("renders missing capacity explicitly, without any allocated bars", () => {
    const result = computeSchedule([mixed], [], [], parseISO("2026-02-02"), 2);
    render(<GanttChart weeks={result.weeks} schedule={result.schedule} />);
    expect(screen.getByText("No Backend, Frontend capacity")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
