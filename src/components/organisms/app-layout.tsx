import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Calculator, GanttChartSquare, CalendarDays } from "@jordiorriols/ui/icons";
import { cn } from "@/lib/utils";
import { AppHeader, Button, LanguageSelector } from "@jordiorriols/ui";
import { useTranslation } from "react-i18next";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";

const NAV = [
  { to: "/", key: "estimation", icon: Calculator, end: true },
  { to: "/backlog", key: "backlog", icon: GanttChartSquare, end: false },
  { to: "/vacations", key: "vacations", icon: CalendarDays, end: false },
];
const LANGUAGES = [
  { code: "en", short: "EN", label: "English" },
  { code: "es", short: "ES", label: "Español" },
  { code: "ca", short: "CA", label: "Català" },
];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { signOut, user } = useData();
  const { workspace, workspaces, selectWorkspace, isOwner, createWorkspace } = useWorkspace();
  const action = useAsyncAction();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={t("planner.name")}
        subtitle={t("planner.subtitle")}
        icon={<GanttChartSquare />}
        actions={
          <LanguageSelector
            languages={LANGUAGES}
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
          <nav aria-label={t("planner.pages")} className="flex items-center gap-1 overflow-x-auto">
            {NAV.map(({ to, key, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={t(`planner.tabs.${key}`)}
                className={({ isActive }) =>
                  cn(
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{t(`planner.tabs.${key}`)}</span>
              </NavLink>
            ))}
          </nav>
        }
      />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap gap-2 items-center mb-6">
          <select
            aria-label={t("planner.workspace")}
            value={workspace.id}
            onChange={(event) => selectWorkspace(event.target.value)}
            className="field max-w-40"
          >
            {workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {t(isOwner ? "planner.owner" : "planner.member")}
          </span>
          <Button variant="ghost" size="sm" onClick={createWorkspace}>
            {t("planner.newWorkspace")}
          </Button>
        </div>
        {action.error && (
          <p role="alert" className="px-6 text-destructive">
            {action.error}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
