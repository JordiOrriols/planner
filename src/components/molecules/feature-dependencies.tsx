import React from "react";
import { useTranslation } from "react-i18next";

export function FeatureDependencies({
  ids,
  features,
}: {
  ids: readonly string[];
  features: readonly { id?: string | undefined; name: string }[];
}) {
  const { t } = useTranslation();
  if (!ids.length) return null;
  const names = new Map(features.map((feature) => [feature.id, feature.name]));
  return (
    <p className="text-xs text-muted-foreground">
      {t("dependencies.after", { features: ids.map((id) => names.get(id) ?? id).join(", ") })}
    </p>
  );
}
