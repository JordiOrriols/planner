import React from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";
import TeamConfigurationView from "@/components/organisms/team-configuration-view";

export default function TeamConfiguration() {
  const { t } = useTranslation();
  const { members, linkedTeams, refresh, isOwner, canEdit, workspace } = useWorkspace();
  const { repository } = useData();
  if (!repository) throw new Error(t("vacations.errors.signInRequired"));
  if (!canEdit) return <Navigate to="/" replace />;
  return (
    <TeamConfigurationView
      {...{ members, linkedTeams, refresh, isOwner }}
      createTeam={(name) => repository.createTeam(workspace.id, name)}
      updatePlanningRole={repository.updatePlanningRole}
      canCopyVacationLink={(id) => !!members.find((member) => member.id === id)?.vacation_token}
      {...(members.some((member) => member.vacation_token)
        ? {
            copyVacationLink: async (id: string) => {
              const member = members.find((member) => member.id === id);
              if (!member?.vacation_token) throw new Error(t("vacationLink.errors.invalidLink"));
              const url = new URL(window.location.href);
              url.hash = `/vacations/${member.vacation_token}`;
              await navigator.clipboard.writeText(url.toString());
            },
          }
        : {})}
    />
  );
}
