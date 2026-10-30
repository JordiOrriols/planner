import React from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AppFooter,
  AppMain,
  AppPage,
  AppSkeleton,
  Button,
  LanguageSelector,
} from "@jordiorriols/ui";
import { differenceInCalendarDays, addWeeks } from "date-fns";
import { createPlannerRepository } from "@/data/plannerRepository";
import { supabase } from "@/data/supabaseClient";
import { fmtDate, getMonday, parseDate } from "@/lib/planning";
import { cn } from "@/lib/utils";
import { useMarkerVisibility, useRoadmapDisplay } from "@/lib/roadmapDisplay";
import {
  FeatureTitle,
  MarkerVisibilityButton,
  RoadmapDisplayToolbar,
  STATUS_COLORS,
  StatusLegend,
  TimelineGuides,
  TimelineHeader,
  useLabelWidth,
} from "@/components/organisms/roadmap-timeline";
import type { PublicRoadmap } from "@/lib/publicRoadmap";

const repository = supabase ? createPlannerRepository(supabase) : null;
const BRAND = "JordiOrriols.cat";

export function PublicRoadmapView({ roadmap }: { roadmap: PublicRoadmap }) {
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
  return (
    <section className="panel space-y-4" aria-label={t("publicRoadmap.title")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <StatusLegend />
        <span className="ml-auto flex flex-wrap gap-1">
          <MarkerVisibilityButton
            visible={markerVisibility.visible}
            onToggle={markerVisibility.toggle}
          />
          <RoadmapDisplayToolbar />
        </span>
      </div>
      {!roadmap.features.length ? (
        <p>{t("publicRoadmap.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="relative" style={{ minWidth: Math.max(640, labelWidth + count * 32) }}>
            <TimelineGuides
              weekStarts={weekStarts}
              labelWidth={labelWidth}
              markers={markerVisibility.visible ? roadmap.markers : []}
            />
            <TimelineHeader
              weekStarts={weekStarts}
              labelWidth={labelWidth}
              title={t("common.feature")}
              weekLabel={t("common.weekOf")}
            />
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
                <div
                  key={index}
                  className="grid border-b border-border/60"
                  style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr)` }}
                >
                  <div className="sticky left-0 z-10 flex items-center gap-1.5 bg-card px-2 py-2">
                    <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className={cn("min-w-0 flex-1", paused && "opacity-50")}>
                      <FeatureTitle name={item.name} className="block text-sm font-medium" />
                      <FeatureTitle
                        name={item.project}
                        className="block text-xs text-muted-foreground"
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
              );
            })}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("publicRoadmap.forecastNotice")}</p>
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
    <AppPage className="flex flex-col">
      <AppMain className={cn("w-full flex-1 space-y-5", fullWidth && "max-w-none")}>
        <header>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{BRAND}</p>
            <LanguageSelector
              value={i18n.language}
              label={t("header.language")}
              className="inline-flex"
              onValueChange={(language) => void i18n.changeLanguage(language)}
            />
          </div>
          <h1 className="mt-3 text-3xl font-semibold">
            {query.data?.name ?? t("publicRoadmap.title")}
          </h1>
        </header>
        {query.isPending && <AppSkeleton label={t("app.loading.page")} fullPage={false} />}
        {query.error ? (
          <div role="alert" className="space-y-3">
            <p>{query.error.message}</p>
            <Button onClick={() => void query.refetch()}>{t("app.actions.tryAgain")}</Button>
          </div>
        ) : (
          query.data && <PublicRoadmapView roadmap={query.data} />
        )}
      </AppMain>
      <AppFooter text={t("app.footer")} />
    </AppPage>
  );
}
