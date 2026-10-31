import { useTranslation } from "react-i18next";
import React, { useId, useState } from "react";
import { Modal, Button, Input, Label, SelectField } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { ROLES, ROLE_LABELS, peakDevs, durationWeeks, totalDevWeeks } from "@/lib/planning";
import {
  EMPTY_FEATURE,
  FEATURE_STATUSES,
  type FeatureInput,
  type FeatureStatus,
  type Project,
} from "@/types/planner";
import { cn } from "@/lib/utils";
import { ROLE_COLORS } from "@/config/roleColors";

const NEW_PROJECT = "__new_project__";

export default function FeatureForm({
  open,
  onClose,
  onSave,
  initial,
  projects = [],
  onCreateProject,
}: {
  projects?: Project[];
  open: boolean;
  onClose: () => void;
  onSave: (input: FeatureInput) => Promise<void>;
  onCreateProject: (name: string) => Promise<Project>;
  initial: FeatureInput | null;
}) {
  const { t } = useTranslation();
  const formId = useId();

  const [form, setForm] = useState<FeatureInput>({ ...EMPTY_FEATURE, ...initial });
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [creatingProject, setCreatingProject] = useState(!initial && !projects.length);
  const [newProjectName, setNewProjectName] = useState("");
  const projectOptions = createdProject ? [...projects, createdProject] : projects;
  const action = useAsyncAction();
  return (
    <Modal
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !action.busy) onClose();
      }}
      title={initial ? t("featureForm.editTitle") : t("featureForm.createTitle")}
      description={t("featureForm.description")}
      closeLabel={t("featureForm.actions.discard")}
      footer={
        <Button type="submit" form={formId} disabled={action.busy}>
          {action.busy
            ? t("featureForm.actions.saving")
            : initial
              ? t("featureForm.actions.save")
              : t("featureForm.actions.create")}
        </Button>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (action.busy) return;
          void action.run(async () => {
            let projectId = form.project_id;
            if (creatingProject) {
              // Keep the new project selected so a failed feature save can be retried.
              const project = await onCreateProject(newProjectName);
              setCreatedProject(project);
              setCreatingProject(false);
              setForm((previous) => ({ ...previous, project_id: project.id }));
              projectId = project.id;
            }
            await onSave({ ...form, project_id: projectId });
            onClose();
          });
        }}
      >
        <Label htmlFor="project-main-project">{t("featureForm.fields.project")}</Label>
        <SelectField
          id="project-main-project"
          required
          value={creatingProject ? NEW_PROJECT : (form.project_id ?? "")}
          onValueChange={(value) => {
            if (value !== NEW_PROJECT && !projectOptions.some((project) => project.id === value))
              return;
            setCreatingProject(value === NEW_PROJECT);
            if (value !== NEW_PROJECT)
              setForm((previous) => ({ ...previous, project_id: value || null }));
          }}
          options={[
            { value: "", label: t("featureForm.project.choose"), disabled: true },
            ...projectOptions.map((project) => ({ value: project.id, label: project.name })),
            { value: NEW_PROJECT, label: t("featureForm.project.new") },
          ]}
        />
        {creatingProject && (
          <Input
            aria-label={t("projects.fields.newName")}
            placeholder={t("projects.fields.newName")}
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            required
            maxLength={80}
          />
        )}
        <Label htmlFor="project-name">{t("featureForm.fields.name")}</Label>
        <Input
          id="project-name"
          value={form.name}
          onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
          required
          maxLength={120}
          autoFocus
        />
        <Label htmlFor="project-description">{t("featureForm.fields.description")}</Label>
        <textarea
          id="project-description"
          className="field"
          value={form.description}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, description: event.target.value }))
          }
          rows={2}
        />
        <Label htmlFor="feature-status">{t("featureStatus.label")}</Label>
        <SelectField
          id="feature-status"
          value={form.status}
          onValueChange={(value) =>
            setForm((previous) => ({
              ...previous,
              status: value as FeatureStatus,
            }))
          }
          options={FEATURE_STATUSES.map((status) => ({
            value: status,
            label: t(`featureStatus.${status}`),
          }))}
        />
        <div className="rounded-xl border overflow-hidden">
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 text-xs font-medium">
            <span>{t("featureForm.columns.role")}</span>
            <span>{t("featureForm.columns.people")}</span>
            <span>{t("featureForm.columns.weeks")}</span>
          </div>
          {ROLES.map((role) => (
            <div key={role} className="grid grid-cols-3 gap-2 p-3 border-t items-center">
              <span className="text-sm flex gap-2 items-center">
                <span
                  data-role-swatch={role}
                  className={cn("h-2 w-2 rounded-full", ROLE_COLORS[role].className)}
                />
                {ROLE_LABELS[role]}
              </span>
              <Input
                aria-label={t("featureForm.fields.rolePeople", { role: ROLE_LABELS[role] })}
                type="number"
                min={0}
                max={100}
                step={1}
                value={form[`${role}_devs`]}
                required
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    [`${role}_devs`]: event.target.valueAsNumber,
                  }))
                }
              />
              <Input
                aria-label={t("featureForm.fields.roleWeeks", { role: ROLE_LABELS[role] })}
                type="number"
                min={0}
                max={104}
                step={1}
                value={form[`${role}_weeks`]}
                required
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    [`${role}_weeks`]: event.target.valueAsNumber,
                  }))
                }
              />
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t("uat.summary", { weeks: 2 })}</p>
        <p className="text-xs text-muted-foreground">
          {t("featureForm.summary", {
            people: peakDevs(form),
            weeks: durationWeeks(form),
            effort: totalDevWeeks(form),
          })}
        </p>
        {action.error && (
          <p role="alert" className="text-destructive">
            {action.error}
          </p>
        )}
      </form>
    </Modal>
  );
}
