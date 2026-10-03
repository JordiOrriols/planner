import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSupabaseAuth } from "@jordiorriols/ui/hooks";
import { supabase } from "./supabaseClient";
import { createPlannerRepository, type PlannerRepository } from "./plannerRepository";

type DataContextValue = ReturnType<typeof useSupabaseAuth> & {
  repository: PlannerRepository | null;
};
const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const auth = useSupabaseAuth(supabase);
  const repository = useMemo(
    () => (supabase && auth.user ? createPlannerRepository(supabase) : null),
    [auth.user]
  );
  return <DataContext.Provider value={{ ...auth, repository }}>{children}</DataContext.Provider>;
}

const unavailable = async (): Promise<never> => {
  throw new Error("Authentication is not configured");
};
const fallback: DataContextValue = {
  authEnabled: false,
  user: null,
  loading: false,
  passwordRecovery: false,
  authError: null,
  repository: null,
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
