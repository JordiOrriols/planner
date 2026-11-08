import i18n from "@/i18n";

export interface PriorityFeature {
  id: string;
  name: string;
  status: string;
  dependency_ids?: string[];
}

export function validatePriorityOrder(features: PriorityFeature[], ids: string[], locked = false) {
  const positions = new Map(ids.map((id, index) => [id, index]));
  if (
    ids.length !== features.length ||
    positions.size !== ids.length ||
    features.some((feature) => !positions.has(feature.id))
  )
    throw new Error(i18n.t("priorityProposals.changed"));
  if (locked) {
    const lastLocked = features.reduce(
      (last, feature, index) =>
        feature.status === "done" || feature.status === "in_progress" ? index : last,
      -1
    );
    if (features.slice(0, lastLocked + 1).some((feature, index) => ids[index] !== feature.id))
      throw new Error(i18n.t("priorityProposals.locked"));
  }
  const names = new Map(features.map((feature) => [feature.id, feature.name]));
  for (const feature of features) {
    for (const dependency of feature.dependency_ids ?? []) {
      const position = positions.get(dependency);
      if (position === undefined || position >= positions.get(feature.id)!)
        throw new Error(
          i18n.t("dependencies.orderError", {
            feature: feature.name,
            dependency: names.get(dependency) ?? dependency,
          })
        );
    }
  }
}

export function reorderPriority(
  features: PriorityFeature[],
  from: string,
  to: string,
  locked = false
) {
  const ids = features.map((feature) => feature.id);
  const index = ids.indexOf(from),
    target = ids.indexOf(to);
  if (index < 0 || target < 0) throw new Error(i18n.t("priorityProposals.changed"));
  ids.splice(index, 1);
  ids.splice(target, 0, from);
  validatePriorityOrder(features, ids, locked);
  return ids;
}
