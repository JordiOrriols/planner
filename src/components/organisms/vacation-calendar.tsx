import { useTranslation } from "react-i18next";
import React from "react";
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
import { fmtMonth } from "@/lib/planning";
import type { PlannerMember, Availability } from "@/types/planner";
import { cn } from "@/lib/utils";

const MEMBER_TONES = [
  "bg-sky-700 text-white",
  "bg-emerald-700 text-white",
  "bg-amber-700 text-white",
  "bg-rose-700 text-white",
  "bg-violet-700 text-white",
  "bg-slate-700 text-white",
];

export default function VacationCalendar({
  month,
  onMonthChange,
  teamMembers,
  availability,
  selectedMember,
  onSelectRange,
  disabled,
  selectedRange = null,
  onClearSelection,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  teamMembers: Pick<PlannerMember, "id" | "name" | "role">[];
  availability: Availability[];
  selectedMember: string;
  onSelectRange: (start: string, end: string | null) => void;
  disabled: boolean;
  selectedRange?: { start: string; end: string | null } | null;
  onClearSelection?: () => void;
}) {
  const { t, i18n } = useTranslation();

  const first = selectedRange?.end === null ? selectedRange.start : null;
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{fmtMonth(month)}</h3>
        <div className="flex gap-1">
          <Button
            aria-label={t("vacationCalendar.navigation.previous")}
            size="icon"
            variant="ghost"
            onClick={() => {
              onMonthChange(addMonths(month, -1));
            }}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            aria-label={t("vacationCalendar.navigation.next")}
            size="icon"
            variant="ghost"
            onClick={() => {
              onMonthChange(addMonths(month, 1));
            }}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      {!disabled && (
        <p role="status" className="text-sm mb-3 text-muted-foreground">
          {first
            ? t("vacationCalendar.selection.chooseEnd")
            : t("vacationCalendar.selection.chooseRange")}{" "}
          {selectedRange && (
            <button
              type="button"
              className="underline"
              onClick={() => {
                onClearSelection?.();
              }}
            >
              {t("vacationCalendar.selection.clear")}
            </button>
          )}
        </p>
      )}
      <div
        className="flex flex-wrap gap-x-4 gap-y-2 mb-3 text-xs"
        aria-label={t("vacationCalendar.legend.label")}
      >
        {teamMembers.map((member, index) => (
          <span key={member.id} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "size-5 rounded-full flex items-center justify-center font-semibold",
                MEMBER_TONES[index % MEMBER_TONES.length]
              )}
            >
              {member.name.trim().charAt(0).toLocaleUpperCase()}
            </span>
            {member.name}
            {member.id === selectedMember ? t("vacationCalendar.legend.selectedSuffix") : ""}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t border-l rounded-lg overflow-hidden">
        {days.slice(0, 7).map((day) => (
          <div key={day.getTime()} className="text-xs text-center py-2 bg-muted border-b border-r">
            {new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: "short" }).format(day)}
          </div>
        ))}
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd");
          const supported = hasHolidayCalendar(key);
          const holiday = holidayName(key);
          const off = teamMembers.filter((member) =>
            availability.some(
              (item) => item.member_id === member.id && item.date === key && !item.is_working
            )
          );
          const selected =
            !!selectedRange &&
            key >= selectedRange.start &&
            key <= (selectedRange.end ?? selectedRange.start);
          return (
            <button
              key={key}
              type="button"
              aria-label={`${key}${holiday ? ` ${holiday}` : ""}`}
              aria-pressed={selected}
              disabled={disabled || !supported}
              onClick={() => {
                if (!first) {
                  onSelectRange(key, null);
                  return;
                }
                onSelectRange(first < key ? first : key, first < key ? key : first);
              }}
              className={cn(
                "min-h-20 min-w-0 p-1 sm:p-2 border-b border-r text-left text-xs hover:bg-accent disabled:cursor-default",
                !isSameMonth(date, month) && "opacity-40",
                selected && "bg-brand/15 ring-1 ring-inset ring-brand/40",
                (key === selectedRange?.start || key === selectedRange?.end) &&
                  "ring-2 ring-inset ring-brand"
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
                    className="inline-flex min-w-0 items-center gap-1"
                    title={t("vacationCalendar.memberVacation", { memberName: member.name })}
                    aria-label={t("vacationCalendar.memberVacation", { memberName: member.name })}
                  >
                    <span
                      className={cn(
                        "size-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-semibold",
                        MEMBER_TONES[
                          teamMembers.findIndex((item) => item.id === member.id) %
                            MEMBER_TONES.length
                        ]
                      )}
                    >
                      {member.name.trim().charAt(0).toLocaleUpperCase()}
                    </span>
                    <span className="hidden sm:inline truncate text-[10px]">{member.name}</span>
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      {!hasHolidayCalendar(format(month, "yyyy-MM-dd")) && (
        <p role="alert" className="mt-3">
          {t("vacationCalendar.unverifiedYearNotice")}
        </p>
      )}
    </div>
  );
}
