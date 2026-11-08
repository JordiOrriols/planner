import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlatformRoadmap from "./pages/platform-roadmap";
import PlatformVacations from "./pages/platform-vacations";
import { useTranslation } from "react-i18next";
import PlatformFrame from "./components/organisms/platform-frame";

function NotFound() {
  const { t } = useTranslation();
  return (
    <PlatformFrame internal={false}>
      <p role="alert">{t("pageMessage.notFound")}</p>
      <Link to="/">{t("pageMessage.home")}</Link>
    </PlatformFrame>
  );
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route index element={<PlatformRoadmap />} />
        <Route path="workspaces/:workspace/roadmap" element={<PlatformRoadmap />} />
        <Route path="workspaces/:workspace/estimation" element={<PlatformRoadmap estimation />} />
        <Route path="workspaces/:workspace/vacations" element={<PlatformVacations />} />
        <Route
          path="workspaces/:workspace/configuration"
          element={<PlatformVacations configuration />}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </QueryClientProvider>
  );
}
