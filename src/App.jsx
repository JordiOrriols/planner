import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import Home from "./pages/home";
import { DataProvider } from "./data/DataProvider";
import { EntryGate } from "./components/EntryGate";
import { PasswordResetDialog } from "./components/molecules/PasswordResetDialog";

const AssessmentPage = lazy(() => import("./pages/AssessmentPage"));
const ViewPage = lazy(() => import("./pages/ViewPage"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto mb-4" />
        <p className="text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-6 bg-red-50 rounded-lg border border-red-200">
        <h1 className="text-2xl font-semibold text-red-800 mb-4">
          {t("app.error", "Something went wrong")}
        </h1>
        <p className="text-red-700 mb-4">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          {t("buttons.retry", "Try again")}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => (window.location.href = "/")}>
      <DataProvider>
        <PasswordResetDialog />
        <EntryGate>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/member/:id" element={<AssessmentPage />} />
              <Route path="/e/:token" element={<AssessmentPage />} />
              <Route path="/v/:token" element={<ViewPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </EntryGate>
      </DataProvider>
    </ErrorBoundary>
  );
}
