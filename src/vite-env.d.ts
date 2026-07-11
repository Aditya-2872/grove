/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase → Project Settings → API. Public values, safe in the client ONLY because RLS scopes every row to the signed-in user. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
