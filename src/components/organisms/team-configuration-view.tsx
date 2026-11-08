import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button, SelectField } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { ROLE_LABELS } from "@/lib/planning";
import { ROLES, type LinkedTeam, type CalendarMember, type Role } from "@/types/planner";

interface ConfigurationProps {
  members: CalendarMember[];
  linkedTeams: LinkedTeam[];
  isOwner: boolean;
  refresh: () => Promise<void>;
  createTeam: (name: string) => Promise<unknown>;
  updatePlanningRole: (member: string, role: Role | null) => Promise<unknown>;
  copyVacationLink?: (member: string) => Promise<void>;
  canCopyVacationLink?: (member: string) => boolean;
}

function WorkspaceTeams({
  linkedTeams,
  isOwner,
  refresh,
  createTeam,
}: Pick<ConfigurationProps, "linkedTeams" | "isOwner" | "refresh" | "createTeam">) {
  const { t } = useTranslation();
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
              await createTeam(name);
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

export default function TeamConfigurationView({
  members,
  linkedTeams,
  refresh,
  isOwner,
  createTeam,
  updatePlanningRole,
  copyVacationLink,
  canCopyVacationLink,
}: ConfigurationProps) {
  const { t } = useTranslation();
  const [copiedMember, setCopiedMember] = useState<string | null>(null);
  const action = useAsyncAction();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("teamConfiguration.title")}</h1>
      <WorkspaceTeams {...{ linkedTeams, isOwner, refresh, createTeam }} />
      <section className="panel p-5 space-y-3" aria-label={t("teamConfiguration.members.title")}>
        <h2 className="font-semibold">{t("teamConfiguration.members.title")}</h2>
        {!members.length && <p>{t("teamConfiguration.members.empty")}</p>}
        {members.map((member) => (
          <div key={member.id} className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{member.name}</span>
            <span className="text-sm text-muted-foreground">
              {linkedTeams.find((team) => team.id === member.team_id)?.name}
            </span>
            <SelectField
              className="w-auto"
              aria-label={t("teamConfiguration.members.roleLabel", { memberName: member.name })}
              value={member.role ?? ""}
              disabled={!member.can_edit || action.busy}
              onValueChange={(value) => {
                const role = ROLES.find((role) => role === value) ?? null;
                void action.run(async () => {
                  await updatePlanningRole(member.id, role);
                  await refresh();
                });
              }}
              options={[
                { value: "", label: t("teamConfiguration.members.unassigned") },
                ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
              ]}
            />
            {copyVacationLink && canCopyVacationLink?.(member.id) && (
              <Button
                variant="outline"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await copyVacationLink(member.id);
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
