import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Calculator, GanttChartSquare, CalendarDays } from "@jordiorriols/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";

const NAV = [
  { to: "/", label: "Estimation", icon: Calculator, end: true },
  { to: "/backlog", label: "Backlog Plan", icon: GanttChartSquare, end: false },
  { to: "/vacations", label: "Vacations", icon: CalendarDays, end: false },
];

export default function AppLayout() {
  const { signOut } = useData();
  const { workspace, workspaces, selectWorkspace, isOwner, createWorkspace } = useWorkspace();
  const action = useAsyncAction();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 min-h-16 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand grid place-items-center">
              <GanttChartSquare className="h-4 w-4 text-brand-foreground" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <div className="font-heading font-semibold tracking-tight text-[15px]">Cadence</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">
                Project estimation &amp; planning
              </div>
            </div>
          </div>
          <nav aria-label="Planner pages" className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex gap-2 items-center">
            <select
              aria-label="Workspace"
              value={workspace.id}
              onChange={(event) => selectWorkspace(event.target.value)}
              className="field max-w-40"
            >
              {workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{isOwner ? "Owner" : "Member"}</span>
            <Button variant="ghost" onClick={createWorkspace}>
              New workspace
            </Button>
            <Button variant="ghost" disabled={action.busy} onClick={() => void action.run(signOut)}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      {action.error && (
        <p role="alert" className="px-6 text-destructive">
          {action.error}
        </p>
      )}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
