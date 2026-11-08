import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppFooter, AppMain, AppPage, LanguageSelector, SelectField } from "@jordiorriols/ui";
import { useRoadmapDisplay } from "@/lib/roadmapDisplay";
import { cn } from "@/lib/utils";
import { usePlatformDirectory } from "@/data/platformQueries";

export default function PlatformFrame({
  name,
  workspace,
  internal,
  children,
}: {
  name?: string;
  workspace?: string;
  internal: boolean;
  children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { fullWidth } = useRoadmapDisplay();
  const directory = usePlatformDirectory();
  const navigate = useNavigate();
  return (
    <AppPage className="flex min-h-screen flex-col">
      <AppMain className={cn("w-full flex-1 space-y-5", fullWidth && "max-w-none")}>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{name ?? t("planner.name")}</h1>
            <p className="text-muted-foreground">{t("publicRoadmap.title")}</p>
          </div>
          <LanguageSelector
            value={i18n.language}
            label={t("header.language")}
            onValueChange={(value) => void i18n.changeLanguage(value)}
          />
        </header>
        {workspace && (
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/">{t("planner.workspace")}</Link>
            {directory.data?.some((item) => item.id === workspace) && (
              <SelectField
                aria-label={t("planner.workspace")}
                value={workspace}
                onValueChange={(id) => navigate(`/workspaces/${id}/roadmap`)}
                options={directory.data.map((item) => ({ value: item.id, label: item.name }))}
              />
            )}
          </div>
        )}
        {workspace && internal && (
          <nav className="flex flex-wrap gap-4" aria-label={t("planner.name")}>
            <NavLink
              className={({ isActive }) =>
                cn("underline underline-offset-4", isActive && "font-semibold")
              }
              to={`/workspaces/${workspace}/estimation`}
            >
              {t("planner.tabs.estimation")}
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                cn("underline underline-offset-4", isActive && "font-semibold")
              }
              to={`/workspaces/${workspace}/roadmap`}
            >
              {t("roadmap.title")}
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                cn("underline underline-offset-4", isActive && "font-semibold")
              }
              to={`/workspaces/${workspace}/vacations`}
            >
              {t("vacations.title")}
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                cn("underline underline-offset-4", isActive && "font-semibold")
              }
              to={`/workspaces/${workspace}/configuration`}
            >
              {t("teamConfiguration.title")}
            </NavLink>
          </nav>
        )}
        {children}
      </AppMain>
      <AppFooter text={t("app.footer")} />
    </AppPage>
  );
}
