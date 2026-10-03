import React, { useState } from "react";
import { Button, ConfirmDialog, EmptyState } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { Plus, Calculator } from "@jordiorriols/ui/icons";
import ProjectForm from "@/components/organisms/project-form";
import ProjectEstimateCard from "@/components/organisms/project-estimate-card";
import { totalDevWeeks } from "@/lib/planning";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";
import type { Project } from "@/types/planner";

export default function Estimation() {
  const { projects, workspace, isOwner, refresh } = useWorkspace();
  const { repository } = useData();
  const action = useAsyncAction();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  if (!repository) throw new Error("Sign in to manage projects");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-end">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Microproject estimation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Estimate people and weeks per role. Select only the projects you want to plan.
          </p>
        </div>
        {isOwner && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New microproject
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <Metric label="Microprojects" value={projects.length} />
        <Metric
          label="In backlog"
          value={projects.filter((project) => project.in_backlog).length}
        />
        <Metric
          label="Total effort"
          value={`${projects.reduce((sum, project) => sum + totalDevWeeks(project), 0)} person-wks`}
        />
      </div>
      {action.error && (
        <p role="alert" className="text-destructive">
          {action.error}
        </p>
      )}
      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          The workspace owner manages project estimates and priorities.
        </p>
      )}
      {!projects.length ? (
        <EmptyState
          icon={<Calculator />}
          title="No microprojects yet"
          description="Create your first estimate to start planning."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectEstimateCard
              key={project.id}
              project={project}
              disabled={action.busy}
              readOnly={!isOwner}
              onEdit={() => {
                setEditing(project);
                setFormOpen(true);
              }}
              onDelete={() => setDeleting(project)}
              onToggleBacklog={() =>
                void action.run(async () => {
                  await repository.toggleBacklog(workspace.id, project.id, !project.in_backlog);
                  await refresh();
                })
              }
            />
          ))}
        </div>
      )}
      {formOpen && (
        <ProjectForm
          open
          onClose={() => setFormOpen(false)}
          initial={editing}
          onSave={async (input) => {
            await repository.saveProject(workspace.id, input, editing?.id);
            await refresh();
          }}
        />
      )}
      <ConfirmDialog
        isOpen={!!deleting}
        title={`Delete ${deleting?.name ?? "project"}?`}
        description="The estimate will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting || action.busy) return;
          void action.run(async () => {
            await repository.deleteProject(workspace.id, deleting.id);
            setDeleting(null);
            await refresh();
          });
        }}
      />
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel !p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
