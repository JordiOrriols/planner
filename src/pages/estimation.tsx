import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button, ConfirmDialog, EmptyState } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { Plus, Calculator, FolderKanban } from "@jordiorriols/ui/icons";
import FeatureForm from "@/components/organisms/feature-form";
import FeatureEstimateCard from "@/components/organisms/feature-estimate-card";
import MainProjectsManager from "@/components/organisms/main-projects-manager";
import { totalDevWeeks } from "@/lib/planning";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useData } from "@/data/DataProvider";
import type { Feature } from "@/types/planner";

export default function Estimation() {
  const { t } = useTranslation();

  const { features, mainProjects, workspace, canEdit, refresh } = useWorkspace();
  const { repository } = useData();
  const action = useAsyncAction();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Feature | null>(null);
  const [deleting, setDeleting] = useState<Feature | null>(null);
  const [managingProjects, setManagingProjects] = useState(false);
  const mainProjectNames = new Map(mainProjects.map((item) => [item.id, item.name]));
  const roadmap = features
    .filter((feature) => feature.in_backlog)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const backlog = features.filter((feature) => !feature.in_backlog);
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setManagingProjects(true)}>
              <FolderKanban className="h-4 w-4 mr-2" />
              {t("mainProjects.manage")}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("featureForm.createTitle")}
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <Metric label={t("estimation.metrics.features")} value={features.length} />
        <Metric
          label={t("estimation.metrics.onRoadmap")}
          value={features.filter((feature) => feature.in_backlog).length}
        />
        <Metric
          label={t("estimation.metrics.totalEffort")}
          value={t("estimation.metrics.effortValue", {
            effort: features.reduce((sum, feature) => sum + totalDevWeeks(feature), 0),
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
      {!features.length ? (
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
                {group.features.map((feature) => (
                  <FeatureEstimateCard
                    key={feature.id}
                    feature={feature}
                    mainProjectName={
                      feature.main_project_id
                        ? mainProjectNames.get(feature.main_project_id)
                        : undefined
                    }
                    disabled={action.busy}
                    readOnly={!canEdit}
                    onEdit={() => {
                      setEditing(feature);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleting(feature)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {formOpen && (
        <FeatureForm
          open
          onClose={() => setFormOpen(false)}
          initial={editing}
          mainProjects={mainProjects}
          onSave={async (input) => {
            await repository.saveFeature(workspace.id, input, editing?.id);
            await refresh();
          }}
        />
      )}
      {managingProjects && (
        <MainProjectsManager
          open
          onClose={() => setManagingProjects(false)}
          projects={mainProjects}
          onCreate={async (name) => {
            await repository.createMainProject(workspace.id, name);
            await refresh();
          }}
          onRename={async (id, name) => {
            await repository.renameMainProject(workspace.id, id, name);
            await refresh();
          }}
          onDelete={async (id) => {
            await repository.deleteMainProject(workspace.id, id);
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
            await repository.deleteFeature(workspace.id, deleting.id);
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
