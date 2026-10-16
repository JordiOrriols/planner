import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import VacationCalendar from "@/components/organisms/vacation-calendar";
import { AvailabilityEditor } from "@/components/organisms/availability-editor";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";
import SquadVelocity from "@/components/organisms/squad-velocity";

export default function Vacations() {
  const { t } = useTranslation();
  const { members, linkedTeams, availability, refresh } = useWorkspace();
  const { repository } = useData();
  const [selected, setSelected] = useState("");
  const selectedMember = members.find((member) => member.id === selected) ?? members[0];
  const [month, setMonth] = useState(new Date());
  if (!repository) throw new Error(t("vacations.errors.signInRequired"));
  const assignable = members.filter((member) => member.role !== null);
  const unassigned = members.length - assignable.length;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("vacations.title")}</h1>
      <p className="text-muted-foreground">{t("vacations.description")}</p>
      {!!unassigned && (
        <p role="status">{t("vacations.unassignedNotice", { count: unassigned })}</p>
      )}
      <SquadVelocity
        members={assignable}
        linkedTeams={linkedTeams}
        availability={availability}
        startDate={month}
      />
      <section className="panel p-5 space-y-4" aria-label={t("vacations.calendarTitle")}>
        <h2 className="font-semibold">{t("vacations.calendarTitle")}</h2>
        {selectedMember ? (
          <>
            <label className="block">
              {t("vacations.member")}
              <select
                aria-label={t("vacations.member")}
                className="field"
                value={selectedMember.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <AvailabilityEditor
              key={selectedMember.id}
              member={selectedMember}
              members={members}
              availability={availability}
              month={month}
              onMonthChange={setMonth}
              canEdit={selectedMember.can_edit}
              save={async (start, end, working) => {
                await repository.setAvailability(selectedMember.id, start, end, working);
                await refresh();
              }}
            />
          </>
        ) : (
          <VacationCalendar
            month={month}
            onMonthChange={setMonth}
            teamMembers={members}
            availability={availability}
            selectedMember=""
            onSelectRange={() => {}}
            disabled
          />
        )}
      </section>
    </div>
  );
}
