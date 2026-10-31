import { useTranslation } from "react-i18next";
import { ErrorBoundary as SharedErrorBoundary, ErrorState } from "@jordiorriols/ui";
import React, { type ReactNode } from "react";

function BoundaryMessage({ name, error }: { name: string | undefined; error: Error }) {
  const { t } = useTranslation();
  return (
    <ErrorState
      title={t("app.errors.componentTitle", {
        componentName: name || t("app.errors.componentFallbackName"),
      })}
      message={error.message}
    />
  );
}

export function ErrorBoundary({
  children,
  fallback,
  componentName,
}: {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
  componentName?: string;
}) {
  return (
    <SharedErrorBoundary
      {...(componentName ? { componentName } : {})}
      fallback={(error) =>
        fallback ? fallback(error) : <BoundaryMessage name={componentName} error={error} />
      }
    >
      {children}
    </SharedErrorBoundary>
  );
}
