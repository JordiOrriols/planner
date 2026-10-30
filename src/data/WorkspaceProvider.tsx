import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import React, { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncAction, useWorkspaceList } from "@jordiorriols/ui/hooks";
import {
  AppSkeleton,
  Button,
  Input,
  Label,
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
  const { t } = useTranslation();

  const { repository, workspaceApi, user, signOut } = useData();
  const client = useQueryClient();
  const directory = useWorkspaceList(workspaceApi, "planner");
  const [name, setName] = useState("");
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
        <p role="alert">{directory.error ?? data.error?.message}</p>
        <p>{t("workspace.errors.migrationRequired")}</p>
        <Button onClick={() => void refresh()}>{t("common.actions.retry")}</Button>
        <Button variant="ghost" onClick={() => void action.run(signOut)}>
          {t("common.actions.signOut")}
        </Button>
        {action.error && <p role="alert">{action.error}</p>}
      </div>
    );
  if (!summary || !data.data)
    return (
      <main className="max-w-xl mx-auto p-8 space-y-6">
        <h1 className="text-2xl font-semibold">{t("workspace.create.title")}</h1>
        <p className="text-muted-foreground">{t("workspace.create.description")}</p>
        <Button variant="ghost" disabled={action.busy} onClick={() => void action.run(signOut)}>
          {t("common.actions.signOut")}
        </Button>
        {action.error && (
          <p role="alert" className="text-destructive">
            {action.error}
          </p>
        )}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              const created = await workspaceApi.createWorkspace(name);
              directory.select(created.id);
              setName("");
              await refresh();
            });
          }}
        >
          <Label htmlFor="workspace-name">{t("workspace.create.name")}</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
          <Button type="submit" disabled={action.busy}>
            {t("workspace.create.submit")}
          </Button>
        </form>
      </main>
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
