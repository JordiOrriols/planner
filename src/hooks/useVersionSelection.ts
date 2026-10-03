import { useCallback, useMemo, useState } from "react";
import { byNewest, latestOf } from "@/data/evaluations";
import type { Evaluation, EvaluationKind } from "@/types";

/** Tracks which version is open and which others are overlaid on the radar. */
export function useVersionSelection(evaluations: Evaluation[], preferredKind: EvaluationKind) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);

  const sorted = useMemo(() => [...evaluations].sort(byNewest), [evaluations]);

  const selected = useMemo(
    () =>
      sorted.find((e) => e.id === selectedId) ??
      latestOf(sorted, preferredKind) ??
      sorted[0] ??
      null,
    [sorted, selectedId, preferredKind]
  );

  const effectiveCompareIds = useMemo(() => {
    if (compareIds) return compareIds;
    const self = preferredKind === "self" ? undefined : latestOf(sorted, "self", true);
    return self ? [self.id] : [];
  }, [compareIds, sorted, preferredKind]);

  const compare = useMemo(
    () => sorted.filter((e) => effectiveCompareIds.includes(e.id) && e.id !== selected?.id),
    [sorted, effectiveCompareIds, selected]
  );

  const toggleCompare = useCallback(
    (id: string) => {
      setCompareIds((prev) => {
        const base = prev ?? effectiveCompareIds;
        return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      });
    },
    [effectiveCompareIds]
  );

  return {
    sorted,
    selected,
    select: setSelectedId,
    compareIds: effectiveCompareIds,
    compare,
    toggleCompare,
  };
}
