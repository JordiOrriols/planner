import { useTranslation } from "react-i18next";
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSkeleton, Button } from "@jordiorriols/ui";
import { DataProvider } from "./data/DataProvider";
import { WorkspaceProvider } from "./data/WorkspaceProvider";
import { EntryGate } from "./components/EntryGate";
import { PasswordResetDialog } from "./components/molecules/PasswordResetDialog";
import AppLayout from "./components/organisms/app-layout";

const Estimation = lazy(() => import("./pages/estimation"));
const Backlog = lazy(() => import("./pages/backlog"));
const Vacations = lazy(() => import("./pages/vacations"));
const VacationLink = lazy(() => import("./pages/vacation-link"));
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation();

  return (
    <div className="p-8 space-y-4">
      <h1>{t("copy.somethingWentWrong")}</h1>
      <p role="alert">{error instanceof Error ? error.message : String(error)}</p>
      <Button onClick={resetErrorBoundary}>{t("copy.tryAgain")}</Button>
    </div>
  );
}
export default function App() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <PasswordResetDialog />
          <EntryGate>
            <Suspense fallback={<AppSkeleton label={t("copy.loadingPage")} />}>
              <Routes>
                <Route path="/vacations/:token" element={<VacationLink />} />
                <Route
                  path="*"
                  element={
                    <WorkspaceProvider>
                      <Routes>
                        <Route element={<AppLayout />}>
                          <Route path="/" element={<Estimation />} />
                          <Route path="/backlog" element={<Backlog />} />
                          <Route path="/vacations" element={<Vacations />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                      </Routes>
                    </WorkspaceProvider>
                  }
                />
              </Routes>
            </Suspense>
          </EntryGate>
        </DataProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
