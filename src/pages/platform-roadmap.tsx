import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppFooter,
  AppMain,
  AppPage,
  AppSkeleton,
  Button,
  LanguageSelector,
} from "@jordiorriols/ui";
import { platformRepository } from "@/data/platform";
import { PriorityProposals } from "@/components/organisms/priority-proposals";
import { useRoadmapDisplay } from "@/lib/roadmapDisplay";
import { cn } from "@/lib/utils";
import MarkersManager from "@/components/organisms/markers-manager";
import EstimationView from "@/components/organisms/estimation-view";
import type { Feature } from "@/types/planner";

export default function PlatformRoadmap() {
  const { workspace } = useParams();
  const { t, i18n } = useTranslation();
  const { fullWidth } = useRoadmapDisplay();
  const queryClient = useQueryClient();
  const [managingMarkers, setManagingMarkers] = useState(false);
  const directory = useQuery({
    queryKey: ["platform-workspaces", "planner"],
    queryFn: platformRepository.workspaces,
    refetchInterval: 60_000,
  });
  const role = directory.data?.find((item) => item.id === workspace)?.role;
  const canManage = role === "owner" || role === "editor";
  const internal = canManage || role === "viewer";
  const features = useQuery({
    queryKey: ["platform-features", workspace],
    enabled: !!workspace && internal,
    queryFn: () => {
      if (!workspace) throw new Error(t("publicRoadmap.unavailable"));
      return platformRepository.features(workspace);
    },
  });
  const projects = useQuery({
    queryKey: ["platform-projects", workspace],
    enabled: !!workspace && internal,
    queryFn: () => {
      if (!workspace) throw new Error(t("publicRoadmap.unavailable"));
      return platformRepository.projects(workspace);
    },
  });
  const markers = useQuery({
    queryKey: ["platform-markers", workspace],
    enabled: !!workspace && canManage,
    queryFn: () => {
      if (!workspace) throw new Error(t("publicRoadmap.unavailable"));
      return platformRepository.markers(workspace);
    },
  });
  async function refreshMarkers() {
    const results = await Promise.all([markers.refetch(), roadmap.refetch()]);
    for (const result of results) if (result.error) throw result.error;
  }
  async function refreshFeatures() {
    const results = await Promise.all([features.refetch(), projects.refetch(), roadmap.refetch()]);
    for (const result of results) if (result.error) throw result.error;
  }
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
      <AppMain className={cn("w-full flex-1 space-y-5", fullWidth && "max-w-none")}>
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
          <>
            {directory.error && (
              <div role="alert">
                <p>{directory.error.message}</p>
                <Button onClick={() => void directory.refetch()}>
                  {t("app.actions.tryAgain")}
                </Button>
              </div>
            )}
            {canManage && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  disabled={!markers.data}
                  onClick={() => setManagingMarkers(true)}
                >
                  {t("markers.manage")}
                </Button>
                {markers.error && (
                  <div role="alert">
                    <p>{markers.error.message}</p>
                    <Button onClick={() => void markers.refetch()}>
                      {t("app.actions.tryAgain")}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {internal && (
              <div className="space-y-2">
                {(projects.isPending || features.isPending) && (
                  <AppSkeleton label={t("app.loading.page")} fullPage={false} />
                )}
                {[projects.error, features.error]
                  .filter((error) => error !== null)
                  .map((error, index) => (
                    <div role="alert" key={index}>
                      <p>{error.message}</p>
                      <Button
                        onClick={() => {
                          void projects.refetch();
                          void features.refetch();
                        }}
                      >
                        {t("app.actions.tryAgain")}
                      </Button>
                    </div>
                  ))}
                {features.data && projects.data && (
                  <EstimationView
                    key={workspace}
                    features={features.data}
                    projects={projects.data}
                    workspace={{ id: workspace }}
                    canEdit={canManage}
                    refresh={refreshFeatures}
                    repository={{
                      saveFeature: (input, id) =>
                        platformRepository.saveFeature(workspace, input, id),
                      deleteFeature: (id) => platformRepository.deleteFeature(workspace, id),
                      createProject: platformRepository.createProject,
                      renameProject: platformRepository.renameProject,
                      deleteProject: platformRepository.deleteProject,
                    }}
                  />
                )}
              </div>
            )}
            <PriorityProposals
              key={workspace}
              scope={workspace}
              official={roadmap.data}
              repository={platformRepository}
              audience="workspace"
              {...(canManage
                ? {
                    onApply: async (ids: string[], revision: string) => {
                      const updated = await platformRepository.applyPriorities(
                        workspace,
                        ids,
                        revision
                      );
                      queryClient.setQueryData(["platform-roadmap", workspace], updated);
                      const priorities = new Map(
                        updated.features.map((feature, index) => [feature.id, index + 1])
                      );
                      queryClient.setQueryData<Feature[]>(
                        ["platform-features", workspace],
                        (current) =>
                          current?.map((feature) => {
                            const priority = priorities.get(feature.id);
                            return priority === undefined ? feature : { ...feature, priority };
                          })
                      );
                    },
                  }
                : {})}
            />
            {canManage && managingMarkers && markers.data && (
              <MarkersManager
                markers={markers.data}
                description={t("access.markersDescription")}
                onClose={() => setManagingMarkers(false)}
                onCreate={async (name, date) => {
                  await platformRepository.createMarker(workspace, name, date);
                  await refreshMarkers();
                }}
                onRename={async (id, name) => {
                  await platformRepository.renameMarker(workspace, id, name);
                  await refreshMarkers();
                }}
                onDelete={async (id) => {
                  await platformRepository.deleteMarker(workspace, id);
                  await refreshMarkers();
                }}
              />
            )}
          </>
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
