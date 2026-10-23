// Browser Supabase client. Created lazily so mock mode (and SSR) never touch it.
// Uses the publishable key only: every access rule lives in RLS.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DATA_SOURCE } from "@/lib/data-source";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (DATA_SOURCE !== "supabase") {
    throw new Error("Supabase client requested while VITE_DATA_SOURCE is not 'supabase'.");
  }
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.");
    }
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
