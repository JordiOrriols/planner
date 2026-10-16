import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirectAuthCallback } from "@jordiorriols/ui";

const redirecting = redirectAuthCallback("planner");

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

/** Null when the app is built without Supabase config (local-only mode). */
export const supabase: SupabaseClient | null =
  url && publishableKey && !redirecting
    ? createClient(url, publishableKey, {
        auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
      })
    : null;
