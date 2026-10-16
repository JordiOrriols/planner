import i18n from "@/i18n";
import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSupabaseAuth } from "@jordiorriols/ui/hooks";
import { createWorkspaceApi, getAuthRedirectUrl, type WorkspaceApi } from "@jordiorriols/ui";
import { authCallback, supabase } from "./supabaseClient";
import { createPlannerRepository, type PlannerRepository } from "./plannerRepository";

type DataContextValue = ReturnType<typeof useSupabaseAuth> & {
  repository: PlannerRepository | null;
  workspaceApi: WorkspaceApi | null;
};
const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const auth = useSupabaseAuth(supabase, getAuthRedirectUrl("planner"), authCallback);
  const repository = useMemo(
    () => (supabase && auth.user ? createPlannerRepository(supabase) : null),
    [auth.user]
  );
  const workspaceApi = useMemo(
    () => (supabase && auth.user ? createWorkspaceApi(supabase) : null),
    [auth.user]
  );
  return (
    <DataContext.Provider value={{ ...auth, repository, workspaceApi }}>
      {children}
    </DataContext.Provider>
  );
}

const unavailable = async (): Promise<never> => {
  throw new Error(i18n.t("app.errors.authNotConfigured"));
};
const fallback: DataContextValue = {
  authEnabled: false,
  user: null,
  loading: false,
  passwordRecovery: false,
  authError: null,
  linkError: null,
  repository: null,
  workspaceApi: null,
  signIn: unavailable,
  signInWithGitHub: unavailable,
  signUp: unavailable,
  requestPasswordReset: unavailable,
  updatePassword: unavailable,
  signOut: unavailable,
};

export function useData(): DataContextValue {
  return useContext(DataContext) ?? fallback;
}
