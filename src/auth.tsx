// ---------------------------------------------------------------------------
// Auth state for the app: the current session (or null), a loading beat while
// we check for a persisted login, and signOut. Bootstrapped via getSession();
// kept live via onAuthStateChange (sign-in, sign-out, token refresh).
// In local-only mode (no Supabase config) this is inert: no session, no load.
// ---------------------------------------------------------------------------

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, cloudEnabled, setHasSession } from "./supabase";

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True when the visitor chose to try Grove without an account (cloud is
   *  available but they aren't signed in). Their work lives in this browser
   *  until they create an account, at which point it migrates to the cloud. */
  guest: boolean;
  enterGuest: () => void;
  exitGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

// Persist the guest choice so a reload keeps the trial going (the work is in
// localStorage anyway) instead of bouncing back to the sign-in screen.
const GUEST_KEY = "aditya.guest.v1";
const readGuest = () => {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(cloudEnabled);
  const [guestFlag, setGuestFlag] = useState(readGuest);

  const setGuest = (v: boolean) => {
    setGuestFlag(v);
    try {
      if (v) localStorage.setItem(GUEST_KEY, "1");
      else localStorage.removeItem(GUEST_KEY);
    } catch {
      /* private mode — the in-memory flag still works for this session */
    }
  };

  useEffect(() => {
    if (!supabase) return;
    // 1) initial: a login persisted in this browser
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setHasSession(!!data.session);
      if (data.session) setGuest(false);
      setLoading(false);
    });
    // 2) live: sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setHasSession(!!s);
      if (s) setGuest(false); // signing in supersedes and ends guest browsing
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut(); // onAuthStateChange clears the session
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        // A live session always wins, so a stale guest flag can never route a
        // signed-in user into the local app.
        guest: guestFlag && !session,
        enterGuest: () => setGuest(true),
        exitGuest: () => setGuest(false),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
