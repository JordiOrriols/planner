import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";
import { ROLE_LABELS } from "@/lib/planning";
import { ROLES, type LinkedTeam } from "@/types/planner";

function WorkspaceTeams({ linkedTeams, isOwner }: { linkedTeams: LinkedTeam[]; isOwner: boolean }) {
  const { t } = useTranslation();
  const { workspace, refresh } = useWorkspace();
  const { repository } = useData();
  const [name, setName] = useState("");
  const action = useAsyncAction();
  return (
    <section className="panel p-5 space-y-3" aria-label={t("teamConfiguration.teams.title")}>
      <h2 className="font-semibold">{t("teamConfiguration.teams.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("teamConfiguration.teams.description")}</p>
      {linkedTeams.length ? (
        <ul className="flex flex-wrap gap-2">
          {linkedTeams.map((team) => (
            <li key={team.id} className="rounded-md border px-3 py-1 text-sm">
              {team.name}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("teamConfiguration.teams.empty")}</p>
      )}
      {isOwner && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              if (!repository) throw new Error(t("teamConfiguration.errors.signInToCreate"));
              await repository.createTeam(workspace.id, name);
              setName("");
              await refresh();
            });
          }}
        >
          <input
            className="field w-auto"
            aria-label={t("teamConfiguration.teams.nameLabel")}
            placeholder={t("teamConfiguration.teams.namePlaceholder")}
            value={name}
            maxLength={120}
            disabled={action.busy}
            onChange={(event) => setName(event.target.value)}
          />
          <Button disabled={action.busy || !name.trim()} type="submit">
            {t("teamConfiguration.teams.create")}
          </Button>
        </form>
      )}
      {action.error && <p role="alert">{action.error}</p>}
    </section>
  );
}

export default function TeamConfiguration() {
  const { t } = useTranslation();
  const { members, linkedTeams, refresh, isOwner } = useWorkspace();
  const { repository } = useData();
  const [copiedMember, setCopiedMember] = useState<string | null>(null);
  const action = useAsyncAction();
  if (!repository) throw new Error(t("vacations.errors.signInRequired"));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("teamConfiguration.title")}</h1>
      <WorkspaceTeams linkedTeams={linkedTeams} isOwner={isOwner} />
      <section className="panel p-5 space-y-3" aria-label={t("teamConfiguration.members.title")}>
        <h2 className="font-semibold">{t("teamConfiguration.members.title")}</h2>
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
      </section>
    </div>
  );
}
