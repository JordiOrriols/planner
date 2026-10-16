import { useTranslation } from "react-i18next";
import React from "react";
import type { ReactNode } from "react";
import { useData } from "@/data/DataProvider";
import { WelcomePage } from "@/pages/WelcomePage";
import { useLocation } from "react-router-dom";
import { AppSkeleton } from "@jordiorriols/ui";

export function EntryGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const { user, loading, authError } = useData();
  const { pathname } = useLocation();

  if (/^\/vacations\/[^/]+\/?$/.test(pathname)) return children;

  if (loading) {
    return <AppSkeleton label={t("copy.loadingPlanner")} />;
  }

  if (!user) return <WelcomePage />;
  if (authError) return <p role="alert">{authError}</p>;
  return children;
}
