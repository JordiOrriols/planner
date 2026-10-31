import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Label, TimelineCard } from "@jordiorriols/ui";
import { ChevronLeft, ChevronRight } from "@jordiorriols/ui/icons";
import { addDays, addMonths, differenceInCalendarDays, format, startOfMonth } from "date-fns";
import { fmtDate, fmtMonth, parseDate } from "@/lib/planning";
import { vacationTimelineRows } from "@/lib/vacationTimeline";
import type { LinkedTeam, PlannerMember, Vacation } from "@/types/planner";
import { FeatureTitle, useLabelWidth, useToday } from "./roadmap-timeline";

const DAYS = 52 * 7;

export default function VacationTimeline({
  members,
  teams,
  vacations,
}: {
  members: PlannerMember[];
  teams: LinkedTeam[];
  vacations: Vacation[];
}) {
  const { t, i18n } = useTranslation();
  const [start, setStart] = useState(() => startOfMonth(new Date()));
  const labelWidth = useLabelWidth();
  const columns = useMemo(
    () =>
      Array.from({ length: DAYS }, (_, index) => {
        const date = addDays(start, index);
        return {
          id: format(date, "yyyy-MM-dd"),
          label: format(date, "d"),
          group: fmtMonth(date, true),
        };
      }),
    [start, i18n.resolvedLanguage]
  );
  const rows = useMemo(
    () => vacationTimelineRows(members, teams, vacations, start, DAYS),
    [members, teams, vacations, start]
  );
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const today = useToday();
  return (
    <TimelineCard
      aria-label={t("vacationTimeline.title")}
      title={t("vacationTimeline.title")}
      columns={columns}
      columnWidth={16}
      labelWidth={labelWidth}
      labelTitle={t("vacations.member")}
      columnTitle={t("vacationTimeline.day")}
      controls={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("vacationTimeline.previous")}
            onClick={() => setStart((date) => addMonths(date, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Label htmlFor="vacation-timeline-month" className="sr-only">
            {t("vacationTimeline.start")}
          </Label>
          <Input
            id="vacation-timeline-month"
            type="month"
            value={format(start, "yyyy-MM")}
            onChange={(event) => {
              if (event.target.value && event.target.validity.valid)
                setStart(parseDate(`${event.target.value}-01`));
            }}
            className="w-auto"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("vacationTimeline.next")}
            onClick={() => setStart((date) => addMonths(date, 1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      }
      legend={
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-blue-500" />
          {t("vacationTimeline.legend")}
        </span>
      }
      markers={[
        {
          id: "today",
          position: differenceInCalendarDays(today, start) + 0.5,
          label: t("gantt.today.label", { date: fmtDate(today) }),
          caption: t("gantt.today.text"),
        },
      ]}
      rows={rows.map(({ member, runs }) => ({
        id: member.id,
        accessibleLabel: member.name,
        label: <FeatureTitle name={member.name} className="block" />,
        group: {
          id: member.team_id,
          label: teamNames.get(member.team_id) ?? t("vacationTimeline.noTeam"),
        },
        spans: runs.map((run) => ({
          id: format(run.start, "yyyy-MM-dd"),
          label: t("vacationTimeline.span", {
            name: member.name,
            start: fmtDate(run.start),
            end: fmtDate(run.end),
          }),
          start: run.offset,
          end: run.offset + run.length,
          className: "bg-blue-500",
        })),
      }))}
      empty={t("vacationTimeline.empty")}
    />
  );
}
