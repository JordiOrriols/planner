import React, { useState } from "react";
import { Button } from "@jordiorriols/ui";
import VacationCalendar from "./vacation-calendar";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { parseDate } from "@/lib/planning";
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
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [working, setWorking] = useState(false);
  const action = useAsyncAction();
  const overrides = availability.filter((item) => item.member_id === member.id);
  return (
    <div className="space-y-4">
      <VacationCalendar
        month={month}
        onMonthChange={onMonthChange}
        teamMembers={members}
        availability={availability}
        selectedMember={member.id}
        onSelectRange={(start, end) => {
          setStart(start);
          setEnd(end);
        }}
        disabled={!canEdit || action.busy}
      />
      <form
        className="flex flex-wrap gap-3 items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            const first = parseDate(start),
              last = parseDate(end);
            if (!hasHolidayCalendar(start) || !hasHolidayCalendar(end))
              throw new Error("Choose dates in a verified holiday year (2026 or 2027).");
            if (last < first || (last.getTime() - first.getTime()) / 86400000 > 365)
              throw new Error("Choose a date range of at most 366 days.");
            await save(start, end, working);
          });
        }}
      >
        <label>
          From
          <input
            aria-label="From"
            className="field"
            type="date"
            required
            min="2026-01-01"
            max="2027-12-31"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={!canEdit || action.busy}
          />
        </label>
        <label>
          To
          <input
            aria-label="To"
            className="field"
            type="date"
            required
            min="2026-01-01"
            max="2027-12-31"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={!canEdit || action.busy}
          />
        </label>
        <label>
          Availability
          <select
            className="field"
            value={working ? "working" : "off"}
            onChange={(e) => setWorking(e.target.value === "working")}
            disabled={!canEdit || action.busy}
          >
            <option value="off">Not working (vacation)</option>
            <option value="working">Working</option>
          </select>
        </label>
        <Button type="submit" disabled={!canEdit || action.busy}>
          Save availability
        </Button>
      </form>
      {!canEdit && (
        <p>
          Only a Ladders team owner/editor can edit this member. Members can use their personal
          vacation link.
        </p>
      )}
      {action.error && <p role="alert">{action.error}</p>}
      <ul className="space-y-2">
        {overrides.map((override) => (
          <li key={override.date} className="flex items-center gap-3">
            <span>
              {override.date}: {override.is_working ? "Working" : "Not working"}
            </span>
            <Button
              variant="outline"
              disabled={!canEdit || action.busy}
              onClick={() => void action.run(() => clear(override.date))}
            >
              Restore calendar default for {override.date}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
