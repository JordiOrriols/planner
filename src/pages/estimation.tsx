import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  const { projects, workspace, canEdit, refresh } = useWorkspace();
  const { repository } = useData();
  const action = useAsyncAction();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const roadmap = projects
    .filter((project) => project.in_backlog)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const backlog = projects.filter((project) => !project.in_backlog);
  if (!repository) throw new Error(t("estimation.errors.signInRequired"));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-end">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {t("estimation.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("estimation.description")}</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("featureForm.createTitle")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <Metric label={t("estimation.metrics.features")} value={projects.length} />
        <Metric
          label={t("estimation.metrics.onRoadmap")}
          value={projects.filter((project) => project.in_backlog).length}
        />
        <Metric
          label={t("estimation.metrics.totalEffort")}
          value={t("estimation.metrics.effortValue", {
            effort: projects.reduce((sum, project) => sum + totalDevWeeks(project), 0),
          })}
        />
      </div>
      {action.error && (
        <p role="alert" className="text-destructive">
          {action.error}
        </p>
      )}
      {!canEdit && (
        <p className="text-sm text-muted-foreground">{t("estimation.readOnlyNotice")}</p>
      )}
      {!projects.length ? (
        <EmptyState
          icon={<Calculator />}
          title={t("estimation.empty.title")}
          description={t("estimation.empty.description")}
        />
      ) : (
        <div className="space-y-8">
          {[
            {
              name: t("roadmap.title"),
              description: t("estimation.groups.roadmapDescription"),
              features: roadmap,
            },
            {
              name: t("estimation.groups.backlog"),
              description: t("estimation.groups.backlogDescription"),
              features: backlog,
            },
          ].map((group) => (
            <section key={group.name} aria-label={group.name} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </div>
              {!group.features.length && (
                <p className="text-sm text-muted-foreground">{t("estimation.groups.empty")}</p>
              )}
              <div className="flex flex-col gap-4">
                {group.features.map((project) => (
                  <ProjectEstimateCard
                    key={project.id}
                    project={project}
                    disabled={action.busy}
                    readOnly={!canEdit}
                    onEdit={() => {
                      setEditing(project);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleting(project)}
                  />
                ))}
              </div>
            </section>
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
        title={t("estimation.delete.title", { featureName: deleting?.name ?? t("common.feature") })}
        description={t("estimation.delete.description")}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
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
