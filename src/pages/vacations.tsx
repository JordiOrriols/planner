import React from "react";
import { useTranslation } from "react-i18next";
import VacationsView from "@/components/organisms/vacations-view";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";

export default function Vacations() {
  const { t } = useTranslation();
  const { members, linkedTeams, vacations, refresh, workspace, canEdit } = useWorkspace();
  const { repository } = useData();
  if (!repository) throw new Error(t("vacations.errors.signInRequired"));
  return (
    <VacationsView
      {...{ members, linkedTeams, vacations, refresh, workspace, canEdit, repository }}
    />
  );
}
