// ---------------------------------------------------------------------------
// Gates the app behind login — but only when cloud accounts are configured.
// Local-only mode (no .env.local) renders the app directly, exactly as before.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import { cloudEnabled } from "../supabase";
import { useAuth } from "../auth";
import AuthScreen from "./AuthScreen";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, guest } = useAuth();

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

  // A signed-in user OR a guest who chose to try it first both see the app;
  // everyone else meets the sign-in screen.
  return session || guest ? <>{children}</> : <AuthScreen />;
}
