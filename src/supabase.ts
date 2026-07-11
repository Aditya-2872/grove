// ---------------------------------------------------------------------------
// The one Supabase client for the whole app — or null when the env vars aren't
// set, in which case the app runs in local-only mode exactly as before.
// The anon key is public; Row-Level Security is what protects the data.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/** True when cloud accounts are configured (a .env.local with both values). */
export const cloudEnabled = supabase !== null;
