/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" (default, demo data) or "supabase". */
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable (anon) key only. Never the service_role key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
