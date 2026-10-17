import React from "react";
import { NavLink, Outlet } from "react-router-dom";
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
} from "@jordiorriols/ui";
import { useTranslation } from "react-i18next";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { AppIcon } from "@/components/atoms/AppIcon";

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
  const { signOut, user } = useData();
  const { workspace, workspaces, workspaceApi, selectWorkspace, refresh, canEdit } = useWorkspace();
  const action = useAsyncAction();
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
      <AppMain>
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
