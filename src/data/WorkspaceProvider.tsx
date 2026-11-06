import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import React, { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncAction, useWorkspaceList } from "@jordiorriols/ui/hooks";
import {
  AppSkeleton,
  AppShell,
  Button,
  ErrorState,
  WorkspaceSetup,
  type WorkspaceApi,
  type WorkspaceSummary,
} from "@jordiorriols/ui";
import { useData } from "./DataProvider";
import {
  type Workspace,
  type Feature,
  type Project,
  type PlannerMember,
  type Vacation,
  type LinkedTeam,
  type RoadmapMarker,
} from "@/types/planner";

interface WorkspaceContextValue {
  workspace: Workspace;
  workspaces: WorkspaceSummary[];
  workspaceApi: WorkspaceApi;
  features: Feature[];
  projects: Project[];
  markers: RoadmapMarker[];
  members: PlannerMember[];
  vacations: Vacation[];
  linkedTeams: LinkedTeam[];
  isOwner: boolean;
  canEdit: boolean;
  userId: string;
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error(i18n.t("workspace.errors.providerRequired"));
  return value;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();

  const { repository, workspaceApi, user, signOut } = useData();
  const client = useQueryClient();
  const directory = useWorkspaceList(workspaceApi, "planner");
  const action = useAsyncAction();
  const summary = directory.workspace;
  const data = useQuery({
    queryKey: ["planner-workspace", user?.id, summary?.id],
    enabled: !!summary && !!repository,
    queryFn: () => {
      if (!repository || !summary) throw new Error(t("workspace.select"));
      return repository.loadWorkspace(summary.id);
    },
  });
  async function refresh() {
    await Promise.all([
      directory.refresh(),
      client.invalidateQueries({ queryKey: ["planner-workspace", user?.id] }),
    ]);
  }
  if (!repository || !workspaceApi || !user) throw new Error(t("workspace.errors.signInToOpen"));
  if (directory.loading || (summary && data.isPending))
    return <AppSkeleton label={t("workspace.loading")} />;
  if (directory.error || data.error)
    return (
      <div className="p-8 space-y-4">
        <ErrorState
          message={directory.error ?? data.error!.message}
          onRetry={() => void refresh()}
          retryLabel={t("common.actions.retry")}
        />
        <p>{t("workspace.errors.migrationRequired")}</p>
        <Button variant="ghost" onClick={() => void action.run(signOut)}>
          {t("common.actions.signOut")}
        </Button>
        {action.error && <ErrorState message={action.error} />}
      </div>
    );
  if (!summary || !data.data)
    return (
      <AppShell
        projectId="planner"
        footer={{ text: t("app.footer") }}
        header={{
          title: t("planner.name"),
          subtitle: t("planner.subtitle"),
          projectSwitcherLabel: t("planner.switchProject"),
          language: {
            value: i18n.language,
            label: t("header.language"),
            className: "inline-flex",
            onValueChange: (language) =>
              void action.run(async () => {
                await i18n.changeLanguage(language);
              }),
          },
        }}
      >
        {action.error && <ErrorState message={action.error} />}
        <WorkspaceSetup
          api={workspaceApi}
          language={i18n.language}
          onRefresh={directory.refresh}
          onSignOut={signOut}
          onCreated={async (created) => {
            directory.select(created.id);
            await refresh();
          }}
        />
      </AppShell>
    );
  const { workspace, ...loaded } = data.data;
  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaces: directory.workspaces ?? [],
        workspaceApi,
        ...loaded,
        isOwner: summary.access_level === "owner",
        userId: user.id,
        selectWorkspace: directory.select,
        refresh,
      }}
    >
      <React.Fragment key={workspace.id}>{children}</React.Fragment>
    </WorkspaceContext.Provider>
  );
}
