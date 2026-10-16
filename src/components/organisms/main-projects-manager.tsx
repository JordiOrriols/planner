import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button, Input, Modal } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { Plus, Trash2 } from "@jordiorriols/ui/icons";
import type { MainProject } from "@/types/planner";

export default function MainProjectsManager({
  open,
  onClose,
  projects,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  projects: MainProject[];
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const [name, setName] = useState("");
  return (
    <Modal
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !action.busy) onClose();
      }}
      title={t("mainProjects.title")}
      description={t("mainProjects.description")}
      closeLabel={t("mainProjects.actions.done")}
    >
      <div className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (action.busy) return;
            void action.run(async () => {
              await onCreate(name);
              setName("");
            });
          }}
        >
          <Input
            aria-label={t("mainProjects.fields.newName")}
            placeholder={t("mainProjects.fields.newName")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
          <Button type="submit" disabled={action.busy || !name.trim()}>
            <Plus className="mr-2 size-4" />
            {t("mainProjects.actions.add")}
          </Button>
        </form>
        {projects.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {projects.map((project) => (
              <MainProjectRow
                key={`${project.id}-${project.name}`}
                project={project}
                busy={action.busy}
                onRename={(value) => void action.run(() => onRename(project.id, value))}
                onDelete={() => void action.run(() => onDelete(project.id))}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("mainProjects.empty")}</p>
        )}
        {action.error && (
          <p role="alert" className="text-sm text-destructive">
            {action.error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function MainProjectRow({
  project,
  busy,
  onRename,
  onDelete,
}: {
  project: MainProject;
  busy: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(project.name);
  const changed = name.trim() !== project.name;
  return (
    <li>
      <form
        className="flex items-center gap-2 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (changed && !busy) onRename(name);
        }}
      >
        <Input
          aria-label={t("mainProjects.fields.rename", { projectName: project.name })}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
        />
        {changed && (
          <Button
            type="submit"
            size="sm"
            disabled={busy}
            aria-label={t("mainProjects.actions.save", { projectName: project.name })}
          >
            {t("featureForm.actions.save")}
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-destructive hover:text-destructive"
          disabled={busy}
          aria-label={t("mainProjects.actions.delete", { projectName: project.name })}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </form>
    </li>
  );
}
