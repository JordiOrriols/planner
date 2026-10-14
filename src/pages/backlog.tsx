import React, { useState } from "react";
import { Button, EmptyState, Modal } from "@jordiorriols/ui";
import { GanttChartSquare, Plus } from "@jordiorriols/ui/icons";
import { Link } from "react-router-dom";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import GanttChart from "@/components/organisms/gantt-chart";
import { computeSchedule, parseDate, fmtDate } from "@/lib/planning";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";

export default function Backlog() {
  const { projects, members, availability, workspace, canEdit, refresh } = useWorkspace();
  const { repository } = useData();
  const action = useAsyncAction();
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const startDate = draftStart ?? workspace.plan_start_date;
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
  function move(fromId: string, toId: string) {
    const ids = backlog.map((project) => project.id);
    const from = ids.indexOf(fromId),
      to = ids.indexOf(toId);
    if (!repository || action.busy || from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, fromId);
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
  function deliver(id: string, delivered: boolean) {
    if (!repository) throw new Error("Sign in to manage the backlog");
    void action.run(async () => {
      await repository.setDelivered(workspace.id, id, delivered);
      await refresh();
    });
  }
  function changeStart(date: string) {
    setDraftStart(date);
    void action.run(async () => {
      if (!repository || !canEdit)
        throw new Error("Workspace edit access is required to change the plan start.");
      try {
        await repository.setPlanStart(workspace.id, date);
        await refresh();
      } finally {
        setDraftStart(null);
      }
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
        {canEdit && (
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
            disabled={!canEdit || action.busy}
            onChange={(event) => changeStart(event.target.value)}
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
            canEdit
              ? "Choose which estimates to include in this plan."
              : "Workspace owners and editors select projects for this plan."
          }
          action={canEdit && <Button onClick={() => setAdding(true)}>Add projects</Button>}
        />
      ) : (
        <section className="panel" aria-label="Project schedule">
          <h2 className="font-semibold mb-4">
            Schedule · {completed.length}/{backlog.length} completed in forecast
          </h2>
          <GanttChart
            weeks={result?.weeks ?? []}
            schedule={
              result?.schedule ??
              backlog.map((project) => ({
                project,
                startIdx: null,
                endIdx: null,
                start: null,
                end: null,
                reason: error,
                complete: false,
                roles: [],
              }))
            }
            {...(canEdit
              ? {
                  onReorder: move,
                  onRemove: (id: string) => toggle(id, false),
                  onDeliveredChange: deliver,
                }
              : {})}
            disabled={action.busy}
          />
        </section>
      )}
      {canEdit && adding && (
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
