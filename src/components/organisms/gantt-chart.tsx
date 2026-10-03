import React from "react";
import { format } from "date-fns";
import { peakDevs, durationWeeks, fmtDate } from "@/lib/planning";
import { cn } from "@/lib/utils";

const BAR_TONES = [
  "bg-brand",
  "bg-[hsl(var(--chart-2))]",
  "bg-[hsl(var(--chart-3))]",
  "bg-[hsl(var(--chart-4))]",
  "bg-[hsl(var(--chart-1))]",
  "bg-[hsl(var(--chart-5))]",
];

export default function GanttChart({ weeks, schedule }) {
  if (!weeks.length) return null;
  const N = weeks.length;

  const monthGroups = [];
  weeks.forEach((w, i) => {
    const m = format(w.weekStart, "MMM yy");
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.label !== m) monthGroups.push({ label: m, start: i, span: 1 });
    else last.span++;
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `repeat(${N}, minmax(0,1fr))` }}
        >
          {monthGroups.map((g) => (
            <div
              key={g.label + g.start}
              className="text-[11px] font-medium text-muted-foreground px-2 py-1.5 border-l first:border-l-0 text-center"
              style={{ gridColumn: `${g.start + 1} / ${g.start + g.span + 1}` }}
            >
              {g.label}
            </div>
          ))}
        </div>
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `repeat(${N}, minmax(0,1fr))` }}
        >
          {weeks.map((w, i) => (
            <div
              key={i}
              className="text-[10px] text-muted-foreground/60 px-1 py-1 border-l first:border-l-0 text-center"
            >
              {format(w.weekStart, "d")}
            </div>
          ))}
        </div>

        <div className="space-y-1.5 mt-2">
          {schedule.map((s, idx) => {
            const scheduled = s.startIdx != null;
            const peak = peakDevs(s.project);
            const dur = durationWeeks(s.project);
            return (
              <div
                key={s.project.id}
                className="grid items-stretch"
                style={{ gridTemplateColumns: `repeat(${N}, minmax(0,1fr))` }}
              >
                {scheduled ? (
                  <div
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-white text-xs font-medium flex items-center justify-between gap-2 shadow-sm",
                      BAR_TONES[idx % BAR_TONES.length]
                    )}
                    style={{ gridColumn: `${s.startIdx + 1} / ${s.endIdx + 2}` }}
                  >
                    <span className="truncate">{s.project.name}</span>
                    <span className="shrink-0 tabular-nums opacity-90">
                      {peak}d · {dur}w
                    </span>
                  </div>
                ) : (
                  <div className="col-span-full text-xs text-destructive px-2 py-1.5 rounded-md bg-destructive/5 border border-destructive/20">
                    ⚠ {s.project.name} — {s.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {schedule.some((s) => s.startIdx != null) && (
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
            {schedule
              .filter((s) => s.startIdx != null)
              .map((s) => (
                <div key={s.project.id} className="flex justify-between">
                  <span className="font-medium text-foreground">{s.project.name}</span>
                  <span className="tabular-nums">
                    {fmtDate(s.start)} → {fmtDate(s.end)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
