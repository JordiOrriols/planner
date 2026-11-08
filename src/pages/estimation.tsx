import React from "react";
import { useTranslation } from "react-i18next";
import EstimationView from "@/components/organisms/estimation-view";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";

export default function Estimation() {
  const { t } = useTranslation();
  const { features, projects, workspace, canEdit, refresh } = useWorkspace();
  const { repository } = useData();
  if (!repository) throw new Error(t("estimation.errors.signInRequired"));
  return <EstimationView {...{ features, projects, workspace, canEdit, refresh, repository }} />;
}
