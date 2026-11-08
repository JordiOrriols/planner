import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AppSkeleton, Button, ErrorState, NameDialog, SelectField } from "@jordiorriols/ui";
import { useAsyncAction, useNameForm } from "@jordiorriols/ui/hooks";
import { reorderPriority, validatePriorityOrder } from "@/lib/featureDependencies";
import { cn } from "@/lib/utils";
import { PublicRoadmapView } from "./public-roadmap-view";
import type { PublicRoadmap } from "@/lib/publicRoadmap";

export interface PriorityProposalRepository {
  roadmap(
    scope: string,
    options?: {
      featureIds?: string[];
      proposal?: string;
      expectedRevision?: string;
    }
  ): Promise<PublicRoadmap>;
  proposals(scope: string): Promise<{ id: string; name: string; created_at: string }[]>;
  saveProposal(scope: string, name: string, ids: string[], revision: string): Promise<string>;
}

export function PriorityProposals({
  scope,
  official,
  repository,
  canSave = true,
  onSignIn,
  audience = "link",
}: {
  scope: string;
  official: PublicRoadmap;
  repository: PriorityProposalRepository;
  canSave?: boolean;
  onSignIn?: () => void;
  audience?: "link" | "workspace";
}) {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const [preview, setPreview] = useState<PublicRoadmap | null>(null);
  const [selected, setSelected] = useState("");
  const [comparison, setComparison] = useState("");
  const [naming, setNaming] = useState(false);
  const proposals = useQuery({
    queryKey: ["priority-proposals", scope],
    queryFn: () => repository.proposals(scope),
    retry: false,
    refetchInterval: 60_000,
  });
  const saved = useQuery({
    queryKey: ["priority-proposal", scope, selected],
    enabled: !!selected,
    queryFn: () => repository.roadmap(scope, { proposal: selected }),
    retry: false,
  });
  const compared = useQuery({
    queryKey: ["priority-proposal", scope, comparison],
    enabled: !!comparison && comparison !== "official",
    queryFn: () => repository.roadmap(scope, { proposal: comparison }),
    retry: false,
  });
  const roadmap = selected ? saved.data : (preview ?? official);
  const form = useNameForm({
    isOpen: naming,
    onClose: () => setNaming(false),
    onSubmit: async (name) => {
      if (!canSave || !roadmap) throw new Error(t("priorityProposals.signIn"));
      const ids = roadmap.features.map((feature) => {
        if (!feature.id) throw new Error(t("priorityProposals.changed"));
        return feature.id;
      });
      if (!roadmap.revision) throw new Error(t("priorityProposals.changed"));
      const id = await repository.saveProposal(scope, name, ids, roadmap.revision);
      await proposals.refetch();
      setSelected(id);
      setPreview(null);
    },
  });
  function move(from: string, to: string) {
    if (!roadmap || action.busy) return;
    void action.run(async () => {
      const features = roadmap.features.map((feature) => {
        if (!feature.id) throw new Error(t("priorityProposals.changed"));
        return { ...feature, id: feature.id, dependency_ids: feature.dependency_ids ?? [] };
      });
      const ids = reorderPriority(features, from, to, true);
      if (!roadmap.revision) throw new Error(t("priorityProposals.changed"));
      setPreview(
        await repository.roadmap(scope, {
          featureIds: ids,
          expectedRevision: roadmap.revision,
        })
      );
    });
  }
  const options = (proposals.data ?? []).map((proposal) => ({
    value: proposal.id,
    label: proposal.name,
  }));
  const comparisonRoadmap = comparison === "official" ? official : compared.data;
  const viewName = selected
    ? options.find((option) => option.value === selected)?.label
    : t(preview ? "priorityProposals.experiment" : "priorityProposals.official");
  const comparisonName =
    comparison === "official"
      ? t("priorityProposals.official")
      : options.find((option) => option.value === comparison)?.label;
  return (
    <section className="space-y-4" aria-label={t("priorityProposals.title")}>
      <div className="panel space-y-3">
        <h2 className="text-lg font-semibold">{t("priorityProposals.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            audience === "workspace"
              ? "access.proposalsDescription"
              : "priorityProposals.description"
          )}
        </p>
        <p className="text-xs text-muted-foreground">{t("priorityProposals.locked")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            aria-label={t("priorityProposals.restore")}
            value={selected}
            disabled={action.busy}
            onValueChange={(value) => {
              setSelected(value);
              setPreview(null);
              action.reset();
            }}
            options={[{ value: "", label: t("priorityProposals.official") }, ...options]}
          />
          <Button
            disabled={
              action.busy ||
              !!selected ||
              !roadmap?.features.length ||
              (!!preview && preview.revision !== official.revision)
            }
            onClick={() => (canSave ? setNaming(true) : onSignIn?.())}
          >
            {t("priorityProposals.save")}
          </Button>
          {selected && (
            <Button
              variant="outline"
              disabled={action.busy || !saved.data}
              onClick={() =>
                void action.run(async () => {
                  if (!saved.data || !official.revision)
                    throw new Error(t("priorityProposals.changed"));
                  const ids = saved.data.features.map((feature) => {
                    if (!feature.id) throw new Error(t("priorityProposals.changed"));
                    return feature.id;
                  });
                  const features = official.features.map((feature) => {
                    if (!feature.id) throw new Error(t("priorityProposals.changed"));
                    return {
                      ...feature,
                      id: feature.id,
                      dependency_ids: feature.dependency_ids ?? [],
                    };
                  });
                  validatePriorityOrder(features, ids, true);
                  const restored = await repository.roadmap(scope, {
                    featureIds: ids,
                    expectedRevision: official.revision,
                  });
                  setSelected("");
                  setPreview(restored);
                })
              }
            >
              {t("priorityProposals.resume")}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={() => {
              setPreview(null);
              setSelected("");
              action.reset();
            }}
          >
            {t("priorityProposals.reset")}
          </Button>
          <SelectField
            aria-label={t("priorityProposals.compare")}
            value={comparison}
            onValueChange={setComparison}
            options={[
              { value: "", label: t("priorityProposals.noComparison") },
              { value: "official", label: t("priorityProposals.official") },
              ...options,
            ]}
          />
        </div>
        {selected && <p className="text-sm">{t("priorityProposals.snapshot")}</p>}
        {preview && (
          <p role="status" className="text-sm">
            {t("priorityProposals.draft")}
          </p>
        )}
        {preview && preview.revision !== official.revision && (
          <ErrorState message={t("priorityProposals.changed")} />
        )}
        {[action.error, proposals.error?.message, saved.error?.message, compared.error?.message]
          .filter((message): message is string => typeof message === "string")
          .map((message, index) => (
            <ErrorState key={index} message={message} />
          ))}
      </div>
      {(saved.isFetching && selected) || action.busy ? (
        <AppSkeleton label={t("priorityProposals.recalculating")} fullPage={false} />
      ) : null}
      <div className={cn("grid gap-4", comparison && "xl:grid-cols-2")}>
        {roadmap && (
          <section aria-label={viewName} className="min-w-0 space-y-2">
            <h3 className="font-semibold">{viewName}</h3>
            <PublicRoadmapView
              roadmap={roadmap}
              {...(!selected ? { onMove: move } : {})}
              disabled={action.busy}
            />
          </section>
        )}
        {comparison && comparisonRoadmap && (
          <section aria-label={comparisonName} className="min-w-0 space-y-2">
            <h3 className="font-semibold">{comparisonName}</h3>
            <PublicRoadmapView roadmap={comparisonRoadmap} />
          </section>
        )}
      </div>
      <NameDialog
        isOpen={naming}
        onClose={() => setNaming(false)}
        form={form}
        labels={{
          title: t("priorityProposals.save"),
          description: t(
            audience === "workspace"
              ? "access.proposalNameDescription"
              : "priorityProposals.nameDescription"
          ),
          name: t("priorityProposals.name"),
          submit: t("priorityProposals.save"),
          cancel: t("buttons.cancel"),
        }}
      />
    </section>
  );
}
