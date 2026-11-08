import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PublicAppShell, AppSkeleton, AuthDialog, Button } from "@jordiorriols/ui";
import { useData } from "@/data/DataProvider";
import { useAuthDialogProps } from "@/components/molecules/LoginDialog";
import { createPlannerRepository } from "@/data/plannerRepository";
import { supabase } from "@/data/supabaseClient";
import { cn } from "@/lib/utils";
import { useRoadmapDisplay } from "@/lib/roadmapDisplay";
import i18n from "@/i18n";
import {
  PriorityProposals,
  type PriorityProposalRepository,
} from "@/components/organisms/priority-proposals";

const repository = supabase ? createPlannerRepository(supabase) : null;
const proposalsRepository: PriorityProposalRepository = {
  roadmap: (scope, options) => {
    if (!repository) throw new Error(i18n.t("publicRoadmap.unavailable"));
    return repository.loadRoadmapLink(scope, options);
  },
  proposals: (scope) => {
    if (!repository) throw new Error(i18n.t("publicRoadmap.unavailable"));
    return repository.listPriorityProposals(scope);
  },
  saveProposal: (scope, name, ids, revision) => {
    if (!repository) throw new Error(i18n.t("publicRoadmap.unavailable"));
    return repository.savePriorityProposal(scope, name, ids, revision);
  },
};

export { PublicRoadmapView } from "@/components/organisms/public-roadmap-view";

export default function RoadmapLink() {
  const { token = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { fullWidth } = useRoadmapDisplay();
  const { user } = useData();
  const auth = useAuthDialogProps();
  const [login, setLogin] = useState(false);
  const query = useQuery({
    queryKey: ["public-roadmap", token],
    retry: false,
    refetchInterval: 60_000,
    queryFn: () => {
      if (!repository) throw new Error(t("publicRoadmap.unavailable"));
      return repository.loadRoadmapLink(token);
    },
  });
  return (
    <PublicAppShell
      projectId="planner"
      mainClassName={cn("space-y-5", fullWidth && "max-w-none")}
      footer={{ text: t("app.footer") }}
      header={{
        title: query.data?.name ?? t("publicRoadmap.title"),
        language: {
          value: i18n.language,
          label: t("header.language"),
          onValueChange: (language) => void i18n.changeLanguage(language),
        },
      }}
    >
      {query.isPending && <AppSkeleton label={t("app.loading.page")} fullPage={false} />}
      {query.error && (
        <div role="alert" className="space-y-3">
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>{t("app.actions.tryAgain")}</Button>
        </div>
      )}
      {query.data && (
        <PriorityProposals
          key={token}
          scope={token}
          official={query.data}
          repository={proposalsRepository}
          canSave={!!user}
          onSignIn={() => setLogin(true)}
        />
      )}
      <AuthDialog {...auth} isOpen={login} onClose={() => setLogin(false)} />
    </PublicAppShell>
  );
}
