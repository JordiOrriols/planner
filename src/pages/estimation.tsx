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
  if (!repository) throw new Error(t("copy.signInToManageProjects"));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-end">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {t("copy.featureEstimation")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("copy.estimatePeopleAndWeeksPerRolePrioritizeFeatures")}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("copy.newFeature")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <Metric label={t("copy.features")} value={projects.length} />
        <Metric
          label={t("copy.onRoadmap")}
          value={projects.filter((project) => project.in_backlog).length}
        />
        <Metric
          label={t("copy.totalEffort")}
          value={t("copy.effortValue", {
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
        <p className="text-sm text-muted-foreground">
          {t("copy.workspaceOwnersAndEditorsManageFeatureEstimatesAnd")}
        </p>
      )}
      {!projects.length ? (
        <EmptyState
          icon={<Calculator />}
          title={t("copy.noFeaturesYet")}
          description={t("copy.createYourFirstEstimateToStartPlanning")}
        />
      ) : (
        <div className="space-y-8">
          {[
            {
              name: t("copy.roadmap"),
              description: t("copy.prioritizedFeaturesInRoadmapOrder"),
              features: roadmap,
            },
            {
              name: t("copy.backlog"),
              description: t("copy.notPrioritizedFeatures"),
              features: backlog,
            },
          ].map((group) => (
            <section key={group.name} aria-label={group.name} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </div>
              {!group.features.length && (
                <p className="text-sm text-muted-foreground">{t("copy.noFeaturesInThisGroup")}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        title={t("copy.delete2", { value1: deleting?.name ?? t("copy.feature") })}
        description={t("copy.theEstimateWillBePermanentlyRemoved")}
        confirmLabel={t("copy.delete3")}
        cancelLabel={t("copy.cancel")}
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
