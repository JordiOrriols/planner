import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  PublicAppShell,
  AppSkeleton,
  AuthDialog,
  Button,
  ErrorState,
  IconTooltip,
  NameDialog,
  SelectField,
} from "@jordiorriols/ui";
import { GripVertical } from "@jordiorriols/ui/icons";
import { useAsyncAction, useNameForm } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useAuthDialogProps } from "@/components/molecules/LoginDialog";
import { FeatureDependencies } from "@/components/molecules/feature-dependencies";
import { reorderPriority, validatePriorityOrder } from "@/lib/featureDependencies";
import { differenceInCalendarDays, addWeeks } from "date-fns";
import { createPlannerRepository } from "@/data/plannerRepository";
import { supabase } from "@/data/supabaseClient";
import { fmtDate, getMonday, parseDate } from "@/lib/planning";
import { cn } from "@/lib/utils";
import { useMarkerVisibility, useRoadmapDisplay } from "@/lib/roadmapDisplay";
import {
  FeatureTitle,
  ProjectGroupHeading,
  RoadmapDisplayToolbar,
  STATUS_COLORS,
  StatusLegend,
  RoadmapTimelineCard,
  useLabelWidth,
} from "@/components/organisms/roadmap-timeline";
import type { PublicRoadmap } from "@/lib/publicRoadmap";

const repository = supabase ? createPlannerRepository(supabase) : null;

