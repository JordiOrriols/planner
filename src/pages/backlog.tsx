import React, { useState } from "react";
import { Button, EmptyState, Modal } from "@jordiorriols/ui";
import { ArrowUp, ArrowDown, GanttChartSquare, Plus, X } from "@jordiorriols/ui/icons";
import { Link } from "react-router-dom";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { format } from "date-fns";
import GanttChart from "@/components/organisms/gantt-chart";
import { computeSchedule, parseDate, fmtDate } from "@/lib/planning";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";

export default function Backlog() {
  const { projects, members, availability, workspace, isOwner, refresh } = useWorkspace();
  const { repository } = useData();
  const action = useAsyncAction();
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [adding, setAdding] = useState(false);
  const availableProjects = projects.filter((project) => !project.in_backlog);
  if (!repository) throw new Error("Sign in to manage the backlog");
  const backlog = [...projects]
    .filter((project) => project.in_backlog)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  let result: ReturnType<typeof computeSchedule> | null = null;
  let error: string | null = null;
  try {
    result = computeSchedule(backlog, members, availability, parseDate(startDate));
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const completed = result?.schedule.filter((item) => item.complete) ?? [];
  const finish = completed.reduce<Date | null>(
    (latest, item) => (item.end && (!latest || item.end > latest) ? item.end : latest),
    null
  );
  function move(index: number, direction: number) {
    const ids = backlog.map((project) => project.id);
    const first = ids[index],
      second = ids[index + direction];
    if (!repository || !first || !second) return;
    ids[index] = second;
    ids[index + direction] = first;
    void action.run(async () => {
      await repository.reorder(workspace.id, ids);
      await refresh();
    });
  }
  function toggle(id: string, included: boolean) {
    if (!repository) throw new Error("Sign in to manage the backlog");
    void action.run(async () => {
      await repository.toggleBacklog(workspace.id, id, included);
      await refresh();
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-end">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Backlog plan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Priority allocates available people by role each day. Roles and projects overlap when
            capacity allows.
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add projects
          </Button>
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="panel">
          <p className="text-xs text-muted-foreground">Squad size</p>
          <p className="font-semibold">{members.length} people</p>
        </div>
        <div className="panel">
          <label htmlFor="plan-start" className="text-xs text-muted-foreground">
            Plan starts
          </label>
          <input
            id="plan-start"
            className="field mt-1"
            type="date"
            min="2026-01-01"
            max="2027-12-31"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="panel">
          <p className="text-xs text-muted-foreground">Backlog finishes</p>
          <p className="font-semibold">
            {completed.length === backlog.length && finish
              ? fmtDate(finish)
              : "Not fully scheduled"}
          </p>
        </div>
      </div>
      {(error || action.error) && (
        <p role="alert" className="text-destructive">
          {error ?? action.error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Barcelona holidays verified for 2026–2027. A person-week is five working days; vacations
        extend the forecast. Estimates are not delivery commitments.
      </p>
      {result?.calendarLimited && (
        <p role="status">The forecast stops at the end of the verified holiday calendar.</p>
      )}
      {!backlog.length ? (
        <EmptyState
          icon={<GanttChartSquare />}
          title="No projects in the backlog"
          description={
            isOwner
              ? "Choose which estimates to include in this plan."
              : "The workspace owner selects projects for this plan."
          }
          action={isOwner && <Button onClick={() => setAdding(true)}>Add projects</Button>}
        />
      ) : (
        <>
          <ol className="space-y-2">
            {backlog.map((project, index) => (
              <li key={project.id} className="panel !p-3 flex items-center gap-3">
                <span className="text-muted-foreground text-sm">{index + 1}</span>
                <span className="flex-1 font-medium">{project.name}</span>
                {isOwner && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${project.name} up`}
                      disabled={action.busy || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${project.name} down`}
                      disabled={action.busy || index === backlog.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove from backlog: ${project.name}`}
                      disabled={action.busy}
                      onClick={() => toggle(project.id, false)}
                    >
                      <X size={16} />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ol>
          {result && (
            <section className="panel" aria-label="Project schedule">
              <h2 className="font-semibold mb-4">
                Schedule · {completed.length}/{backlog.length} completed in forecast
              </h2>
              <GanttChart weeks={result.weeks} schedule={result.schedule} />
            </section>
          )}
        </>
      )}
      {isOwner && adding && (
        <Modal
          isOpen
          title="Add projects to backlog"
          description="Choose existing estimates. Adding a project places it at the end of the priority list."
          closeLabel="Close"
          onOpenChange={(open) => {
            if (!open && !action.busy) setAdding(false);
          }}
        >
          {action.error && (
            <p role="alert" className="text-destructive">
              {action.error}
            </p>
          )}
          {availableProjects.length ? (
            <ul className="max-h-[50vh] overflow-y-auto space-y-2">
              {availableProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="font-medium">{project.name}</span>
                  <Button
                    size="sm"
                    disabled={action.busy}
                    aria-label={`Add to backlog: ${project.name}`}
                    onClick={() => toggle(project.id, true)}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {projects.length
                ? "All estimates are already in the backlog."
                : "Create an estimate first, then choose it for the plan."}
            </p>
          )}
          <Link
            to="/"
            className="inline-flex mt-4 text-sm text-primary underline underline-offset-4"
          >
            Create a new estimate
          </Link>
        </Modal>
      )}
    </div>
  );
}
