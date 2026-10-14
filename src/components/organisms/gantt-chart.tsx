import React, { useState } from "react";
import { Button } from "@jordiorriols/ui";
import { GripVertical, X } from "@jordiorriols/ui/icons";
import { addDays, differenceInCalendarDays, format, isWeekend } from "date-fns";
import { ROLES, ROLE_LABELS, fmtDate, roleDevs } from "@/lib/planning";
import { isHoliday } from "@/lib/barcelonaHolidays";
import { cn } from "@/lib/utils";
import type { CapacityWeek, ScheduledProject, ScheduledRole } from "@/lib/planning";

const ROLE_TONES = {
  backend: "bg-sky-700/70",
  frontend: "bg-sky-400/60",
  design: "bg-amber-500/50",
  qa: "bg-emerald-600/50",
};

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
  onReorder,
  onRemove,
  disabled = false,
}: {
  weeks: CapacityWeek[];
  schedule: ScheduledProject[];
  onReorder?: (fromId: string, toId: string) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const N = weeks.length;
  const columns = `220px ${N ? `repeat(${N}, minmax(28px, 1fr))` : "1fr"}`;

  const monthGroups: { label: string; start: number; span: number }[] = [];
  weeks.forEach((w, i) => {
    const m = format(w.weekStart, "MMM yy");
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.label !== m) monthGroups.push({ label: m, start: i, span: 1 });
    else last.span++;
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {ROLES.map((role) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-sm", ROLE_TONES[role])} />
            {ROLE_LABELS[role]}
            {role === "backend" ? " (top)" : role === "frontend" ? " (bottom)" : " (full height)"}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-slate-400/40" />
          Gray · waiting / paused
        </span>
      </div>
      {onReorder && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Drag project names to reorder, or use Arrow Up / Arrow Down. Hover bars for details.
        </p>
      )}
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(720, N * 28 + 220) }}>
          <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 bg-card z-10 px-2 py-1.5 text-xs font-semibold">
              Project · priority
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
            <div className="sticky left-0 bg-card z-10 text-xs px-2">Week of</div>
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
              return (
                <div
                  key={s.project.id}
                  className={cn(
                    "grid items-stretch border-b border-border/60",
                    dropId === s.project.id && "bg-brand/10 ring-1 ring-inset ring-brand"
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
                      if (!onReorder || disabled || !draggedId || draggedId === s.project.id)
                        return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropId(s.project.id);
                    }}
                    onDragLeave={() => setDropId(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (onReorder && !disabled && draggedId && draggedId !== s.project.id)
                        onReorder(draggedId, s.project.id);
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
                        aria-label={`Reorder ${s.project.name}`}
                        title={`${s.project.name} — drag to reorder, or use Arrow Up / Arrow Down`}
                        draggable={!disabled}
                        disabled={disabled}
                        onDragStart={(event) => {
                          if (disabled) {
                            event.preventDefault();
                            return;
                          }
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", s.project.id);
                          setDraggedId(s.project.id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDropId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                          event.preventDefault();
                          const target = schedule[idx + (event.key === "ArrowUp" ? -1 : 1)];
                          if (!disabled && target) onReorder(s.project.id, target.project.id);
                        }}
                      >
                        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{s.project.name}</span>
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-medium" title={s.project.name}>
                        {s.project.name}
                      </span>
                    )}
                    {onRemove && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        aria-label={`Remove from backlog: ${s.project.name}`}
                        title="Remove from schedule (keep estimate)"
                        disabled={disabled}
                        onClick={() => onRemove(s.project.id)}
                      >
                        <X size={14} />
                      </Button>
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
                        aria-label={`${s.project.name}: ${fmtDate(s.start)} to ${s.end ? fmtDate(s.end) : "not completed"}`}
                        title={`${s.project.name}: ${fmtDate(s.start)} → ${s.end ? fmtDate(s.end) : "Not completed"}`}
                        className="absolute inset-y-1 overflow-hidden rounded bg-slate-400/40 ring-1 ring-inset ring-slate-500/15"
                        style={{
                          left: `${(differenceInCalendarDays(s.start, weeks[s.startIdx]!.weekStart) / spanWeeks) * 100}%`,
                          width: `${(spanDays / spanWeeks) * 100}%`,
                        }}
                      >
                        {s.roles.flatMap((roleSchedule) =>
                          workRuns(roleSchedule).map((run) => {
                            const { role } = roleSchedule;
                            const people = roleDevs(s.project, role);
                            const label = `${s.project.name} · ${ROLE_LABELS[role]}: ${fmtDate(run.start)} to ${fmtDate(run.end)} · ${people} ${people === 1 ? "person" : "people"} requested · ${(run.personDays / 5).toFixed(1)} person-weeks${roleSchedule.complete ? "" : " (partial forecast)"}`;
                            return (
                              <div
                                key={`${role}-${run.start.getTime()}`}
                                role="img"
                                aria-label={label}
                                title={label}
                                className={cn("absolute shadow-inner", ROLE_TONES[role])}
                                style={{
                                  left: `${(differenceInCalendarDays(run.start, s.start!) / spanDays) * 100}%`,
                                  width: `${((differenceInCalendarDays(run.end, run.start) + 1) / spanDays) * 100}%`,
                                  top: role === "frontend" ? "50%" : "0",
                                  height:
                                    role === "backend" || role === "frontend" ? "50%" : "100%",
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
                      style={{ gridColumn: "2 / -1", gridRow: s.startIdx != null ? "2" : "1" }}
                      className="text-xs text-destructive px-2 py-1.5 bg-destructive/5"
                    >
                      {s.reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {N > 0 && (
            <div
              className="grid mt-2 border-t text-[10px] tabular-nums"
              style={{ gridTemplateColumns: columns }}
            >
              <div className="sticky left-0 bg-card z-10 px-2 py-1 font-medium">
                Available person-weeks
              </div>
              {weeks.map((week, index) => (
                <div key={index} className="text-center py-1 border-l">
                  {week.capacity.toFixed(1)}
                </div>
              ))}
              <div className="sticky left-0 bg-card z-10 px-2 py-1 font-medium">
                Allocated person-weeks
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
