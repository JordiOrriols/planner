import { useTranslation } from "react-i18next";
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
}: {
  member: Pick<PlannerMember, "id" | "name" | "role">;
  members: Pick<PlannerMember, "id" | "name" | "role">[];
  availability: Availability[];
  month: Date;
  onMonthChange: (month: Date) => void;
  canEdit: boolean;
  save: (start: string, end: string, working: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();

  const [range, setRange] = useState<{ start: string; end: string | null } | null>(null);
  const action = useAsyncAction();
  function apply(working: boolean) {
    void action.run(async () => {
      if (!canEdit) throw new Error(t("copy.youCannotEditThisMemberSAvailability"));
      if (!range) throw new Error(t("copy.selectDatesOnTheCalendarFirst"));
      const end = range.end ?? range.start;
      const first = parseDate(range.start),
        last = parseDate(end);
      if (!hasHolidayCalendar(range.start) || !hasHolidayCalendar(end))
        throw new Error(t("copy.chooseDatesInAVerifiedHolidayYear2026"));
      if (last < first || differenceInCalendarDays(last, first) > 365)
        throw new Error(t("copy.chooseADateRangeOfAtMost366"));
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
          {t("copy.vacations")}
        </Button>
        <Button
          variant="outline"
          disabled={!canEdit || action.busy || !range}
          onClick={() => apply(true)}
        >
          {t("copy.workingDay")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("copy.workingDayRemovesSavedVacationsInTheSelected")}
      </p>
      {!canEdit && <p>{t("copy.onlyALaddersTeamOwnerEditorCanEdit")}</p>}
      {action.error && <p role="alert">{action.error}</p>}
    </div>
  );
}
