import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { Repository } from "./repository";
import { supabase } from "./supabaseClient";
import { createSupabaseRepository } from "./supabaseRepository";

type DataContextValue = {
  /** False when the build has no backend configured. */
  authEnabled: boolean;
  user: User | null;
  /** True until the session is restored and any pending migration finished. */
  loading: boolean;
  passwordRecovery: boolean;
  repository: Repository | null;
  signIn(email: string, password: string): Promise<void>;
  signInWithGitHub(): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    const apply = async (next: User | null) => {
      if (!active) return;
      setUser(next);
      setLoading(false);
    };

    client.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        void apply(session?.user ?? null);
      } else if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void apply(session?.user ?? null);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<DataContextValue>(() => {
    const client = supabase;
    return {
      authEnabled: !!client,
      user,
      loading,
      passwordRecovery,
      repository: client && user ? createSupabaseRepository(client) : null,
      async signIn(email, password) {
        if (!client) return;
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      async signInWithGitHub() {
        if (!client) return;
        const { error } = await client.auth.signInWithOAuth({
          provider: "github",
          options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
        });
        if (error) throw new Error(error.message);
      },
      async signUp(email, password) {
        if (!client) return { needsConfirmation: false };
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
        });
        if (error) throw new Error(error.message);
        return { needsConfirmation: !data.session };
      },
      async requestPasswordReset(email) {
        if (!client) return;
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        });
        if (error) throw new Error(error.message);
      },
      async updatePassword(password) {
        if (!client) return;
        const { error } = await client.auth.updateUser({ password });
        if (error) throw new Error(error.message);
        setPasswordRecovery(false);
      },
      async signOut() {
        await client?.auth.signOut();
      },
    };
  }, [user, loading, passwordRecovery]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

const fallback: DataContextValue = {
  authEnabled: false,
  user: null,
  loading: false,
  passwordRecovery: false,
  repository: null,
  signIn: async () => {},
  signInWithGitHub: async () => {},
  signUp: async () => ({ needsConfirmation: false }),
  requestPasswordReset: async () => {},
  updatePassword: async () => {},
  signOut: async () => {},
};

/** Works without a provider (tests, local-only) by falling back to device storage. */
export function useData(): DataContextValue {
  return useContext(DataContext) ?? fallback;
}
