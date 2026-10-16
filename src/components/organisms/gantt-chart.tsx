import { useTranslation } from "react-i18next";
import React, { useEffect, useState } from "react";
import { ContextMenu } from "@jordiorriols/ui/radix";
import { GripVertical } from "@jordiorriols/ui/icons";
import { addDays, differenceInCalendarDays, format, isWeekend } from "date-fns";
import { ROLES, ROLE_LABELS, fmtDate, fmtMonth, roleDevs } from "@/lib/planning";
import { isHoliday } from "@/lib/barcelonaHolidays";
import { cn } from "@/lib/utils";
import { ROLE_COLORS } from "@/config/roleColors";
import type { CapacityWeek, ScheduledFeature, ScheduledRole } from "@/lib/planning";
import type { MainProject } from "@/types/planner";

function workRuns(role: ScheduledRole) {
  const runs: { start: Date; end: Date; personDays: number }[] = [];
  for (const day of role.allocations.flatMap((allocation) => allocation.days)) {
    const previous = runs.at(-1);
    let paused = false;
    if (previous) {
      for (let date = addDays(previous.end, 1); date < day.date; date = addDays(date, 1)) {
        if (!isWeekend(date) && !isHoliday(format(date, "yyyy-MM-dd"))) {
          paused = true;
          break;
        }
      }
    }
    if (previous && !paused) {
      previous.end = day.date;
      previous.personDays += day.personDays;
    } else {
      runs.push({ start: day.date, end: day.date, personDays: day.personDays });
    }
  }
  return runs;
}

