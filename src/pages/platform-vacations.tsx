import React from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppSkeleton, Button } from "@jordiorriols/ui";
import { platformRepository } from "@/data/platform";
import { usePlatformDirectory } from "@/data/platformQueries";
import PlatformFrame from "@/components/organisms/platform-frame";
import VacationsView from "@/components/organisms/vacations-view";

export default function PlatformVacations() {
  const { workspace } = useParams();
  const { t } = useTranslation();
  const client = useQueryClient();
  const directory = usePlatformDirectory();
  const access = directory.data?.find((item) => item.id === workspace);
  const canEdit = access?.role === "owner" || access?.role === "editor";
  const internal = canEdit || access?.role === "viewer";
  const calendar = useQuery({
    queryKey: ["platform-calendar", workspace],
    enabled: !!workspace && internal,
    queryFn: () => {
      if (!workspace) throw new Error(t("publicRoadmap.unavailable"));
      return platformRepository.calendar(workspace);
    },
    refetchInterval: 60_000,
  });
  const error = directory.error ?? calendar.error;
  return (
    <PlatformFrame
      {...(access ? { name: access.name } : {})}
      {...(workspace ? { workspace } : {})}
      internal={internal}
    >
      {directory.isPending || (internal && calendar.isPending) ? (
        <AppSkeleton label={t("app.loading.page")} fullPage={false} />
      ) : error ? (
        <div role="alert">
          <p>{error.message}</p>
          <Button
            onClick={() => {
              void directory.refetch();
              void calendar.refetch();
            }}
          >
            {t("app.actions.tryAgain")}
          </Button>
        </div>
      ) : !workspace || !internal ? (
        <p role="alert">{t("publicRoadmap.unavailable")}</p>
      ) : calendar.data ? (
        <VacationsView
          key={workspace}
          members={calendar.data.members}
          linkedTeams={calendar.data.teams}
          vacations={calendar.data.vacations}
          workspace={{
            id: workspace,
            sprint_start_date: calendar.data.sprint_start_date,
            sprint_history: calendar.data.sprint_history,
          }}
          canEdit={canEdit}
          readOnlyNotice={t("vacationEditor.errors.editAccessRequired")}
          refresh={async () => {
            await client.invalidateQueries(
              { queryKey: ["platform-roadmap", workspace] },
              { throwOnError: true }
            );
          }}
          repository={{
            setVacations: async (member, start, end, working) => {
              const updated = await platformRepository.setVacations(
                workspace,
                member,
                start,
                end,
                working
              );
              client.setQueryData(["platform-calendar", workspace], updated);
            },
            setSprintCalibration: async (_scope, anchor, history) => {
              const updated = await platformRepository.setSprintCalibration(
                workspace,
                anchor,
                history
              );
              client.setQueryData(["platform-calendar", workspace], updated);
            },
          }}
        />
      ) : null}
    </PlatformFrame>
  );
}
