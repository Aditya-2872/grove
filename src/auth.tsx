// ---------------------------------------------------------------------------
// Auth state for the app: the current session (or null), a loading beat while
// we check for a persisted login, and signOut. Bootstrapped via getSession();
// kept live via onAuthStateChange (sign-in, sign-out, token refresh).
// In local-only mode (no Supabase config) this is inert: no session, no load.
// ---------------------------------------------------------------------------

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, cloudEnabled } from "./supabase";

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(cloudEnabled);

  useEffect(() => {
    if (!supabase) return;
    // 1) initial: a login persisted in this browser
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // 2) live: sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut(); // onAuthStateChange clears the session
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
