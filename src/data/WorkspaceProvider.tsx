import React, { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { Button, Input, Label } from "@jordiorriols/ui";
import { useData } from "./DataProvider";
import {
  ROLES,
  type Workspace,
  type Project,
  type PlannerMember,
  type Availability,
  type Role,
} from "@/types/planner";
import { ROLE_LABELS } from "@/lib/planning";

interface WorkspaceContextValue {
  workspace: Workspace;
  workspaces: Workspace[];
  projects: Project[];
  members: PlannerMember[];
  availability: Availability[];
  isOwner: boolean;
  userId: string;
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { repository, user } = useData();
  const client = useQueryClient();
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [role, setRole] = useState<Role>("backend");
  const action = useAsyncAction();
  const directoryKey = ["planner-directory", user?.id];
  const directory = useQuery({
    queryKey: directoryKey,
    enabled: !!repository,
    queryFn: async () => {
      if (!repository) throw new Error("Sign in before loading workspaces");
      const [workspaces, invitations] = await Promise.all([
        repository.listWorkspaces(),
        repository.listInvitations(),
      ]);
      return { workspaces, invitations };
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
      </div>
    );
  if (!workspace || !data.data)
    return (
      <main className="max-w-xl mx-auto p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Your planning workspace</h1>
        <p className="text-muted-foreground">
          Create a squad or accept an invitation sent to {user.email}.
        </p>
        {action.error && (
          <p role="alert" className="text-destructive">
            {action.error}
          </p>
        )}
        {directory.data?.invitations.map((invitation) => (
          <Button
            key={invitation.member_id}
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await repository.acceptInvitation(invitation.member_id);
                await refresh();
              })
            }
          >
            Join {invitation.workspace_name}
          </Button>
        ))}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              const created = await repository.createWorkspace(name, memberName, role);
              setSelected(created.id);
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
          <Label htmlFor="member-name">Your name</Label>
          <Input
            id="member-name"
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            required
            maxLength={120}
          />
          <Label htmlFor="member-role">Your role</Label>
          <select
            id="member-role"
            className="field"
            value={role}
            onChange={(event) =>
              setRole(ROLES.find((item) => item === event.target.value) ?? "backend")
            }
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={action.busy}>
            Create workspace
          </Button>
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
        refresh,
      }}
    >
      {children}
      {!!directory.data?.invitations.length && (
        <section
          className="mx-auto max-w-7xl px-6 pb-8 space-y-2"
          aria-label="Workspace invitations"
        >
          {directory.data.invitations.map((invitation) => (
            <Button
              key={invitation.member_id}
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await repository.acceptInvitation(invitation.member_id);
                  await refresh();
                })
              }
            >
              Join {invitation.workspace_name}
            </Button>
          ))}
          {action.error && <p role="alert">{action.error}</p>}
        </section>
      )}
    </WorkspaceContext.Provider>
  );
}
