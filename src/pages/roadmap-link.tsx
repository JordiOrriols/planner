import React from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppPage, AppMain, AppSkeleton, Button } from "@jordiorriols/ui";
import { differenceInCalendarDays, addWeeks, format } from "date-fns";
import { createPlannerRepository } from "@/data/plannerRepository";
import { supabase } from "@/data/supabaseClient";
import { fmtDate, fmtMonth, getMonday, parseDate } from "@/lib/planning";
import type { PublicRoadmap } from "@/lib/publicRoadmap";

const repository = supabase ? createPlannerRepository(supabase) : null;
const BRAND = "JordiOrriols.cat";

export function PublicRoadmapView({ roadmap }: { roadmap: PublicRoadmap }) {
  const { t } = useTranslation();
  const start = getMonday(parseDate(roadmap.startDate));
  const last = roadmap.features.reduce((latest, item) => {
    const end = item.end ?? item.start;
    return end && parseDate(end) > latest ? parseDate(end) : latest;
  }, start);
  const count = Math.max(4, Math.ceil((differenceInCalendarDays(last, start) + 1) / 7));
  return (
    <section className="panel space-y-4" aria-label={t("publicRoadmap.title")}>
      {!roadmap.features.length ? (
        <p>{t("publicRoadmap.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(640, 200 + count * 32) }}>
            <div
              className="grid border-b text-xs text-muted-foreground"
              style={{ gridTemplateColumns: `200px repeat(${count}, 1fr)` }}
            >
              <div className="sticky left-0 z-10 bg-card p-2">{t("common.feature")}</div>
              {Array.from({ length: count }, (_, index) => (
                <div key={index} className="border-l p-1 text-center">
                  {fmtMonth(addWeeks(start, index), true)}
                  <br />
                  {format(addWeeks(start, index), "d")}
                </div>
              ))}
            </div>
            {roadmap.features.map((item, index) => {
              const from = item.start ? parseDate(item.start) : null;
              const to = item.end ? parseDate(item.end) : null;
              return (
                <div key={index} className="grid grid-cols-[200px_minmax(0,1fr)] border-b">
                  <div className="sticky left-0 z-10 bg-card px-2 py-3">
                    <div className="truncate text-sm font-medium" title={item.name}>
                      {item.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{item.project}</div>
                  </div>
                  <div className="relative flex min-h-16 items-center bg-muted/20">
                    {from && to ? (
                      <div
                        role="img"
                        aria-label={t("publicRoadmap.span", {
                          name: item.name,
                          start: fmtDate(from),
                          end: fmtDate(to),
                        })}
                        title={t("publicRoadmap.span", {
                          name: item.name,
                          start: fmtDate(from),
                          end: fmtDate(to),
                        })}
                        className={`absolute h-7 rounded ${item.delivered ? "bg-emerald-600" : "bg-indigo-500/70"}`}
                        style={{
                          left: `${(differenceInCalendarDays(from, start) / (count * 7)) * 100}%`,
                          width: `${((differenceInCalendarDays(to, from) + 1) / (count * 7)) * 100}%`,
                        }}
                      />
                    ) : (
                      <p className="px-3 text-xs text-muted-foreground">
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
  const { t } = useTranslation();
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
    <AppPage>
      <AppMain className="space-y-5">
        <header>
          <p className="text-sm font-semibold">{BRAND}</p>
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
    </AppPage>
  );
}