export default function GanttChart({
  weeks,
  schedule,
  mainProjects = [],
  onReorder,
  onRemove,
  onDeliveredChange,
  disabled = false,
}: {
  weeks: CapacityWeek[];
  schedule: ScheduledFeature[];
  mainProjects?: MainProject[];
  onReorder?: (fromId: string, toId: string) => void;
  onRemove?: (id: string) => void;
  onDeliveredChange?: (id: string, delivered: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const N = weeks.length;
  const mainProjectNames = new Map(mainProjects.map((item) => [item.id, item.name]));
  const groupByProject = schedule.some(
    (item) => item.feature.main_project_id && mainProjectNames.has(item.feature.main_project_id)
  );
  const projectKey = (item: ScheduledFeature) =>
    item.feature.main_project_id && mainProjectNames.has(item.feature.main_project_id)
      ? item.feature.main_project_id
      : null;
  const columns = `220px ${N ? `repeat(${N}, minmax(28px, 1fr))` : "1fr"}`;
  const todayOffset = weeks[0] ? differenceInCalendarDays(today, weeks[0].weekStart) : -1;
  const showToday = todayOffset >= 0 && todayOffset < N * 7;

  const monthGroups: { label: string; start: number; span: number }[] = [];
  weeks.forEach((w, i) => {
    const m = fmtMonth(w.weekStart, true);
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.label !== m) monthGroups.push({ label: m, start: i, span: 1 });
    else last.span++;
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {ROLES.map((role) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <span
              data-role-swatch={role}
              className={cn("size-2 rounded-sm", ROLE_COLORS[role].className)}
            />
            {ROLE_LABELS[role]}
            {t(
              role === "backend"
                ? "gantt.legend.topSuffix"
                : role === "frontend"
                  ? "gantt.legend.bottomSuffix"
                  : "gantt.legend.fullHeightSuffix"
            )}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-slate-400/40" />
          {t("gantt.legend.paused")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-emerald-600" />
          {t("gantt.legend.delivered")}
        </span>
      </div>
      {onReorder && (
        <p className="mb-2 text-[11px] text-muted-foreground">{t("gantt.interactionHelp")}</p>
      )}
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: Math.max(720, N * 28 + 220) }}>
          {showToday && (
            <div className="absolute inset-y-0 left-[220px] right-0 pointer-events-none z-[5]">
              <div
                role="img"
                aria-label={t("gantt.today.label", { date: fmtDate(today) })}
                title={t("gantt.today.label", { date: fmtDate(today) })}
                className="absolute inset-y-0 w-0.5 bg-blue-500"
                style={{ left: `${((todayOffset + 0.5) / (N * 7)) * 100}%` }}
              >
                <span className="absolute top-0 -translate-x-1/2 rounded bg-blue-500 px-1 text-[9px] font-medium text-white">
                  {t("gantt.today.text")}
                </span>
              </div>
            </div>
          )}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 bg-card z-10 px-2 py-1.5 text-xs font-semibold">
              {t("gantt.columns.featurePriority")}
            </div>
            {monthGroups.map((g) => (
              <div
                key={g.label + g.start}
                className="text-[11px] font-medium text-muted-foreground px-2 py-1.5 border-l first:border-l-0 text-center"
                style={{ gridColumn: `${g.start + 2} / ${g.start + g.span + 2}` }}
              >
                {g.label}
              </div>
            ))}
          </div>
          <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 bg-card z-10 text-xs px-2">{t("common.weekOf")}</div>
            {weeks.map((w, i) => (
              <div
                key={i}
                className="text-[10px] text-muted-foreground/60 px-1 py-1 border-l first:border-l-0 text-center"
              >
                {format(w.weekStart, "d")}
              </div>
            ))}
          </div>

          <div className="mt-2">
            {schedule.map((s, idx) => {
              const lastWork = s.roles
                .flatMap((role) => role.allocations)
                .reduce<Date | null>(
                  (last, allocation) => (!last || allocation.end > last ? allocation.end : last),
                  null
                );
              const spanDays =
                s.start && lastWork ? differenceInCalendarDays(lastWork, s.start) + 1 : 0;
              const spanWeeks =
                s.startIdx != null && s.endIdx != null ? (s.endIdx - s.startIdx + 1) * 7 : 0;
              const groupKey = projectKey(s);
              const groupName = groupKey ? mainProjectNames.get(groupKey)! : t("mainProjects.none");
              const startsGroup =
                groupByProject && (idx === 0 || projectKey(schedule[idx - 1]!) !== groupKey);
              return (
                <React.Fragment key={s.feature.id}>
                  {startsGroup && (
                    <div
                      role="heading"
                      aria-level={3}
                      aria-label={t("gantt.row.projectGroup", { projectName: groupName })}
                      className="grid border-b border-border/60 bg-muted/40"
                      style={{ gridTemplateColumns: columns }}
                    >
                      <div
                        className={cn(
                          "sticky left-0 z-10 truncate bg-muted px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide",
                          groupKey ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {groupName}
                      </div>
                    </div>
                  )}
                  <ContextMenu.Root>
                    <ContextMenu.Trigger asChild disabled={!onRemove && !onDeliveredChange}>
                      <div
                        tabIndex={onRemove || onDeliveredChange ? 0 : undefined}
                        aria-label={t("gantt.row.label", { featureName: s.feature.name })}
                        onKeyDown={(event) => {
                          if (
                            (!onRemove && !onDeliveredChange) ||
                            !(
                              event.key === "ContextMenu" ||
                              (event.shiftKey && event.key === "F10")
                            )
                          )
                            return;
                          event.preventDefault();
                          const bounds = event.currentTarget.getBoundingClientRect();
                          event.currentTarget.dispatchEvent(
                            new MouseEvent("contextmenu", {
                              bubbles: true,
                              cancelable: true,
                              clientX: bounds.left + 24,
                              clientY: bounds.top + bounds.height / 2,
                            })
                          );
                        }}
                        className={cn(
                          "grid items-stretch border-b border-border/60",
                          dropId === s.feature.id && "bg-brand/10 ring-1 ring-inset ring-brand"
                        )}
                        style={{
                          gridTemplateColumns: columns,
                          gridTemplateRows: s.reason && s.startIdx != null ? "32px auto" : "32px",
                        }}
                      >
                        <div
                          className="sticky left-0 bg-card z-10 flex items-center gap-1 px-2 text-xs"
                          style={{ gridRow: "1 / -1" }}
                          onDragOver={(event) => {
                            if (!onReorder || disabled || !draggedId || draggedId === s.feature.id)
                              return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDropId(s.feature.id);
                          }}
                          onDragLeave={() => setDropId(null)}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (onReorder && !disabled && draggedId && draggedId !== s.feature.id)
                              onReorder(draggedId, s.feature.id);
                            setDraggedId(null);
                            setDropId(null);
                          }}
                        >
                          <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                            {idx + 1}
                          </span>
                          {onReorder ? (
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left font-medium cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50"
                              aria-label={t("gantt.row.reorder", { featureName: s.feature.name })}
                              title={t("gantt.row.reorderHelp", { featureName: s.feature.name })}
                              draggable={!disabled}
                              disabled={disabled}
                              onDragStart={(event) => {
                                if (disabled) {
                                  event.preventDefault();
                                  return;
                                }
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", s.feature.id);
                                setDraggedId(s.feature.id);
                              }}
                              onDragEnd={() => {
                                setDraggedId(null);
                                setDropId(null);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                                event.preventDefault();
                                const target = schedule[idx + (event.key === "ArrowUp" ? -1 : 1)];
                                if (!disabled && target) onReorder(s.feature.id, target.feature.id);
                              }}
                            >
                              <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">{s.feature.name}</span>
                            </button>
                          ) : (
                            <span
                              className="min-w-0 flex-1 truncate font-medium"
                              title={s.feature.name}
                            >
                              {s.feature.name}
                            </span>
                          )}
                        </div>
                        {weeks.map((_, index) => (
                          <div
                            key={index}
                            className="border-l border-border/60 bg-muted/10"
                            style={{ gridColumn: index + 2, gridRow: "1" }}
                            aria-hidden="true"
                          />
                        ))}
                        {s.start && lastWork && s.startIdx != null && s.endIdx != null && (
                          <div
                            className="relative min-w-0"
                            style={{
                              gridColumn: `${s.startIdx + 2} / ${s.endIdx + 3}`,
                              gridRow: "1",
                            }}
                          >
                            <div
                              role="group"
                              aria-label={t("gantt.bar.projectSpan", {
                                featureName: s.feature.name,
                                startDate: fmtDate(s.start),
                                endDate: s.end ? fmtDate(s.end) : t("gantt.bar.incomplete"),
                                deliveryStatus: s.feature.delivered
                                  ? t("gantt.bar.deliveredSuffix")
                                  : "",
                              })}
                              title={t("gantt.bar.projectSpan", {
                                featureName: s.feature.name,
                                startDate: fmtDate(s.start),
                                endDate: s.end ? fmtDate(s.end) : t("gantt.bar.incomplete"),
                                deliveryStatus: s.feature.delivered
                                  ? t("gantt.bar.deliveredSuffix")
                                  : "",
                              })}
                              className={cn(
                                "absolute inset-y-1 overflow-hidden rounded ring-1 ring-inset",
                                s.feature.delivered
                                  ? "bg-emerald-600 ring-emerald-700/30"
                                  : "bg-slate-400/40 ring-slate-500/15"
                              )}
                              style={{
                                left: `${(differenceInCalendarDays(s.start, weeks[s.startIdx]!.weekStart) / spanWeeks) * 100}%`,
                                width: `${(spanDays / spanWeeks) * 100}%`,
                              }}
                            >
                              {!s.feature.delivered &&
                                s.roles.flatMap((roleSchedule) =>
                                  workRuns(roleSchedule).map((run) => {
                                    const { role } = roleSchedule;
                                    const people = roleDevs(s.feature, role);
                                    const label = t("gantt.bar.roleSpan", {
                                      featureName: s.feature.name,
                                      role: ROLE_LABELS[role],
                                      startDate: fmtDate(run.start),
                                      endDate: fmtDate(run.end),
                                      requestedPeople: t("gantt.bar.peopleRequested", {
                                        count: people,
                                      }),
                                      effort: (run.personDays / 5).toFixed(1),
                                      forecastStatus: roleSchedule.complete
                                        ? ""
                                        : t("gantt.bar.partialSuffix"),
                                    });
                                    return (
                                      <div
                                        key={`${role}-${run.start.getTime()}`}
                                        role="img"
                                        aria-label={label}
                                        title={label}
                                        className={cn(
                                          "absolute shadow-inner",
                                          ROLE_COLORS[role].className
                                        )}
                                        style={{
                                          left: `${(differenceInCalendarDays(run.start, s.start!) / spanDays) * 100}%`,
                                          width: `${((differenceInCalendarDays(run.end, run.start) + 1) / spanDays) * 100}%`,
                                          top: role === "frontend" ? "50%" : "0",
                                          height:
                                            role === "backend" || role === "frontend"
                                              ? "50%"
                                              : "100%",
                                        }}
                                      />
                                    );
                                  })
                                )}
                            </div>
                          </div>
                        )}
                        {s.reason && (
                          <div
                            style={{
                              gridColumn: "2 / -1",
                              gridRow: s.startIdx != null ? "2" : "1",
                            }}
                            className="text-xs text-destructive px-2 py-1.5 bg-destructive/5"
                          >
                            {s.reason}
                          </div>
                        )}
                      </div>
                    </ContextMenu.Trigger>
                    <ContextMenu.Portal>
                      <ContextMenu.Content className="z-50 min-w-48 rounded-lg border border-border bg-card p-1 text-sm shadow-lg">
                        {onDeliveredChange && (
                          <ContextMenu.Item
                            className="rounded px-3 py-2 outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50"
                            disabled={disabled}
                            onSelect={() => onDeliveredChange(s.feature.id, !s.feature.delivered)}
                          >
                            {s.feature.delivered
                              ? t("gantt.actions.undoDelivery")
                              : t("gantt.actions.markDelivered")}
                          </ContextMenu.Item>
                        )}
                        {onRemove && (
                          <ContextMenu.Item
                            className="rounded px-3 py-2 text-destructive outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50"
                            disabled={disabled}
                            onSelect={() => onRemove(s.feature.id)}
                          >
                            {t("gantt.actions.remove")}
                          </ContextMenu.Item>
                        )}
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                </React.Fragment>
              );
            })}
          </div>

          {N > 0 && (
            <div
              className="grid mt-2 border-t text-[10px] tabular-nums"
              style={{ gridTemplateColumns: columns }}
            >
              <div className="sticky left-0 bg-card z-10 px-2 py-1 font-medium">
                {t("gantt.capacity.available")}
              </div>
              {weeks.map((week, index) => (
                <div key={index} className="text-center py-1 border-l">
                  {week.capacity.toFixed(1)}
                </div>
              ))}
              <div className="sticky left-0 bg-card z-10 px-2 py-1 font-medium">
                {t("gantt.capacity.allocated")}
              </div>
              {weeks.map((week, index) => (
                <div key={index} className="text-center py-1 border-l">
                  {week.allocated.toFixed(1)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
