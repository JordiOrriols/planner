import React, { useMemo } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";
import { Calculator, GanttChartSquare, CalendarDays, Settings } from "@jordiorriols/ui/icons";
import {
  AppHeader,
  AppMain,
  AppNavigation,
  AppNavigationItem,
  AppPage,
  LanguageSelector,
  WorkspaceBar,
  getWorkspaceLabels,
  type WorkspaceSharingConfig,
} from "@jordiorriols/ui";
import { useTranslation } from "react-i18next";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { AppIcon } from "@/components/atoms/AppIcon";
import { useRoadmapDisplay } from "@/lib/roadmapDisplay";

const NAV = [
  { to: "/", key: "planner.tabs.estimation", icon: Calculator, end: true },
  { to: "/backlog", key: "planner.tabs.backlog", icon: GanttChartSquare, end: false },
  { to: "/vacations", key: "planner.tabs.vacations", icon: CalendarDays, end: false },
  {
    to: "/team-configuration",
    key: "teamConfiguration.title",
    icon: Settings,
    end: false,
    editorsOnly: true,
  },
];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { signOut, user, repository } = useData();
  const { workspace, workspaces, workspaceApi, selectWorkspace, refresh, canEdit } = useWorkspace();
  const action = useAsyncAction();
  const roadmapPage = useMatch("/backlog");
  const { fullWidth } = useRoadmapDisplay();
  const sharing = useMemo<WorkspaceSharingConfig | undefined>(
    () =>
      repository
        ? {
            readAccess: () => repository.sharingAccess(workspace.id),
            publicLink: {
              load: () => repository.roadmapShare(workspace.id),
              setEnabled: (enabled) => repository.roadmapShare(workspace.id, enabled),
              getUrl: (token) => `${window.location.href.split("#")[0]}#/roadmap/${token}`,
              description: t("publicRoadmap.sharingDescription"),
            },
          }
        : undefined,
    [repository, workspace.id, user?.id, t]
  );
  return (
    <AppPage>
      <AppHeader
        projectId="planner"
        projectSwitcherLabel={t("planner.switchProject")}
        title={t("planner.name")}
        subtitle={t("planner.subtitle")}
        icon={<AppIcon />}
        actions={
          <LanguageSelector
            value={i18n.language}
            label={t("header.language")}
            className="inline-flex"
            onValueChange={(language) =>
              void action.run(async () => {
                await i18n.changeLanguage(language);
              })
            }
          />
        }
        accountAction={{
          type: "signOut",
          label: t("auth.signOut"),
          title: user?.email ?? "",
          disabled: action.busy,
          onClick: () => void action.run(signOut),
        }}
        navigation={
          <AppNavigation
            label={t("planner.pages")}
            actions={
              <WorkspaceBar
                api={workspaceApi}
                app="planner"
                workspaces={workspaces}
                value={workspace.id}
                onValueChange={selectWorkspace}
                onCreated={async (created) => {
                  selectWorkspace(created.id);
                  await refresh();
                }}
                onSharesChanged={refresh}
                labels={getWorkspaceLabels(i18n.language)}
                {...(sharing ? { sharing } : {})}
              />
            }
          >
            {NAV.filter((item) => canEdit || !item.editorsOnly).map(
              ({ to, key, icon: Icon, end }) => (
                <AppNavigationItem key={to} asChild>
                  <NavLink to={to} end={end} aria-label={t(key)}>
                    <Icon />
                    <span>{t(key)}</span>
                  </NavLink>
                </AppNavigationItem>
              )
            )}
          </AppNavigation>
        }
      />
      <AppMain className={roadmapPage && fullWidth ? "max-w-none" : undefined}>
        {action.error && (
          <p role="alert" className="px-6 text-destructive">
            {action.error}
          </p>
        )}
        <Outlet />
      </AppMain>
    </AppPage>
  );
}
