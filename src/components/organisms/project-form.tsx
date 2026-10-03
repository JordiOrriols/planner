import React, { useState } from "react";
import { Modal, Button, Input, Label } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  peakDevs,
  durationWeeks,
  totalDevWeeks,
} from "@/lib/planning";
import { EMPTY_PROJECT, type ProjectInput } from "@/types/planner";
import { cn } from "@/lib/utils";

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
  const [form, setForm] = useState<ProjectInput>(initial ?? EMPTY_PROJECT);
  const action = useAsyncAction();
  return (
    <Modal
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !action.busy) onClose();
      }}
      title={initial ? "Edit microproject" : "New microproject"}
      description="Roles run concurrently. People × weeks is the effort for each role."
      closeLabel="Close"
    >
      <form
        className="space-y-4 max-h-[65vh] overflow-y-auto pr-1"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            await onSave(form);
            onClose();
          });
        }}
      >
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          value={form.name}
          onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
          required
          maxLength={120}
          autoFocus
        />
        <Label htmlFor="project-description">Description</Label>
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
            <span>Role</span>
            <span>People</span>
            <span>Weeks</span>
          </div>
          {ROLES.map((role) => (
            <div key={role} className="grid grid-cols-3 gap-2 p-3 border-t items-center">
              <span className="text-sm flex gap-2 items-center">
                <span className={cn("h-2 w-2 rounded-full", ROLE_COLORS[role])} />
                {ROLE_LABELS[role]}
              </span>
              <Input
                aria-label={`${ROLE_LABELS[role]} people`}
                type="number"
                min={0}
                max={100}
                step={0.1}
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
                aria-label={`${ROLE_LABELS[role]} weeks`}
                type="number"
                min={0}
                max={104}
                step={0.1}
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
          Peak team: {peakDevs(form)} people · Ideal duration: {durationWeeks(form)} weeks · Effort:{" "}
          {totalDevWeeks(form)} person-weeks
        </p>
        {action.error && (
          <p role="alert" className="text-destructive">
            {action.error}
          </p>
        )}
        <Button type="submit" disabled={action.busy}>
          {action.busy ? "Saving..." : initial ? "Save changes" : "Create microproject"}
        </Button>
      </form>
    </Modal>
  );
}
