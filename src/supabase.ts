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

// Whether a user is currently signed in. Kept in sync by AuthProvider so plain
// (non-React) code — getAI() in particular — can tell a signed-in user from a
// guest without an async getSession(): a guest has no token, so the shared AI
// proxy would just reject them; they should fall to the offline mock instead.
let _hasSession = false;
export const setHasSession = (v: boolean) => {
  _hasSession = v;
};
export const hasSession = () => _hasSession;
