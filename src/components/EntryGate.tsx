import React from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useData } from "@/data/DataProvider";
import { WelcomePage } from "@/pages/WelcomePage";

export function EntryGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, loading } = useData();
  const isSharedRoute = pathname.startsWith("/e/") || pathname.startsWith("/v/");

  if (loading && !isSharedRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-b-slate-600" />
      </div>
    );
  }

  if (!isSharedRoute && !user) return <WelcomePage />;
  return children;
}
