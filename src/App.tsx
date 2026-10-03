import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Button, Spinner } from "@jordiorriols/ui";
import { DataProvider } from "./data/DataProvider";
import { WorkspaceProvider } from "./data/WorkspaceProvider";
import { EntryGate } from "./components/EntryGate";
import { PasswordResetDialog } from "./components/molecules/PasswordResetDialog";
import AppLayout from "./components/organisms/app-layout";

const Estimation = lazy(() => import("./pages/estimation"));
const Backlog = lazy(() => import("./pages/backlog"));
const Vacations = lazy(() => import("./pages/vacations"));
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="p-8 space-y-4">
      <h1>Something went wrong</h1>
      <p role="alert">{error instanceof Error ? error.message : String(error)}</p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}
export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <PasswordResetDialog />
          <EntryGate>
            <WorkspaceProvider>
              <Suspense fallback={<Spinner label="Loading page" />}>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Estimation />} />
                    <Route path="/backlog" element={<Backlog />} />
                    <Route path="/vacations" element={<Vacations />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </WorkspaceProvider>
          </EntryGate>
        </DataProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
