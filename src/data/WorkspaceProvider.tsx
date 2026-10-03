import React, { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { Button, Input, Label } from "@jordiorriols/ui";
import { useData } from "./DataProvider";
import {
  type Workspace,
  type Project,
  type PlannerMember,
  type Availability,
  type LinkedTeam,
} from "@/types/planner";

interface WorkspaceContextValue {
  workspace: Workspace;
  workspaces: Workspace[];
  projects: Project[];
  members: PlannerMember[];
  availability: Availability[];
  linkedTeams: LinkedTeam[];
  isOwner: boolean;
  userId: string;
  selectWorkspace: (id: string) => void;
  createWorkspace: () => void;
  refresh: () => Promise<void>;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
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
      if (!repository) throw new Error("Sign in before loading workspaces");
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
      if (!repository || !workspace) throw new Error("Select a workspace");
      return repository.loadWorkspace(workspace.id);
    },
  });
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["planner-directory", user?.id] }),
      client.invalidateQueries({ queryKey: ["planner-workspace", user?.id] }),
    ]);
  }
  if (!repository || !user) throw new Error("Sign in before opening Planner");
  if (directory.isPending || (workspace && data.isPending))
    return (
      <p role="status" className="p-8">
        Loading your workspace...
      </p>
    );
  if (directory.error || data.error)
    return (
      <div className="p-8 space-y-4">
        <p role="alert">{(directory.error ?? data.error)?.message}</p>
        <p>Confirm the Planner migration is installed in your Supabase project.</p>
        <Button onClick={() => void refresh()}>Retry</Button>
        <Button variant="ghost" onClick={() => void action.run(signOut)}>
          Sign out
        </Button>
        {action.error && <p role="alert">{action.error}</p>}
      </div>
    );
  if (creating || !workspace || !data.data)
    return (
      <main className="max-w-xl mx-auto p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Your planning workspace</h1>
        <p className="text-muted-foreground">
          Create a planning workspace, then link your existing Ladders teams on the Vacations page.
        </p>
        <Button variant="ghost" disabled={action.busy} onClick={() => void action.run(signOut)}>
          Sign out
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
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
          <Button type="submit" disabled={action.busy}>
            Create workspace
          </Button>
          {!!workspace && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreating(false)}
              disabled={action.busy}
            >
              Cancel
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
