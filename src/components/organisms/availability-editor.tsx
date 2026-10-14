import React, { useState } from "react";
import { Button } from "@jordiorriols/ui";
import VacationCalendar from "./vacation-calendar";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { parseDate } from "@/lib/planning";
import { differenceInCalendarDays } from "date-fns";
import { hasHolidayCalendar } from "@/lib/barcelonaHolidays";
import type { Availability, PlannerMember } from "@/types/planner";

export function AvailabilityEditor({
  member,
  members,
  availability,
  month,
  onMonthChange,
  canEdit,
  save,
  clear,
}: {
  member: Pick<PlannerMember, "id" | "name" | "role">;
  members: Pick<PlannerMember, "id" | "name" | "role">[];
  availability: Availability[];
  month: Date;
  onMonthChange: (month: Date) => void;
  canEdit: boolean;
  save: (start: string, end: string, working: boolean) => Promise<void>;
  clear: (date: string) => Promise<void>;
}) {
  const [range, setRange] = useState<{ start: string; end: string | null } | null>(null);
  const action = useAsyncAction();
  const overrides = availability.filter((item) => item.member_id === member.id);
  function apply(working: boolean) {
    void action.run(async () => {
      if (!canEdit) throw new Error("You cannot edit this member's availability.");
      if (!range) throw new Error("Select dates on the calendar first.");
      const end = range.end ?? range.start;
      const first = parseDate(range.start),
        last = parseDate(end);
      if (!hasHolidayCalendar(range.start) || !hasHolidayCalendar(end))
        throw new Error("Choose dates in a verified holiday year (2026 or 2027).");
      if (last < first || differenceInCalendarDays(last, first) > 365)
        throw new Error("Choose a date range of at most 366 days.");
      await save(range.start, end, working);
      setRange({ start: range.start, end });
    });
  }
  return (
    <div className="space-y-4">
      <VacationCalendar
        month={month}
        onMonthChange={onMonthChange}
        teamMembers={members}
        availability={availability}
        selectedMember={member.id}
        selectedRange={range}
        onClearSelection={() => setRange(null)}
        onSelectRange={(start, end) => {
          setRange({ start, end });
        }}
        disabled={!canEdit || action.busy}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canEdit || action.busy || !range} onClick={() => apply(false)}>
          Vacations
        </Button>
        <Button
          variant="outline"
          disabled={!canEdit || action.busy || !range}
          onClick={() => apply(true)}
        >
          Working Day
        </Button>
      </div>
      {!canEdit && (
        <p>
          Only a Ladders team owner/editor can edit this member. Members can use their personal
          vacation link.
        </p>
      )}
      {action.error && <p role="alert">{action.error}</p>}
      <ul className="space-y-2">
        {overrides.map((override) => (
          <li key={override.date} className="flex flex-wrap items-center gap-3">
            <span>
              {override.date}: {override.is_working ? "Working" : "Not working"}
            </span>
            <Button
              aria-label={`Restore calendar default for ${override.date}`}
              variant="outline"
              disabled={!canEdit || action.busy}
              onClick={() => void action.run(() => clear(override.date))}
            >
              Restore default {override.date}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
