import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { ContextMenu } from "@jordiorriols/ui/radix";
import { GripVertical } from "@jordiorriols/ui/icons";
import { addDays, differenceInCalendarDays, format, isWeekend } from "date-fns";
import { ROLES, ROLE_LABELS, fmtDate, roleDevs } from "@/lib/planning";
import { isHoliday } from "@/lib/barcelonaHolidays";
import { cn } from "@/lib/utils";
import { ROLE_COLORS } from "@/config/roleColors";
import type { CapacityWeek, ScheduledFeature, ScheduledRole } from "@/lib/planning";
import { FEATURE_STATUSES, type FeatureStatus, type Project } from "@/types/planner";
import {
  FeatureTitle,
  RoadmapDisplayToolbar,
  STATUS_COLORS,
  StatusDot,
  StatusLegend,
  TimelineGuides,
  TimelineHeader,
  timelineColumns,
  useLabelWidth,
} from "@/components/organisms/roadmap-timeline";

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
  projects = [],
  onReorder,
  onRemove,
  onStatusChange,
  disabled = false,
}: {
  weeks: CapacityWeek[];
  schedule: ScheduledFeature[];
  projects?: Project[];
  onReorder?: (fromId: string, toId: string) => void;
  onRemove?: (id: string) => void;
  onStatusChange?: (id: string, status: FeatureStatus) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const labelWidth = useLabelWidth();
  const N = weeks.length;
  const projectNames = new Map(projects.map((item) => [item.id, item.name]));
  const groupByProject = schedule.some(
    (item) => item.feature.project_id && projectNames.has(item.feature.project_id)
  );
  const projectKey = (item: ScheduledFeature) =>
    item.feature.project_id && projectNames.has(item.feature.project_id)
      ? item.feature.project_id
      : null;
  const columns = timelineColumns(labelWidth, N);
  const weekStarts = weeks.map((week) => week.weekStart);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
          <span className="size-2 rounded-sm bg-violet-400/60" />
          {t("uat.summary", { weeks: 2 })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-slate-400/40" />
          {t("gantt.legend.paused")}
        </span>
        <StatusLegend />
        <span className="ml-auto">
          <RoadmapDisplayToolbar />
        </span>
      </div>
      {onReorder && (
        <p className="mb-2 text-[11px] text-muted-foreground">{t("gantt.interactionHelp")}</p>
      )}
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: Math.max(720, N * 28 + labelWidth) }}>
          <TimelineGuides weekStarts={weekStarts} labelWidth={labelWidth} />
          <TimelineHeader
            weekStarts={weekStarts}
            labelWidth={labelWidth}
            title={t("gantt.columns.featurePriority")}
            weekLabel={t("common.weekOf")}
          />

          <div className="mt-2">
            {schedule.map((s, idx) => {
              const lastWork =
                s.end ??
                s.roles
                  .flatMap((role) => role.allocations)
                  .reduce<Date | null>(
                    (last, allocation) => (!last || allocation.end > last ? allocation.end : last),
                    null
                  );
              const spanDays =
                s.start && lastWork ? differenceInCalendarDays(lastWork, s.start) + 1 : 0;
              const spanWeeks =
                s.startIdx != null && s.endIdx != null ? (s.endIdx - s.startIdx + 1) * 7 : 0;
              const done = s.feature.status === "done";
              const paused = s.feature.status === "paused";
              const groupKey = projectKey(s);
              const groupName = groupKey ? projectNames.get(groupKey)! : t("projects.none");
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
                    <ContextMenu.Trigger asChild disabled={!onRemove && !onStatusChange}>
                      <div
                        tabIndex={onRemove || onStatusChange ? 0 : undefined}
                        aria-label={t("gantt.row.label", { featureName: s.feature.name })}
                        onKeyDown={(event) => {
                          if (
                            (!onRemove && !onStatusChange) ||
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
                          gridTemplateRows:
                            s.reason && s.startIdx != null
                              ? "minmax(32px, auto) auto"
                              : "minmax(32px, auto)",
                        }}
                      >
                        <div
                          className={cn(
                            "sticky left-0 bg-card z-10 flex items-center gap-1.5 px-2 text-xs",
                            onReorder && !disabled && "cursor-grab active:cursor-grabbing"
                          )}
                          style={{ gridRow: "1 / -1" }}
                          draggable={!!onReorder && !disabled}
                          onDragStart={(event) => {
                            if (!onReorder || disabled) {
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
                          {onReorder && (
                            <button
                              type="button"
                              className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50"
                              aria-label={t("gantt.row.reorder", { featureName: s.feature.name })}
                              title={t("gantt.row.reorderHelp", { featureName: s.feature.name })}
                              disabled={disabled}
                              onKeyDown={(event) => {
                                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                                event.preventDefault();
                                const target = schedule[idx + (event.key === "ArrowUp" ? -1 : 1)];
                                if (!disabled && target) onReorder(s.feature.id, target.feature.id);
                              }}
                            >
                              <GripVertical className="size-3.5" />
                            </button>
                          )}
                          <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                            {idx + 1}
                          </span>
                          <StatusDot
                            status={s.feature.status}
                            featureName={s.feature.name}
                            disabled={disabled}
                            {...(onStatusChange
                              ? { onChange: (status) => onStatusChange(s.feature.id, status) }
                              : {})}
                          />
                          <FeatureTitle
                            name={s.feature.name}
                            className={cn("py-1 font-medium", paused && "opacity-50")}
                          />
                        </div>
                        {s.start && lastWork && s.startIdx != null && s.endIdx != null && (
                          <div
                            className={cn(
                              "relative h-8 min-w-0 self-center",
                              paused && "opacity-50"
                            )}
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
                                status: t(`featureStatus.${s.feature.status}`),
                              })}
                              title={t("gantt.bar.projectSpan", {
                                featureName: s.feature.name,
                                startDate: fmtDate(s.start),
                                endDate: s.end ? fmtDate(s.end) : t("gantt.bar.incomplete"),
                                status: t(`featureStatus.${s.feature.status}`),
                              })}
                              className={cn(
                                "absolute inset-y-1 overflow-hidden rounded ring-1 ring-inset",
                                done
                                  ? "bg-emerald-600 ring-emerald-700/30"
                                  : "bg-slate-400/40 ring-slate-500/15"
                              )}
                              style={{
                                left: `${(differenceInCalendarDays(s.start, weeks[s.startIdx]!.weekStart) / spanWeeks) * 100}%`,
                                width: `${(spanDays / spanWeeks) * 100}%`,
                              }}
                            >
                              {!done && s.uat && (
                                <div
                                  role="img"
                                  aria-label={t("uat.span", {
                                    startDate: fmtDate(s.uat.start),
                                    endDate: fmtDate(s.uat.end),
                                  })}
                                  title={t("uat.span", {
                                    startDate: fmtDate(s.uat.start),
                                    endDate: fmtDate(s.uat.end),
                                  })}
                                  className="absolute inset-y-0 bg-violet-400/60 shadow-inner"
                                  style={{
                                    left: `${(differenceInCalendarDays(s.uat.start, s.start) / spanDays) * 100}%`,
                                    width: `${((differenceInCalendarDays(s.uat.end, s.uat.start) + 1) / spanDays) * 100}%`,
                                  }}
                                />
                              )}
                              {!done &&
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
                        {onStatusChange && (
                          <ContextMenu.RadioGroup
                            value={s.feature.status}
                            onValueChange={(value) =>
                              onStatusChange(s.feature.id, value as FeatureStatus)
                            }
                          >
                            <ContextMenu.Label className="px-3 py-1 text-xs text-muted-foreground">
                              {t("featureStatus.label")}
                            </ContextMenu.Label>
                            {FEATURE_STATUSES.map((status) => (
                              <ContextMenu.RadioItem
                                key={status}
                                value={status}
                                disabled={disabled}
                                className="flex items-center gap-2 rounded px-3 py-2 outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 data-[state=checked]:font-medium"
                              >
                                <span
                                  className={cn("size-2.5 rounded-full", STATUS_COLORS[status])}
                                />
                                {t(`featureStatus.${status}`)}
                              </ContextMenu.RadioItem>
                            ))}
                          </ContextMenu.RadioGroup>
                        )}
                        {onStatusChange && onRemove && (
                          <ContextMenu.Separator className="my-1 h-px bg-border" />
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
                  {week.calendarVerified === false ? "—" : week.capacity.toFixed(1)}
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
