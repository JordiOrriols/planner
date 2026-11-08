import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, Modal } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { Pencil, Plus, Trash2 } from "@jordiorriols/ui/icons";
import { fmtDate, parseDate } from "@/lib/planning";
import type { RoadmapMarker } from "@/types/planner";

export default function MarkersManager({
  markers,
  onClose,
  onCreate,
  onDelete,
  onRename,
  description,
}: {
  markers: RoadmapMarker[];
  onClose: () => void;
  onCreate: (name: string, date: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  description?: string;
}) {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open && !action.busy) onClose();
      }}
      title={t("markers.title")}
      description={description ?? t("markers.description")}
      closeLabel={t("common.actions.close")}
    >
      <div className="space-y-4">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (action.busy) return;
            void action.run(async () => {
              await onCreate(name, date);
              setName("");
              setDate("");
            });
          }}
        >
          <FormField id="marker-name" label={t("markers.name")} className="space-y-1">
            {(field) => (
              <Input
                {...field}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
                disabled={action.busy}
              />
            )}
          </FormField>
          <FormField id="marker-date" label={t("markers.date")} className="space-y-1">
            {(field) => (
              <Input
                {...field}
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                disabled={action.busy}
              />
            )}
          </FormField>
          <Button
            type="submit"
            className="sm:col-span-2"
            disabled={action.busy || !name.trim() || !date}
          >
            <Plus className="size-4" />
            {t("markers.add")}
          </Button>
        </form>
        {markers.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {markers.map((marker) => (
              <li key={marker.id} className="flex items-center gap-3 p-3">
                <span
                  aria-hidden="true"
                  className="h-8 border-l-2 border-dashed border-amber-600"
                />
                <div className="min-w-0 flex-1">
                  {editing === marker.id ? (
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (action.busy) return;
                        void action.run(async () => {
                          await onRename(marker.id, editedName);
                          setEditing(null);
                        });
                      }}
                    >
                      <Input
                        aria-label={t("markers.name")}
                        value={editedName}
                        onChange={(event) => setEditedName(event.target.value)}
                        maxLength={80}
                        required
                        disabled={action.busy}
                        autoFocus
                        className="min-w-0 flex-1"
                      />
                      <Button type="submit" size="sm" disabled={action.busy || !editedName.trim()}>
                        {t("buttons.save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={action.busy}
                        onClick={() => {
                          setEditing(null);
                          action.reset();
                        }}
                      >
                        {t("buttons.cancel")}
                      </Button>
                    </form>
                  ) : (
                    <p className="break-words text-sm font-medium">{marker.name}</p>
                  )}
                  <time dateTime={marker.date} className="text-xs text-muted-foreground">
                    {fmtDate(parseDate(marker.date))}
                  </time>
                </div>
                {editing !== marker.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={t("markers.edit", { markerName: marker.name })}
                    disabled={action.busy}
                    onClick={() => {
                      setEditing(marker.id);
                      setEditedName(marker.name);
                      action.reset();
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive"
                  aria-label={t("markers.delete", { markerName: marker.name })}
                  disabled={action.busy}
                  onClick={() => void action.run(() => onDelete(marker.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("markers.empty")}</p>
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