export function PublicRoadmapView({
  roadmap,
  onMove,
  disabled = false,
}: {
  roadmap: PublicRoadmap;
  onMove?: (from: string, to: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const labelWidth = useLabelWidth();
  const markerVisibility = useMarkerVisibility(true);
  const start = getMonday(parseDate(roadmap.startDate));
  const last = roadmap.features.reduce((latest, item) => {
    const end = item.end ?? item.start;
    return end && parseDate(end) > latest ? parseDate(end) : latest;
  }, start);
  const count = Math.max(4, Math.ceil((differenceInCalendarDays(last, start) + 1) / 7));
  const weekStarts = Array.from({ length: count }, (_, index) => addWeeks(start, index));
  const groupByProject = roadmap.features.some((feature) => !!feature.project);
  const [dragged, setDragged] = useState<string | null>(null);
  const lockedUntil = roadmap.features.reduce(
    (last, feature, index) =>
      feature.status === "done" || feature.status === "in_progress" ? index : last,
    -1
  );
  return (
    <section className="panel space-y-4" aria-label={t("publicRoadmap.title")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <StatusLegend />
        <span className="ml-auto flex flex-wrap gap-1">
          <RoadmapDisplayToolbar markerVisibility={markerVisibility} />
        </span>
      </div>
      {!roadmap.features.length ? (
        <p>{t("publicRoadmap.empty")}</p>
      ) : (
        <RoadmapTimelineCard
          aria-label={t("roadmap.schedule.label")}
          weekStarts={weekStarts}
          labelWidth={labelWidth}
          minWidth={640}
          columnWidth={32}
          labelTitle={t("common.feature")}
          columnTitle={t("common.weekOf")}
          markers={markerVisibility.visible ? roadmap.markers : []}
          className="border-0 p-0"
        >
          {roadmap.features.map((item, index) => {
            const from = item.start ? parseDate(item.start) : null;
            const to = item.end ? parseDate(item.end) : null;
            const paused = item.status === "paused";
            const label =
              from && to
                ? t("publicRoadmap.span", {
                    name: item.name,
                    start: fmtDate(from),
                    end: fmtDate(to),
                    status: t(`featureStatus.${item.status}`),
                  })
                : "";
            return (
              <React.Fragment key={item.id ?? index}>
                {groupByProject &&
                  (index === 0 || item.project !== roadmap.features[index - 1]?.project) && (
                    <ProjectGroupHeading name={item.project} labelWidth={labelWidth} />
                  )}
                <div
                  className="grid border-b border-border/60"
                  style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr)` }}
                >
                  <div
                    className="sticky left-0 z-10 flex min-w-0 overflow-hidden items-center gap-1.5 bg-card px-2 py-2"
                    draggable={!!onMove && !!item.id && index > lockedUntil && !disabled}
                    onDragStart={() => setDragged(item.id ?? null)}
                    onDragEnd={() => setDragged(null)}
                    onDragOver={(event) => {
                      if (onMove && dragged && index > lockedUntil && !disabled)
                        event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (
                        onMove &&
                        dragged &&
                        item.id &&
                        dragged !== item.id &&
                        index > lockedUntil &&
                        !disabled
                      )
                        onMove(dragged, item.id);
                      setDragged(null);
                    }}
                  >
                    {onMove && item.id && index > lockedUntil && (
                      <IconTooltip label={t("gantt.row.reorderHelp", { featureName: item.name })}>
                        <button
                          type="button"
                          className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50"
                          aria-label={t("gantt.row.reorder", { featureName: item.name })}
                          disabled={disabled}
                          onKeyDown={(event) => {
                            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                            event.preventDefault();
                            const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);
                            const target = roadmap.features[targetIndex]?.id;
                            if (!disabled && targetIndex > lockedUntil && target && item.id)
                              onMove(item.id, target);
                          }}
                        >
                          <GripVertical className="size-3.5" />
                        </button>
                      </IconTooltip>
                    )}
                    <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className={cn("min-w-0 flex-1", paused && "opacity-50")}>
                      <FeatureTitle name={item.name} className="block text-sm font-medium" />
                      <FeatureDependencies
                        ids={item.dependency_ids ?? []}
                        features={roadmap.features}
                      />
                    </div>
                  </div>
                  <div className="relative flex min-h-12 items-center">
                    {from && to ? (
                      <div
                        role="img"
                        aria-label={label}
                        title={label}
                        className={cn(
                          "absolute h-6 rounded",
                          STATUS_COLORS[item.status],
                          paused && "opacity-50"
                        )}
                        style={{
                          left: `${(differenceInCalendarDays(from, start) / (count * 7)) * 100}%`,
                          width: `${((differenceInCalendarDays(to, from) + 1) / (count * 7)) * 100}%`,
                        }}
                      />
                    ) : (
                      <p className="relative px-3 text-xs text-muted-foreground">
                        {t("publicRoadmap.unscheduled")}
                      </p>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </RoadmapTimelineCard>
      )}
      <p className="text-xs text-muted-foreground">{t("publicRoadmap.forecastNotice")}</p>
    </section>
  );
}

function PriorityProposals({ token, official }: { token: string; official: PublicRoadmap }) {
  const { t } = useTranslation();
  const { user } = useData();
  const auth = useAuthDialogProps();
  const action = useAsyncAction();
  const [preview, setPreview] = useState<PublicRoadmap | null>(null);
  const [selected, setSelected] = useState("");
  const [comparison, setComparison] = useState("");
  const [naming, setNaming] = useState(false);
  const [login, setLogin] = useState(false);
  const proposals = useQuery({
    queryKey: ["priority-proposals", token],
    queryFn: () => {
      if (!repository) throw new Error(t("publicRoadmap.unavailable"));
      return repository.listPriorityProposals(token);
    },
    retry: false,
    refetchInterval: 60_000,
  });
  const saved = useQuery({
    queryKey: ["priority-proposal", token, selected],
    enabled: !!selected,
    queryFn: () => {
      if (!repository) throw new Error(t("publicRoadmap.unavailable"));
      return repository.loadRoadmapLink(token, { proposal: selected });
    },
  });
  const compared = useQuery({
    queryKey: ["priority-proposal", token, comparison],
    enabled: !!comparison && comparison !== "official",
    queryFn: () => {
      if (!repository) throw new Error(t("publicRoadmap.unavailable"));
      return repository.loadRoadmapLink(token, { proposal: comparison });
    },
  });
  const roadmap = selected ? saved.data : (preview ?? official);
  const form = useNameForm({
    isOpen: naming,
    onClose: () => setNaming(false),
    onSubmit: async (name) => {
      if (!repository || !user || !roadmap) throw new Error(t("priorityProposals.signIn"));
      const ids = roadmap.features.map((feature) => {
        if (!feature.id) throw new Error(t("priorityProposals.changed"));
        return feature.id;
      });
      if (!roadmap.revision) throw new Error(t("priorityProposals.changed"));
      const id = await repository.savePriorityProposal(token, name, ids, roadmap.revision);
      await proposals.refetch();
      setSelected(id);
      setPreview(null);
    },
  });
  function move(from: string, to: string) {
    if (!roadmap || action.busy) return;
    void action.run(async () => {
      if (!repository) throw new Error(t("publicRoadmap.unavailable"));
      const features = roadmap.features.map((feature) => {
        if (!feature.id) throw new Error(t("priorityProposals.changed"));
        return { ...feature, id: feature.id, dependency_ids: feature.dependency_ids ?? [] };
      });
      const ids = reorderPriority(features, from, to, true);
      if (!roadmap.revision) throw new Error(t("priorityProposals.changed"));
      setPreview(
        await repository.loadRoadmapLink(token, {
          featureIds: ids,
          expectedRevision: roadmap.revision,
        })
      );
    });
  }
  const options = (proposals.data ?? []).map((proposal) => ({
    value: proposal.id,
    label: proposal.name,
  }));
  const comparisonRoadmap = comparison === "official" ? official : compared.data;
  const viewName = selected
    ? options.find((option) => option.value === selected)?.label
    : t(preview ? "priorityProposals.experiment" : "priorityProposals.official");
  const comparisonName =
    comparison === "official"
      ? t("priorityProposals.official")
      : options.find((option) => option.value === comparison)?.label;
  return (
    <section className="space-y-4" aria-label={t("priorityProposals.title")}>
      <div className="panel space-y-3">
        <h2 className="text-lg font-semibold">{t("priorityProposals.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("priorityProposals.description")}</p>
        <p className="text-xs text-muted-foreground">{t("priorityProposals.locked")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            aria-label={t("priorityProposals.restore")}
            value={selected}
            disabled={action.busy}
            onValueChange={(value) => {
              setSelected(value);
              setPreview(null);
              action.reset();
            }}
            options={[{ value: "", label: t("priorityProposals.official") }, ...options]}
          />
          <Button
            disabled={
              action.busy ||
              !!selected ||
              !roadmap?.features.length ||
              (!!preview && preview.revision !== official.revision)
            }
            onClick={() => (user ? setNaming(true) : setLogin(true))}
          >
            {t("priorityProposals.save")}
          </Button>
          {selected && (
            <Button
              variant="outline"
              disabled={action.busy || !saved.data}
              onClick={() =>
                void action.run(async () => {
                  if (!repository || !saved.data || !official.revision)
                    throw new Error(t("priorityProposals.changed"));
                  const ids = saved.data.features.map((feature) => {
                    if (!feature.id) throw new Error(t("priorityProposals.changed"));
                    return feature.id;
                  });
                  const features = official.features.map((feature) => {
                    if (!feature.id) throw new Error(t("priorityProposals.changed"));
                    return {
                      ...feature,
                      id: feature.id,
                      dependency_ids: feature.dependency_ids ?? [],
                    };
                  });
                  validatePriorityOrder(features, ids, true);
                  const restored = await repository.loadRoadmapLink(token, {
                    featureIds: ids,
                    expectedRevision: official.revision,
                  });
                  setSelected("");
                  setPreview(restored);
                })
              }
            >
              {t("priorityProposals.resume")}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={() => {
              setPreview(null);
              setSelected("");
              action.reset();
            }}
          >
            {t("priorityProposals.reset")}
          </Button>
          <SelectField
            aria-label={t("priorityProposals.compare")}
            value={comparison}
            onValueChange={setComparison}
            options={[
              { value: "", label: t("priorityProposals.noComparison") },
              { value: "official", label: t("priorityProposals.official") },
              ...options,
            ]}
          />
        </div>
        {selected && <p className="text-sm">{t("priorityProposals.snapshot")}</p>}
        {preview && (
          <p role="status" className="text-sm">
            {t("priorityProposals.draft")}
          </p>
        )}
        {preview && preview.revision !== official.revision && (
          <ErrorState message={t("priorityProposals.changed")} />
        )}
        {[action.error, proposals.error?.message, saved.error?.message, compared.error?.message]
          .filter((message): message is string => typeof message === "string")
          .map((message, index) => (
            <ErrorState key={index} message={message} />
          ))}
      </div>
      {(saved.isFetching && selected) || action.busy ? (
        <AppSkeleton label={t("priorityProposals.recalculating")} fullPage={false} />
      ) : null}
      <div className={cn("grid gap-4", comparison && "xl:grid-cols-2")}>
        {roadmap && (
          <section aria-label={viewName} className="min-w-0 space-y-2">
            <h3 className="font-semibold">{viewName}</h3>
            <PublicRoadmapView
              roadmap={roadmap}
              {...(!selected ? { onMove: move } : {})}
              disabled={action.busy}
            />
          </section>
        )}
        {comparison && comparisonRoadmap && (
          <section aria-label={comparisonName} className="min-w-0 space-y-2">
            <h3 className="font-semibold">{comparisonName}</h3>
            <PublicRoadmapView roadmap={comparisonRoadmap} />
          </section>
        )}
      </div>
      <NameDialog
        isOpen={naming}
        onClose={() => setNaming(false)}
        form={form}
        labels={{
          title: t("priorityProposals.save"),
          description: t("priorityProposals.nameDescription"),
          name: t("priorityProposals.name"),
          submit: t("priorityProposals.save"),
          cancel: t("buttons.cancel"),
        }}
      />
      <AuthDialog {...auth} isOpen={login} onClose={() => setLogin(false)} />
    </section>
  );
}

export default function RoadmapLink() {
  const { token = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { fullWidth } = useRoadmapDisplay();
  const query = useQuery({
    queryKey: ["public-roadmap", token],
    retry: false,
    refetchInterval: 60_000,
    queryFn: () => {
      if (!repository) throw new Error(t("publicRoadmap.unavailable"));
      return repository.loadRoadmapLink(token);
    },
  });
  return (
    <PublicAppShell
      projectId="planner"
      mainClassName={cn("space-y-5", fullWidth && "max-w-none")}
      footer={{ text: t("app.footer") }}
      header={{
        title: query.data?.name ?? t("publicRoadmap.title"),
        language: {
          value: i18n.language,
          label: t("header.language"),
          onValueChange: (language) => void i18n.changeLanguage(language),
        },
      }}
    >
      {query.isPending && <AppSkeleton label={t("app.loading.page")} fullPage={false} />}
      {query.error && (
        <div role="alert" className="space-y-3">
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>{t("app.actions.tryAgain")}</Button>
        </div>
      )}
      {query.data && <PriorityProposals key={token} token={token} official={query.data} />}
    </PublicAppShell>
  );
}
