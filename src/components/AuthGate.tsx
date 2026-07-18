// ---------------------------------------------------------------------------
// Gates the app behind login — but only when cloud accounts are configured.
// Local-only mode (no .env.local) renders the app directly, exactly as before.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import { cloudEnabled } from "../supabase";
import { useAuth } from "../auth";
import AuthScreen from "./AuthScreen";
import LandingScreen from "./LandingScreen";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, guest, authOpen, setAuthOpen } = useAuth();

  if (!cloudEnabled) return <>{children}</>;

  if (loading) {
    return (
      <div className="ambient flex h-full items-center justify-center">
        <span
          className="size-3 rounded-full"
          style={{ background: "var(--accent)", animation: "breathe 2s ease-in-out infinite" }}
        />
      </div>
    );
  }

  // A signed-in user OR a guest who chose to try it first both see the app.
  // Everyone else meets the LANDING screen — which says what Grove is — and
  // only reaches the sign-in form if they ask for it.
  if (session || guest) return <>{children}</>;
  return authOpen ? (
    <AuthScreen onBack={() => setAuthOpen(false)} />
  ) : (
    <LandingScreen onSignIn={() => setAuthOpen(true)} />
  );
}
