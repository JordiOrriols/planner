import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button, SelectField } from "@jordiorriols/ui";
import { CalendarDays, ChartGantt } from "@jordiorriols/ui/icons";
import VacationCalendar from "@/components/organisms/vacation-calendar";
import { VacationEditor } from "@/components/organisms/vacation-editor";
import type { CalendarMember, LinkedTeam, Vacation, SprintResult } from "@/types/planner";
import SquadVelocity from "@/components/organisms/squad-velocity";
import VacationTimeline from "@/components/organisms/vacation-timeline";

export default function VacationsView({
  members,
  linkedTeams,
  vacations,
  workspace,
  canEdit,
  refresh,
  repository,
  readOnlyNotice,
}: {
  members: CalendarMember[];
  linkedTeams: LinkedTeam[];
  vacations: Vacation[];
  workspace: { id: string; sprint_start_date: string; sprint_history: SprintResult[] };
  canEdit: boolean;
  readOnlyNotice?: string;
  refresh: () => Promise<void>;
  repository: {
    setVacations: (
      member: string,
      start: string,
      end: string,
      working: boolean
    ) => Promise<unknown>;
    setSprintCalibration: (
      workspace: string,
      anchor: string,
      history: SprintResult[]
    ) => Promise<unknown>;
  };
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const selectedMember =
    members.find((member) => member.id === selected) ??
    members.find((member) => member.can_edit) ??
    members[0];
  const [month, setMonth] = useState(new Date());
  const assignable = members.filter((member) => member.role !== null);
  const unassigned = members.length - assignable.length;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("vacations.title")}</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(showCalendar ? "vacations.showTimeline" : "vacations.showCalendar")}
          onClick={() => setShowCalendar((value) => !value)}
        >
          {showCalendar ? (
            <ChartGantt className="size-5" aria-hidden="true" />
          ) : (
            <CalendarDays className="size-5" aria-hidden="true" />
          )}
        </Button>
      </div>
      <p className="text-muted-foreground">{t("vacations.description")}</p>
      {!!unassigned && (
        <p role="status">{t("vacations.unassignedNotice", { count: unassigned })}</p>
      )}
      <SquadVelocity
        members={assignable}
        linkedTeams={linkedTeams}
        vacations={vacations}
        startDate={new Date()}
        sprintStart={workspace.sprint_start_date}
        history={workspace.sprint_history}
        {...(canEdit
          ? {
              onSaveCalibration: async (anchor, history) => {
                await repository.setSprintCalibration(workspace.id, anchor, history);
                await refresh();
              },
            }
          : {})}
      />
      <section
        hidden={!showCalendar}
        className="panel p-5 space-y-4"
        aria-label={t("vacations.calendarTitle")}
      >
        <h2 className="font-semibold">{t("vacations.calendarTitle")}</h2>
        {selectedMember ? (
          <>
            <label className="block">
              {t("vacations.member")}
              <SelectField
                aria-label={t("vacations.member")}
                value={selectedMember.id}
                onValueChange={setSelected}
                options={members.map((member) => ({ value: member.id, label: member.name }))}
              />
            </label>
            <VacationEditor
              key={selectedMember.id}
              member={selectedMember}
              members={members}
              vacations={vacations}
              month={month}
              onMonthChange={setMonth}
              canEdit={selectedMember.can_edit}
              {...(readOnlyNotice ? { readOnlyNotice } : {})}
              save={async (start, end, working) => {
                await repository.setVacations(selectedMember.id, start, end, working);
                await refresh();
              }}
            />
          </>
        ) : (
          <VacationCalendar
            month={month}
            onMonthChange={setMonth}
            teamMembers={members}
            vacations={vacations}
            selectedMember=""
            onSelectRange={() => {}}
            disabled
          />
        )}
      </section>
      <div hidden={showCalendar}>
        <VacationTimeline members={members} teams={linkedTeams} vacations={vacations} />
      </div>
    </div>
  );
}
