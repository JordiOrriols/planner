import React, { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  format,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "@jordiorriols/ui/icons";
import { Button } from "@jordiorriols/ui";
import { hasHolidayCalendar, holidayName } from "@/lib/barcelonaHolidays";
import { isWorking } from "@/lib/planning";
import type { PlannerMember, Availability } from "@/types/planner";
import { cn } from "@/lib/utils";

export default function VacationCalendar({
  month,
  onMonthChange,
  teamMembers,
  availability,
  selectedMember,
  onSelectRange,
  disabled,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  teamMembers: PlannerMember[];
  availability: Availability[];
  selectedMember: string;
  onSelectRange: (start: string, end: string) => void;
  disabled: boolean;
}) {
  const [first, setFirst] = useState<string | null>(null);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{format(month, "MMMM yyyy")}</h3>
        <div className="flex gap-1">
          <Button
            aria-label="Previous month"
            size="icon"
            variant="ghost"
            onClick={() => {
              setFirst(null);
              onMonthChange(addMonths(month, -1));
            }}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            aria-label="Next month"
            size="icon"
            variant="ghost"
            onClick={() => {
              setFirst(null);
              onMonthChange(addMonths(month, 1));
            }}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      {first && (
        <p role="status" className="text-sm mb-3">
          Select the last day after {first}.{" "}
          <button className="underline" onClick={() => setFirst(null)}>
            Cancel selection
          </button>
        </p>
      )}
      <div className="grid grid-cols-7 border-t border-l rounded-lg overflow-hidden">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="text-xs text-center py-2 bg-muted border-b border-r">
            {day}
          </div>
        ))}
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd");
          const supported = hasHolidayCalendar(key);
          const holiday = holidayName(key);
          const off = supported
            ? teamMembers.filter((member) => !isWorking(member, date, availability))
            : [];
          return (
            <button
              key={key}
              type="button"
              aria-label={`${key}${holiday ? ` ${holiday}` : ""}`}
              disabled={disabled || !supported}
              onClick={() => {
                if (!first) {
                  setFirst(key);
                  return;
                }
                onSelectRange(first < key ? first : key, first < key ? key : first);
                setFirst(null);
              }}
              className={cn(
                "min-h-20 p-2 border-b border-r text-left text-xs hover:bg-accent disabled:cursor-default",
                !isSameMonth(date, month) && "opacity-40",
                first === key && "ring-2 ring-inset ring-primary"
              )}
            >
              <span className={holiday ? "text-destructive font-semibold" : ""}>
                {format(date, "d")}
              </span>
              {holiday && (
                <div className="text-[9px] text-destructive truncate" title={holiday}>
                  {holiday}
                </div>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                {off.map((member) => (
                  <span
                    key={member.id}
                    className={cn(
                      "h-2 w-2 rounded-full",
                      member.id === selectedMember ? "bg-indigo-500" : "bg-slate-300"
                    )}
                    title={`${member.name}: not working`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
      {!hasHolidayCalendar(format(month, "yyyy-MM-dd")) && (
        <p role="alert" className="mt-3">
          Barcelona holidays are verified only for 2026 and 2027. Update the calendar before
          planning this year.
        </p>
      )}
    </div>
  );
}
