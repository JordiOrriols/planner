import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconTooltip } from "@jordiorriols/ui";
import { GripVertical } from "@jordiorriols/ui/icons";
import { differenceInCalendarDays, addWeeks } from "date-fns";
import { FeatureDependencies } from "@/components/molecules/feature-dependencies";
import { fmtDate, getMonday, parseDate } from "@/lib/planning";
import { cn } from "@/lib/utils";
import { useMarkerVisibility } from "@/lib/roadmapDisplay";
import {
  FeatureTitle,
  ProjectGroupHeading,
  RoadmapDisplayToolbar,
  STATUS_COLORS,
  StatusLegend,
  RoadmapTimelineCard,
  useLabelWidth,
} from "./roadmap-timeline";
import type { PublicRoadmap } from "@/lib/publicRoadmap";

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
