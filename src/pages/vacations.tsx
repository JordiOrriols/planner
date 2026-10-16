import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button, Skeleton } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useQuery } from "@tanstack/react-query";
import VacationCalendar from "@/components/organisms/vacation-calendar";
import { AvailabilityEditor } from "@/components/organisms/availability-editor";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";
import { ROLE_LABELS } from "@/lib/planning";
import SquadVelocity from "@/components/organisms/squad-velocity";
import { ROLES, type LinkedTeam } from "@/types/planner";

function TeamPicker({ linkedTeams }: { linkedTeams: LinkedTeam[] }) {
  const { t } = useTranslation();

  const { workspace, refresh } = useWorkspace();
  const { repository, user } = useData();
  const query = useQuery({
    queryKey: ["planner-ladders-teams", user?.id, workspace.id],
    queryFn: () => {
      if (!repository) throw new Error(t("teamConfiguration.errors.signInToLoad"));
      return repository.listTeams();
    },
  });
  const [selected, setSelected] = useState(linkedTeams.map((team) => team.id));
  const action = useAsyncAction();
  const teams = new Map(linkedTeams.map((team) => [team.id, { ...team, canLink: true }]));
  for (const team of query.data ?? [])
    teams.set(team.id, { ...team, canLink: team.access_level !== "viewer" });
  return (
    <form
      className="panel p-5 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(async () => {
          if (!repository) throw new Error(t("teamConfiguration.errors.signInToLink"));
          await repository.setWorkspaceTeams(workspace.id, selected);
          await refresh();
        });
      }}
    >
      <h3 className="font-semibold">{t("teamConfiguration.teams.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("teamConfiguration.teams.description")}</p>
      {query.isPending && (
        <div
          role="status"
          aria-label={t("teamConfiguration.teams.loading")}
          aria-busy="true"
          className="space-y-2"
        >
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-36" />
        </div>
      )}
      {query.error && <p role="alert">{query.error.message}</p>}
      {!query.isPending && !query.error && !teams.size && (
        <p>{t("teamConfiguration.teams.empty")}</p>
      )}
      {[...teams.values()].map((team) => (
        <label key={team.id} className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={selected.includes(team.id)}
            disabled={action.busy || (!team.canLink && !linkedTeams.some((t) => t.id === team.id))}
            onChange={(event) =>
              setSelected((ids) =>
                event.target.checked ? [...ids, team.id] : ids.filter((id) => id !== team.id)
              )
            }
          />
          {team.name}
          {!team.canLink && (
            <span className="text-sm text-muted-foreground">
              {t("teamConfiguration.teams.viewOnly")}
            </span>
          )}
        </label>
      ))}
      {action.error && <p role="alert">{action.error}</p>}
      <Button disabled={action.busy || query.isPending || !!query.error} type="submit">
        {t("teamConfiguration.teams.save")}
      </Button>
    </form>
  );
}

export default function Vacations() {
  const { t } = useTranslation();

  const { members, linkedTeams, availability, refresh, isOwner } = useWorkspace();
  const { repository } = useData();
  const [selected, setSelected] = useState("");
  const selectedMember = members.find((member) => member.id === selected) ?? members[0];
  const [month, setMonth] = useState(new Date());
  const [copiedMember, setCopiedMember] = useState<string | null>(null);
  const action = useAsyncAction();
  if (!repository) throw new Error(t("vacations.errors.signInRequired"));
  const assignable = members.filter((member) => member.role !== null);
  const unassigned = members.length - assignable.length;
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
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
      <section className="space-y-4" aria-labelledby="vacations-configuration">
        <h2 id="vacations-configuration" className="text-xl font-semibold">
          {t("vacations.configurationTitle")}
        </h2>
        {isOwner && (
          <TeamPicker
            key={linkedTeams.map((team) => team.id).join(",")}
            linkedTeams={linkedTeams}
          />
        )}
        <div className="panel p-5 space-y-3">
          <h3 className="font-semibold">{t("teamConfiguration.members.title")}</h3>
          {!members.length && <p>{t("teamConfiguration.members.empty")}</p>}
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{member.name}</span>
              <span className="text-sm text-muted-foreground">
                {linkedTeams.find((team) => team.id === member.team_id)?.name}
              </span>
              <select
                className="field w-auto"
                aria-label={t("teamConfiguration.members.roleLabel", { memberName: member.name })}
                value={member.role ?? ""}
                disabled={!member.can_edit || action.busy}
                onChange={(event) => {
                  const role = ROLES.find((role) => role === event.target.value) ?? null;
                  void action.run(async () => {
                    await repository.updatePlanningRole(member.id, role);
                    await refresh();
                  });
                }}
              >
                <option value="">{t("teamConfiguration.members.unassigned")}</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              {member.vacation_token && (
                <Button
                  variant="outline"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      const url = new URL(window.location.href);
                      url.hash = `/vacations/${member.vacation_token}`;
                      await navigator.clipboard.writeText(url.toString());
                      setCopiedMember(member.id);
                    })
                  }
                >
                  {t("teamConfiguration.members.copyLink", { memberName: member.name })}
                </Button>
              )}
              {copiedMember === member.id && (
                <span role="status" className="text-sm">
                  {t("teamConfiguration.members.linkCopied")}
                </span>
              )}
            </div>
          ))}
          {action.error && <p role="alert">{action.error}</p>}
        </div>
      </section>
    </div>
  );
}
