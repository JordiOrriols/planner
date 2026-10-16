import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button, EmptyState, Modal } from "@jordiorriols/ui";
import { GanttChartSquare, Plus, Pencil } from "@jordiorriols/ui/icons";
import { PlanDateCard } from "@/components/molecules/plan-date-card";
import { Link } from "react-router-dom";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import GanttChart from "@/components/organisms/gantt-chart";
import { computeSchedule, parseDate, fmtDate } from "@/lib/planning";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";

export default function Backlog() {
  const { t } = useTranslation();

  const { projects, members, availability, workspace, canEdit, refresh } = useWorkspace();
  const { repository } = useData();
  const action = useAsyncAction();
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const startDate = draftStart ?? workspace.plan_start_date;
  const [adding, setAdding] = useState(false);
  const availableProjects = projects.filter((project) => !project.in_backlog);
  if (!repository) throw new Error(t("copy.signInToManageTheRoadmap"));
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
    if (!repository) throw new Error(t("copy.signInToManageTheRoadmap"));
    void action.run(async () => {
      await repository.toggleBacklog(workspace.id, id, included);
      await refresh();
    });
  }
  function deliver(id: string, delivered: boolean) {
    if (!repository) throw new Error(t("copy.signInToManageTheRoadmap"));
    void action.run(async () => {
      await repository.setDelivered(workspace.id, id, delivered);
      await refresh();
    });
  }
  function changeStart(date: string) {
    setDraftStart(date);
    void action.run(async () => {
      if (!repository || !canEdit)
        throw new Error(t("copy.workspaceEditAccessIsRequiredToChangeThe"));
      try {
        await repository.setPlanStart(workspace.id, date);
        await refresh();
        setEditingStart(false);
      } finally {
        setDraftStart(null);
      }
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-end">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{t("copy.roadmap")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("copy.priorityAllocatesAvailablePeopleByRoleEachDay")}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {t("copy.addFeature")}
          </Button>
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="panel">
          <p className="text-xs text-muted-foreground">{t("copy.squadSize")}</p>
          <p className="font-semibold">{t("copy.peopleCount", { count: members.length })}</p>
        </div>
        <PlanDateCard
          label={t("copy.planStarts")}
          value={fmtDate(parseDate(workspace.plan_start_date))}
          action={
            canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={
                  editingStart ? t("copy.cancelEditingPlanStart") : t("copy.editPlanStart")
                }
                disabled={action.busy}
                onClick={() => setEditingStart((editing) => !editing)}
              >
                <Pencil className="size-3.5" />
              </Button>
            )
          }
        >
          {editingStart ? (
            <input
              id="plan-start"
              className="field mt-1"
              type="date"
              aria-label={t("copy.planStarts")}
              min="2026-01-01"
              max="2027-12-31"
              value={startDate}
              disabled={!canEdit || action.busy}
              onChange={(event) => changeStart(event.target.value)}
            />
          ) : undefined}
        </PlanDateCard>
        <PlanDateCard
          label={t("copy.roadmapFinishes")}
          value={
            completed.length === backlog.length && finish
              ? fmtDate(finish)
              : t("copy.notFullyScheduled")
          }
        />
      </div>
      {(error || action.error) && (
        <p role="alert" className="text-destructive">
          {error ?? action.error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("copy.barcelonaHolidaysVerifiedFor20262027APerson")}
      </p>
      {result?.calendarLimited && <p role="status">{t("copy.theForecastStopsAtTheEndOfThe")}</p>}
      {!backlog.length ? (
        <EmptyState
          icon={<GanttChartSquare />}
          title={t("copy.noFeaturesOnTheRoadmap")}
          description={
            canEdit
              ? t("copy.chooseWhichFeaturesToPrioritizeOnThisRoadmap")
              : t("copy.workspaceOwnersAndEditorsPrioritizeFeaturesOnThis")
          }
          action={
            canEdit && <Button onClick={() => setAdding(true)}>{t("copy.addFeature")}</Button>
          }
        />
      ) : (
        <section className="panel" aria-label={t("copy.featureSchedule")}>
          <h2 className="font-semibold mb-4">
            {t("copy.forecastCompleted", { completed: completed.length, total: backlog.length })}
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
          title={t("copy.addFeatureToRoadmap")}
          description={t("copy.chooseExistingFeaturesAddingAFeaturePlacesIt")}
          closeLabel={t("copy.close")}
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
                    aria-label={t("copy.addFeatureToRoadmap2", { value1: project.name })}
                    onClick={() => toggle(project.id, true)}
                  >
                    {t("copy.addFeature")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {projects.length
                ? t("copy.allFeaturesAreAlreadyOnTheRoadmap")
                : t("copy.createAFeatureFirstThenAddItTo")}
            </p>
          )}
          <Link
            to="/"
            className="inline-flex mt-4 text-sm text-primary underline underline-offset-4"
          >
            {t("copy.createANewFeature")}
          </Link>
        </Modal>
      )}
    </div>
  );
}
