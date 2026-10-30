import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@jordiorriols/ui";
import { DropdownMenu } from "@jordiorriols/ui/radix";
import { Check, Flag, Maximize2, Minimize2, WrapText } from "@jordiorriols/ui/icons";
import { differenceInCalendarDays, format } from "date-fns";
import { fmtDate, fmtMonth, parseDate } from "@/lib/planning";
import { cn } from "@/lib/utils";
import { updateRoadmapDisplay, useRoadmapDisplay } from "@/lib/roadmapDisplay";
import { FEATURE_STATUSES, type FeatureStatus } from "@/types/planner";

export function MarkerVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      size="sm"
      variant={visible ? "secondary" : "ghost"}
      aria-pressed={visible}
      onClick={onToggle}
    >
      <Flag className="size-4" />
      {t(visible ? "markers.hide" : "markers.show")}
    </Button>
  );
}

export const STATUS_COLORS: Record<FeatureStatus, string> = {
  pending: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-600",
  paused: "bg-amber-500",
};

const MENU_ITEM =
  "flex cursor-default items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50";

export function useLabelWidth() {
  return useRoadmapDisplay().fullWidth ? 300 : 220;
}

export function RoadmapDisplayToolbar() {
  const { t } = useTranslation();
  const display = useRoadmapDisplay();
  return (
    <div role="group" aria-label={t("roadmapDisplay.label")} className="flex gap-1">
      <Button
        type="button"
        variant={display.fullWidth ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={display.fullWidth}
        onClick={() => updateRoadmapDisplay({ fullWidth: !display.fullWidth })}
      >
        {display.fullWidth ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        {t("roadmapDisplay.fullWidth")}
      </Button>
      <Button
        type="button"
        variant={display.wrapTitles ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={display.wrapTitles}
        onClick={() => updateRoadmapDisplay({ wrapTitles: !display.wrapTitles })}
      >
        <WrapText className="size-4" />
        {t("roadmapDisplay.wrapTitles")}
      </Button>
    </div>
  );
}

export function FeatureTitle({ name, className }: { name: string; className?: string }) {
  const { wrapTitles } = useRoadmapDisplay();
  return (
    <span
      className={cn(
        "min-w-0 flex-1",
        wrapTitles ? "whitespace-normal break-words" : "truncate",
        className
      )}
      title={name}
    >
      {name}
    </span>
  );
}

export function StatusLegend() {
  const { t } = useTranslation();
  return (
    <>
      {FEATURE_STATUSES.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", STATUS_COLORS[status])} />
          {t(`featureStatus.${status}`)}
        </span>
      ))}
    </>
  );
}

export function StatusDot({
  status,
  featureName,
  onChange,
  disabled = false,
}: {
  status: FeatureStatus;
  featureName: string;
  onChange?: (status: FeatureStatus) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const label = t("featureStatus.current", { status: t(`featureStatus.${status}`) });
  const dot = <span className={cn("block size-2.5 rounded-full", STATUS_COLORS[status])} />;
  if (!onChange)
    return (
      <span role="img" aria-label={label} title={label} className="shrink-0">
        {dot}
      </span>
    );
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
        aria-label={t("featureStatus.change", { featureName })}
        title={label}
        disabled={disabled}
      >
        {dot}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-40 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <DropdownMenu.RadioGroup
            value={status}
            onValueChange={(value) => onChange(value as FeatureStatus)}
          >
            {FEATURE_STATUSES.map((option) => (
              <DropdownMenu.RadioItem key={option} value={option} className={MENU_ITEM}>
                <span className={cn("size-2.5 rounded-full", STATUS_COLORS[option])} />
                <span className="flex-1">{t(`featureStatus.${option}`)}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function StatusBadge({ status }: { status: FeatureStatus }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      <span className={cn("size-2 rounded-full", STATUS_COLORS[status])} />
      <span aria-hidden="true">{t(`featureStatus.${status}`)}</span>
      <span className="sr-only">
        {t("featureStatus.current", { status: t(`featureStatus.${status}`) })}
      </span>
    </span>
  );
}

function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

export function timelineColumns(labelWidth: number, weekCount: number) {
  return `${labelWidth}px ${weekCount ? `repeat(${weekCount}, minmax(28px, 1fr))` : "1fr"}`;
}

function monthGroups(weekStarts: Date[]) {
  const groups: { label: string; start: number; span: number }[] = [];
  weekStarts.forEach((weekStart, index) => {
    const label = fmtMonth(weekStart, true);
    const last = groups.at(-1);
    if (!last || last.label !== label) groups.push({ label, start: index, span: 1 });
    else last.span++;
  });
  return groups;
}

/** Month and week header rows shared by the roadmap and its public link. */
export function TimelineHeader({
  weekStarts,
  labelWidth,
  title,
  weekLabel,
}: {
  weekStarts: Date[];
  labelWidth: number;
  title: string;
  weekLabel: string;
}) {
  const columns = timelineColumns(labelWidth, weekStarts.length);
  return (
    <>
      <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
        <div className="sticky left-0 z-10 bg-card px-2 py-1.5 text-xs font-semibold">{title}</div>
        {monthGroups(weekStarts).map((group) => (
          <div
            key={group.label + group.start}
            className="border-l border-border px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground first:border-l-0"
            style={{ gridColumn: `${group.start + 2} / ${group.start + group.span + 2}` }}
          >
            {group.label}
          </div>
        ))}
      </div>
      <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
        <div className="sticky left-0 z-10 bg-card px-2 text-xs">{weekLabel}</div>
        {weekStarts.map((weekStart, index) => (
          <div
            key={index}
            className="border-l border-border/40 px-1 py-1 text-center text-[10px] text-muted-foreground/60 first:border-l-0"
          >
            {format(weekStart, "d")}
          </div>
        ))}
      </div>
    </>
  );
}

/** Light weekly lines, stronger month boundaries and the live today marker. */
export function TimelineGuides({
  weekStarts,
  labelWidth,
  markers = [],
}: {
  weekStarts: Date[];
  labelWidth: number;
  markers?: { name: string; date: string }[];
}) {
  const { t } = useTranslation();
  const today = useToday();
  const count = weekStarts.length;
  if (!count) return null;
  const todayOffset = differenceInCalendarDays(today, weekStarts[0]!);
  const showToday = todayOffset >= 0 && todayOffset < count * 7;
  return (
    <>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-0"
        style={{ left: labelWidth }}
      >
        {weekStarts.map((weekStart, index) => {
          if (index === 0) return null;
          const monthStart = fmtMonth(weekStart, true) !== fmtMonth(weekStarts[index - 1]!, true);
          return (
            <div
              key={index}
              data-guide={monthStart ? "month" : "week"}
              aria-hidden="true"
              className={cn(
                "absolute inset-y-0 border-l",
                monthStart ? "border-slate-400/60" : "border-border/40"
              )}
              style={{ left: `${(index / count) * 100}%` }}
            />
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[4]"
        style={{ left: labelWidth }}
      >
        {markers.map((marker, index) => {
          const date = parseDate(marker.date);
          const offset = differenceInCalendarDays(date, weekStarts[0]!);
          if (offset < 0 || offset >= count * 7) return null;
          const label = t("markers.label", { markerName: marker.name, date: fmtDate(date) });
          return (
            <div
              key={`${marker.date}-${marker.name}-${index}`}
              role="img"
              aria-label={label}
              title={label}
              className="absolute inset-y-0 border-l-2 border-dashed border-amber-600"
              style={{ left: `${((offset + 0.5) / (count * 7)) * 100}%` }}
            >
              <span className="absolute top-12 -translate-x-1/2 rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-medium text-white max-w-32 truncate">
                {marker.name}
              </span>
            </div>
          );
        })}
      </div>
      {showToday && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[5]"
          style={{ left: labelWidth }}
        >
          <div
            role="img"
            aria-label={t("gantt.today.label", { date: fmtDate(today) })}
            title={t("gantt.today.label", { date: fmtDate(today) })}
            className="absolute inset-y-0 w-0.5 bg-blue-500"
            style={{ left: `${((todayOffset + 0.5) / (count * 7)) * 100}%` }}
          >
            <span className="absolute top-0 -translate-x-1/2 rounded bg-blue-500 px-1 text-[9px] font-medium text-white">
              {t("gantt.today.text")}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
