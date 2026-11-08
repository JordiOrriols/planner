import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@jordiorriols/ui";
import type { Feature } from "@/types/planner";

export default function AddFeatureModal({
  features,
  busy,
  error,
  onClose,
  onAdd,
  createAction,
}: {
  features: Feature[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: (id: string) => void;
  createAction?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const available = features.filter((feature) => !feature.in_backlog);
  return (
    <Modal
      isOpen
      title={t("roadmap.addFeature.title")}
      description={t("roadmap.addFeature.description")}
      closeLabel={t("common.actions.close")}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {available.length ? (
        <ul className="space-y-2">
          {available.map((feature) => (
            <li
              key={feature.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span className="font-medium">{feature.name}</span>
              <Button
                size="sm"
                disabled={busy}
                aria-label={t("roadmap.addFeature.addLabel", { featureName: feature.name })}
                onClick={() => onAdd(feature.id)}
              >
                {t("roadmap.actions.addFeature")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t(features.length ? "roadmap.addFeature.allIncluded" : "roadmap.addFeature.noEstimates")}
        </p>
      )}
      {createAction}
    </Modal>
  );
}
