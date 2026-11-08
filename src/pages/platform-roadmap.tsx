import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppSkeleton, Button, Input } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { PlanSummaryCard } from "@/components/molecules/plan-summary-card";
import { fmtDate, parseDate } from "@/lib/planning";
import { platformRepository } from "@/data/platform";
import { PriorityProposals } from "@/components/organisms/priority-proposals";
import PlatformFrame from "@/components/organisms/platform-frame";
import { usePlatformDirectory } from "@/data/platformQueries";
import MarkersManager from "@/components/organisms/markers-manager";
import EstimationView from "@/components/organisms/estimation-view";
import type { Feature } from "@/types/planner";

export default function PlatformRoadmap() {
  const { workspace } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settingsAction = useAsyncAction();
  const [managingMarkers, setManagingMarkers] = useState(false);
  const directory = usePlatformDirectory();
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
    <PlatformFrame
      {...(roadmap.data ? { name: roadmap.data.name } : {})}
      {...(workspace ? { workspace } : {})}
      internal={internal}
    >
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
              <Button onClick={() => void directory.refetch()}>{t("app.actions.tryAgain")}</Button>
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
              <PlanSummaryCard
                label={t("roadmap.dates.start")}
                value={fmtDate(parseDate(roadmap.data.startDate))}
              >
                {canManage && (
                  <Input
                    type="date"
                    aria-label={t("roadmap.dates.start")}
                    min="2026-01-01"
                    max="2027-12-31"
                    value={roadmap.data.startDate}
                    disabled={settingsAction.busy}
                    onChange={(event) => {
                      const date = event.target.value;
                      void settingsAction.run(async () => {
                        const updated = await platformRepository.setPlanStart(workspace, date);
                        queryClient.setQueryData(["platform-roadmap", workspace], updated);
                      });
                    }}
                  />
                )}
              </PlanSummaryCard>
              {settingsAction.error && <p role="alert">{settingsAction.error}</p>}
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
                  onToggleBacklog={(id, included) =>
                    platformRepository.toggleBacklog(workspace, id, included)
                  }
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
    </PlatformFrame>
  );
}
