import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  IconTooltip,
  TimelineCard,
  type TimelineCardProps,
  type TimelineMarker,
} from "@jordiorriols/ui";
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
      size="icon-sm"
      aria-label={t(visible ? "markers.hide" : "markers.show")}
      variant={visible ? "secondary" : "ghost"}
      aria-pressed={visible}
      onClick={onToggle}
    >
      <Flag className="size-4" />
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

export function RoadmapDisplayToolbar({
  markerVisibility,
}: {
  markerVisibility?: { visible: boolean; toggle: () => void };
}) {
  const { t } = useTranslation();
  const display = useRoadmapDisplay();
  return (
    <div role="group" aria-label={t("roadmapDisplay.label")} className="flex gap-1">
      <Button
        type="button"
        variant={display.fullWidth ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={t("roadmapDisplay.fullWidth")}
        aria-pressed={display.fullWidth}
        onClick={() => updateRoadmapDisplay({ fullWidth: !display.fullWidth })}
      >
        {display.fullWidth ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </Button>
      <Button
        type="button"
        variant={display.wrapTitles ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={t("roadmapDisplay.wrapTitles")}
        aria-pressed={display.wrapTitles}
        onClick={() => updateRoadmapDisplay({ wrapTitles: !display.wrapTitles })}
      >
        <WrapText className="size-4" />
      </Button>
      {markerVisibility && (
        <MarkerVisibilityButton
          visible={markerVisibility.visible}
          onToggle={markerVisibility.toggle}
        />
      )}
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
      <IconTooltip label={label}>
        <DropdownMenu.Trigger
          className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
          aria-label={t("featureStatus.change", { featureName })}
          disabled={disabled}
        >
          {dot}
        </DropdownMenu.Trigger>
      </IconTooltip>
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

export function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

export { timelineColumns } from "@jordiorriols/ui";

export function RoadmapTimelineCard({
  weekStarts,
  markers = [],
  ...props
}: {
  weekStarts: Date[];
  markers?: { name: string; date: string }[];
} & Omit<TimelineCardProps, "columns" | "markers">) {
  const { t } = useTranslation();
  const today = useToday();
  const first = weekStarts[0];
  const guides: TimelineMarker[] = first
    ? markers.map((marker, index) => {
        const date = parseDate(marker.date);
        return {
          id: `${marker.date}-${marker.name}-${index}`,
          position: (differenceInCalendarDays(date, first) + 0.5) / 7,
          label: t("markers.label", { markerName: marker.name, date: fmtDate(date) }),
          caption: marker.name,
          className: "border-dashed border-amber-600",
          captionClassName: "top-12 bg-amber-700 px-1.5 py-0.5 text-[10px]",
        };
      })
    : [];
  if (first)
    guides.push({
      id: "today",
      position: (differenceInCalendarDays(today, first) + 0.5) / 7,
      label: t("gantt.today.label", { date: fmtDate(today) }),
      caption: t("gantt.today.text"),
      className: "border-0 w-0.5 bg-blue-500",
    });
  return (
    <TimelineCard
      {...props}
      columns={weekStarts.map((date) => ({
        id: format(date, "yyyy-MM-dd"),
        label: format(date, "d"),
        group: fmtMonth(date, true),
      }))}
      markers={guides}
    />
  );
}
