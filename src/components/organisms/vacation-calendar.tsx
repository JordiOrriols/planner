import React, { useState } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addDays, format, isSameMonth, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isHoliday, holidayName } from "@/lib/barcelonaHolidays";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MEMBER_DOT = ["bg-brand", "bg-[hsl(var(--chart-2))]", "bg-[hsl(var(--chart-3))]", "bg-[hsl(var(--chart-4))]", "bg-[hsl(var(--chart-1))]", "bg-[hsl(var(--chart-5))]"];

function memberIndex(teamMembers, name) {
  return Math.max(0, teamMembers.findIndex(m => m.name === name));
}

export default function VacationCalendar({ month, onMonthChange, teamMembers, vacations, selectedMember, onCreateVacation, onDeleteVacation }) {
  const [firstClick, setFirstClick] = useState(null);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const membersOnVacation = (date) => teamMembers.filter(m =>
    vacations.some(v => v.team_member_name === m.name &&
      isWithinInterval(date, { start: parseISO(v.start_date), end: parseISO(v.end_date) }))
  );

  const handleClick = (date) => {
    if (!selectedMember) return;
    if (!firstClick) { setFirstClick(date); return; }
    const [s, e] = firstClick <= date ? [firstClick, date] : [date, firstClick];
    onCreateVacation(selectedMember, format(s, "yyyy-MM-dd"), format(addDays(e, 0), "yyyy-MM-dd"));
    setFirstClick(null);
  };

  const cell = (date) => {
    const ds = format(date, "yyyy-MM-dd");
    const inMonth = isSameMonth(date, month);
    const holiday = isHoliday(ds);
    const onVac = membersOnVacation(date);
    const isFirst = firstClick && isSameDay(firstClick, date);
    return (
      <button
        key={ds}
        onClick={() => handleClick(date)}
        className={cn(
          "relative min-h-[72px] border-b border-r border-border/70 p-1.5 text-left transition-colors",
          inMonth ? "bg-background hover:bg-accent/50" : "bg-muted/30 text-muted-foreground/40",
          isFirst && "ring-2 ring-brand ring-inset",
          !selectedMember && "cursor-default"
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-medium", holiday && "text-destructive")}>{format(date, "d")}</span>
          {holiday && <span className="text-[9px] uppercase font-semibold text-destructive/80">Hol</span>}
        </div>
        {holiday && (
          <div className="mt-0.5 text-[9px] leading-tight text-destructive/70 truncate" title={holidayName(ds)}>
            {holidayName(ds)}
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-0.5">
          {onVac.map(m => (
            <span key={m.name} className={cn("h-2 w-2 rounded-full", MEMBER_DOT[memberIndex(teamMembers, m.name) % MEMBER_DOT.length])} title={m.name} />
          ))}
        </div>
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold tracking-tight">{format(month, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMonthChange(addDays(monthStart, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMonthChange(addDays(monthStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {firstClick && (
        <div className="mb-3 text-xs text-brand bg-brand/10 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>Click a second date to set a vacation range for <strong>{selectedMember}</strong> (start {format(firstClick, "MMM d")}).</span>
          <button onClick={() => setFirstClick(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="grid grid-cols-7 border-l border-t border-border/70 rounded-lg overflow-hidden">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-center py-1.5 border-b border-r border-border/70 bg-muted/30">{d}</div>
        ))}
        {weeks.flat().map(cell)}
      </div>

      {vacations.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-medium mb-2">Planned time off</h4>
          <div className="space-y-1.5">
            {vacations.map(v => (
              <div key={v.id} className="flex items-center justify-between text-sm rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", MEMBER_DOT[memberIndex(teamMembers, v.team_member_name) % MEMBER_DOT.length])} />
                  <span className="font-medium truncate">{v.team_member_name}</span>
                  <span className="text-muted-foreground tabular-nums">{v.start_date} → {v.end_date}</span>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteVacation(v.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}