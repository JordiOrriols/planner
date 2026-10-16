import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button, EmptyState, Modal } from "@jordiorriols/ui";
import { GanttChartSquare, Plus, Pencil } from "@jordiorriols/ui/icons";
import { PlanSummaryCard } from "@/components/molecules/plan-summary-card";
import { Link } from "react-router-dom";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import GanttChart from "@/components/organisms/gantt-chart";
import { computeSchedule, parseDate, fmtDate } from "@/lib/planning";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";

export default function Backlog() {
  const { t } = useTranslation();

  const { features, projects, members, vacations, workspace, canEdit, refresh } = useWorkspace();
  const { repository } = useData();
  const action = useAsyncAction();
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const startDate = draftStart ?? workspace.plan_start_date;
  const [adding, setAdding] = useState(false);
  const availableFeatures = features.filter((feature) => !feature.in_backlog);
  if (!repository) throw new Error(t("roadmap.errors.signInRequired"));
  const backlog = [...features]
    .filter((feature) => feature.in_backlog)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  let result: ReturnType<typeof computeSchedule> | null = null;
  let error: string | null = null;
  try {
    result = computeSchedule(backlog, members, vacations, parseDate(startDate));
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const completed = result?.schedule.filter((item) => item.complete) ?? [];
  const finish = completed.reduce<Date | null>(
    (latest, item) => (item.end && (!latest || item.end > latest) ? item.end : latest),
    null
  );
  function move(fromId: string, toId: string) {
    const ids = backlog.map((feature) => feature.id);
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
    if (!repository) throw new Error(t("roadmap.errors.signInRequired"));
    void action.run(async () => {
      await repository.toggleBacklog(workspace.id, id, included);
      await refresh();
    });
  }
  function deliver(id: string, delivered: boolean) {
    if (!repository) throw new Error(t("roadmap.errors.signInRequired"));
    void action.run(async () => {
      await repository.setDelivered(workspace.id, id, delivered);
      await refresh();
    });
  }
  function changeStart(date: string) {
    setDraftStart(date);
    void action.run(async () => {
      if (!repository || !canEdit) throw new Error(t("roadmap.errors.editAccessRequired"));
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
          <h1 className="font-heading text-2xl font-semibold">{t("roadmap.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("roadmap.description")}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {t("roadmap.actions.addFeature")}
          </Button>
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <PlanSummaryCard
          label={t("roadmap.metrics.squadSize")}
          value={t("roadmap.metrics.peopleCount", { count: members.length })}
        />
        <PlanSummaryCard
          label={t("roadmap.dates.start")}
          value={fmtDate(parseDate(workspace.plan_start_date))}
          action={
            canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={
                  editingStart ? t("roadmap.dates.cancelEditing") : t("roadmap.dates.editStart")
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
              aria-label={t("roadmap.dates.start")}
              min="2026-01-01"
              max="2027-12-31"
              value={startDate}
              disabled={!canEdit || action.busy}
              onChange={(event) => changeStart(event.target.value)}
            />
          ) : undefined}
        </PlanSummaryCard>
        <PlanSummaryCard
          label={t("roadmap.dates.finish")}
          value={
            completed.length === backlog.length && finish
              ? fmtDate(finish)
              : t("roadmap.dates.incomplete")
          }
        />
      </div>
      {(error || action.error) && (
        <p role="alert" className="text-destructive">
          {error ?? action.error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("roadmap.calendarNotice")}</p>
      {result?.calendarLimited && <p role="status">{t("roadmap.calendarLimitNotice")}</p>}
      {!backlog.length ? (
        <EmptyState
          icon={<GanttChartSquare />}
          title={t("roadmap.empty.title")}
          description={
            canEdit
              ? t("roadmap.empty.editableDescription")
              : t("roadmap.empty.readOnlyDescription")
          }
          action={
            canEdit && (
              <Button onClick={() => setAdding(true)}>{t("roadmap.actions.addFeature")}</Button>
            )
          }
        />
      ) : (
        <section className="panel" aria-label={t("roadmap.schedule.label")}>
          <h2 className="font-semibold mb-4">
            {t("roadmap.schedule.summary", {
              completedFeatures: completed.length,
              totalFeatures: backlog.length,
            })}
          </h2>
          <GanttChart
            projects={projects}
            weeks={result?.weeks ?? []}
            schedule={
              result?.schedule ??
              backlog.map((feature) => ({
                feature,
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
          title={t("roadmap.addFeature.title")}
          description={t("roadmap.addFeature.description")}
          closeLabel={t("common.actions.close")}
          onOpenChange={(open) => {
            if (!open && !action.busy) setAdding(false);
          }}
        >
          {action.error && (
            <p role="alert" className="text-destructive">
              {action.error}
            </p>
          )}
          {availableFeatures.length ? (
            <ul className="max-h-[50vh] overflow-y-auto space-y-2">
              {availableFeatures.map((feature) => (
                <li
                  key={feature.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="font-medium">{feature.name}</span>
                  <Button
                    size="sm"
                    disabled={action.busy}
                    aria-label={t("roadmap.addFeature.addLabel", { featureName: feature.name })}
                    onClick={() => toggle(feature.id, true)}
                  >
                    {t("roadmap.actions.addFeature")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {features.length
                ? t("roadmap.addFeature.allIncluded")
                : t("roadmap.addFeature.noEstimates")}
            </p>
          )}
          <Link
            to="/"
            className="inline-flex mt-4 text-sm text-primary underline underline-offset-4"
          >
            {t("roadmap.addFeature.create")}
          </Link>
        </Modal>
      )}
    </div>
  );
}
