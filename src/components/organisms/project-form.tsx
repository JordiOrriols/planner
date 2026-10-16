import { useTranslation } from "react-i18next";
import React, { useId, useState } from "react";
import { Modal, Button, Input, Label } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { ROLES, ROLE_LABELS, peakDevs, durationWeeks, totalDevWeeks } from "@/lib/planning";
import { EMPTY_PROJECT, type ProjectInput } from "@/types/planner";
import { cn } from "@/lib/utils";
import { ROLE_COLORS } from "@/config/roleColors";

export default function ProjectForm({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: ProjectInput) => Promise<void>;
  initial: ProjectInput | null;
}) {
  const { t } = useTranslation();
  const formId = useId();

  const [form, setForm] = useState<ProjectInput>(initial ?? EMPTY_PROJECT);
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
        className="space-y-4 max-h-[65vh] overflow-y-auto pr-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (action.busy) return;
          void action.run(async () => {
            await onSave(form);
            onClose();
          });
        }}
      >
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
