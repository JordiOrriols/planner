import React from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  AppFooter,
  AppMain,
  AppPage,
  AppSkeleton,
  Button,
  LanguageSelector,
} from "@jordiorriols/ui";
import { platformRepository } from "@/data/platform";
import { PublicRoadmapView } from "@/components/organisms/public-roadmap-view";

export default function PlatformRoadmap() {
  const { workspace } = useParams();
  const { t, i18n } = useTranslation();
  const directory = useQuery({
    queryKey: ["platform-workspaces", "planner"],
    queryFn: platformRepository.workspaces,
    enabled: !workspace,
  });
  const roadmap = useQuery({
    queryKey: ["platform-roadmap", workspace],
    queryFn: () => {
      if (!workspace) throw new Error(t("publicRoadmap.unavailable"));
      return platformRepository.roadmap(workspace);
    },
    enabled: !!workspace,
    refetchInterval: 60_000,
  });
  const error = workspace ? roadmap.error : directory.error;
  const pending = workspace ? roadmap.isPending : directory.isPending;
  return (
    <AppPage className="flex min-h-screen flex-col">
      <AppMain className="w-full flex-1 space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold"> {roadmap.data?.name ?? t("planner.name")}</h1>
            <p className="text-muted-foreground">{t("publicRoadmap.title")}</p>
          </div>
          <LanguageSelector
            value={i18n.language}
            label={t("header.language")}
            onValueChange={(value) => void i18n.changeLanguage(value)}
          />
        </header>
        {pending ? (
          <AppSkeleton label={t("app.loading.page")} fullPage={false} />
        ) : error ? (
          <div role="alert">
            <p>{error.message}</p>
            <Button onClick={() => void (workspace ? roadmap.refetch() : directory.refetch())}>
              {t("app.actions.tryAgain")}
            </Button>
          </div>
        ) : workspace && roadmap.data ? (
          <PublicRoadmapView roadmap={roadmap.data} />
        ) : (
          <ul className="space-y-3">
            {directory.data?.map((item) => (
              <li className="panel" key={item.id}>
                <Link to={`/workspaces/${item.id}/roadmap`}>{item.name}</Link>
              </li>
            ))}
            {!directory.data?.length && <li role="status">{t("access.empty")}</li>}
          </ul>
        )}
      </AppMain>
      <AppFooter text={t("app.footer")} />
    </AppPage>
  );
}
