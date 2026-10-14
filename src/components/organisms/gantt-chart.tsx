import React, { useState } from "react";
import { Button } from "@jordiorriols/ui";
import { GripVertical, X } from "@jordiorriols/ui/icons";
import { differenceInCalendarDays, format } from "date-fns";
import { ROLES, ROLE_COLORS, ROLE_LABELS, fmtDate } from "@/lib/planning";
import { cn } from "@/lib/utils";
import type { CapacityWeek, ScheduledProject } from "@/lib/planning";

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
  const columns = `260px ${N ? `repeat(${N}, minmax(28px, 1fr))` : "1fr"}`;

  const monthGroups: { label: string; start: number; span: number }[] = [];
  weeks.forEach((w, i) => {
    const m = format(w.weekStart, "MMM yy");
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.label !== m) monthGroups.push({ label: m, start: i, span: 1 });
    else last.span++;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {ROLES.map((role) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-sm", ROLE_COLORS[role])} />
            {ROLE_LABELS[role]}
            {role === "backend" ? " (top)" : role === "frontend" ? " (bottom)" : " (full height)"}
          </span>
        ))}
      </div>
      {onReorder && (
        <p className="mb-3 text-xs text-muted-foreground">
          Drag project names to change priority, or focus a name and use Arrow Up / Arrow Down.
        </p>
      )}
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(860, N * 28 + 260) }}>
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
              return (
                <div
                  key={s.project.id}
                  className={cn(
                    "grid items-stretch border-b border-border/60",
                    dropId === s.project.id && "bg-brand/10 ring-1 ring-inset ring-brand"
                  )}
                  style={{
                    gridTemplateColumns: columns,
                    gridTemplateRows:
                      s.reason && s.startIdx != null ? "28px 28px auto" : "28px 28px",
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
                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-2 text-left font-medium cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50"
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
                      style={{ gridColumn: index + 2, gridRow: "1 / 3" }}
                      aria-hidden="true"
                    />
                  ))}
                  {s.roles.flatMap((roleSchedule) =>
                    roleSchedule.allocations.map((allocation) => {
                      const role = roleSchedule.role;
                      const label = `${s.project.name} · ${ROLE_LABELS[role]}: ${fmtDate(allocation.start)} to ${fmtDate(allocation.end)} · ${(allocation.personDays / 5).toFixed(1)} person-weeks${roleSchedule.complete ? "" : " (partial forecast)"}`;
                      const week = weeks[allocation.weekIndex]!;
                      return (
                        <div
                          key={`${role}-${allocation.weekIndex}`}
                          className="relative min-w-0"
                          style={{
                            gridColumn: allocation.weekIndex + 2,
                            gridRow: role === "backend" ? "1" : role === "frontend" ? "2" : "1 / 3",
                          }}
                        >
                          <div
                            role="img"
                            aria-label={label}
                            title={label}
                            className={cn(
                              "absolute inset-y-0.5 rounded-sm text-white text-[10px] font-semibold flex items-center justify-center overflow-hidden",
                              ROLE_COLORS[role]
                            )}
                            style={{
                              left: `${(differenceInCalendarDays(allocation.start, week.weekStart) / 7) * 100}%`,
                              width: `${((differenceInCalendarDays(allocation.end, allocation.start) + 1) / 7) * 100}%`,
                            }}
                          >
                            <span aria-hidden="true">
                              {role === "qa" ? "Q" : ROLE_LABELS[role][0]}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {s.reason && (
                    <div
                      style={{ gridColumn: "2 / -1", gridRow: s.startIdx != null ? "3" : "1 / 3" }}
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
              className="grid mt-4 border-t text-[10px] tabular-nums"
              style={{ gridTemplateColumns: columns }}
            >
              <div className="sticky left-0 bg-card z-10 p-2 font-medium">
                Available person-weeks
              </div>
              {weeks.map((week, index) => (
                <div key={index} className="text-center py-2 border-l">
                  {week.capacity.toFixed(1)}
                </div>
              ))}
              <div className="sticky left-0 bg-card z-10 p-2 font-medium">
                Allocated person-weeks
              </div>
              {weeks.map((week, index) => (
                <div key={index} className="text-center py-2 border-l">
                  {week.allocated.toFixed(1)}
                </div>
              ))}
            </div>
          )}
          {schedule.some((s) => s.startIdx != null) && (
            <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
              {schedule
                .filter((s) => s.startIdx != null)
                .map((s) => (
                  <div key={s.project.id} className="flex justify-between">
                    <span className="font-medium text-foreground">{s.project.name}</span>
                    <span className="tabular-nums">
                      {s.start ? fmtDate(s.start) : "Not started"} →{" "}
                      {s.end ? fmtDate(s.end) : s.reason}
                    </span>
                  </div>
                ))}
              {schedule.flatMap((s) =>
                s.roles.map((role) => (
                  <div
                    key={`${s.project.id}-${role.role}`}
                    className="flex flex-wrap justify-between gap-2 pl-3"
                  >
                    <span>
                      {s.project.name} · {ROLE_LABELS[role.role]}
                    </span>
                    <span className="tabular-nums">
                      {role.start ? fmtDate(role.start) : "Not started"} →{" "}
                      {role.end ? fmtDate(role.end) : "Not completed"}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
