import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import React, { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { AppSkeleton, Button, Input, Label } from "@jordiorriols/ui";
import { useData } from "./DataProvider";
import {
  type Workspace,
  type Feature,
  type MainProject,
  type PlannerMember,
  type Availability,
  type LinkedTeam,
} from "@/types/planner";

interface WorkspaceContextValue {
  workspace: Workspace;
  workspaces: Workspace[];
  features: Feature[];
  mainProjects: MainProject[];
  members: PlannerMember[];
  availability: Availability[];
  linkedTeams: LinkedTeam[];
  isOwner: boolean;
  canEdit: boolean;
  userId: string;
  selectWorkspace: (id: string) => void;
  createWorkspace: () => void;
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

  const { repository, user, signOut } = useData();
  const client = useQueryClient();
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const action = useAsyncAction();
  const directoryKey = ["planner-directory", user?.id];
  const directory = useQuery({
    queryKey: directoryKey,
    enabled: !!repository,
    queryFn: async () => {
      if (!repository) throw new Error(t("workspace.errors.signInToLoad"));
      return { workspaces: await repository.listWorkspaces() };
    },
  });
  const workspace =
    directory.data?.workspaces.find((item) => item.id === selected) ??
    directory.data?.workspaces[0];
  const data = useQuery({
    queryKey: ["planner-workspace", user?.id, workspace?.id],
    enabled: !!workspace && !!repository,
    queryFn: () => {
      if (!repository || !workspace) throw new Error(t("workspace.select"));
      return repository.loadWorkspace(workspace.id);
    },
  });
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["planner-directory", user?.id] }),
      client.invalidateQueries({ queryKey: ["planner-workspace", user?.id] }),
    ]);
  }
  if (!repository || !user) throw new Error(t("workspace.errors.signInToOpen"));
  if (directory.isPending || (workspace && data.isPending))
    return <AppSkeleton label={t("workspace.loading")} />;
  if (directory.error || data.error)
    return (
      <div className="p-8 space-y-4">
        <p role="alert">{(directory.error ?? data.error)?.message}</p>
        <p>{t("workspace.errors.migrationRequired")}</p>
        <Button onClick={() => void refresh()}>{t("common.actions.retry")}</Button>
        <Button variant="ghost" onClick={() => void action.run(signOut)}>
          {t("common.actions.signOut")}
        </Button>
        {action.error && <p role="alert">{action.error}</p>}
      </div>
    );
  if (creating || !workspace || !data.data)
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
              const created = await repository.createWorkspace(name);
              setSelected(created.id);
              setCreating(false);
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
          {!!workspace && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreating(false)}
              disabled={action.busy}
            >
              {t("common.actions.cancel")}
            </Button>
          )}
        </form>
      </main>
    );
  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaces: directory.data?.workspaces ?? [],
        ...data.data,
        isOwner: workspace.owner_id === user.id,
        userId: user.id,
        selectWorkspace: setSelected,
        createWorkspace: () => setCreating(true),
        refresh,
      }}
    >
      <React.Fragment key={workspace.id}>{children}</React.Fragment>
    </WorkspaceContext.Provider>
  );
}
