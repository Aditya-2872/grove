// ---------------------------------------------------------------------------
// The gate before the app: sign in or create an account (email + password).
// On success, onAuthStateChange in auth.tsx swaps us into the app — this
// screen never navigates itself. Handles both Supabase "Confirm email"
// settings: ON (shows a check-your-inbox note) and OFF (straight in).
// ---------------------------------------------------------------------------

import { useState } from "react";
import { supabase } from "../supabase";
import WelcomeArt from "./WelcomeArt";
import { Logo } from "./icons";

type Mode = "signin" | "signup";

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match.";
  if (m.includes("already registered")) return "That email already has an account — sign in instead.";
  if (m.includes("at least 6")) return "Password needs at least 6 characters.";
  if (m.includes("valid email")) return "That doesn't look like a valid email.";
  if (m.includes("rate limit")) return "Too many tries — wait a minute and try again.";
  return message;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit() {
    if (!supabase || busy) return;
    const e = email.trim();
    if (!e || !password) {
      setError("Enter your email and a password.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) setError(friendly(error.message));
        // success: onAuthStateChange mounts the app
      } else {
        const { data, error } = await supabase.auth.signUp({ email: e, password });
        if (error) setError(friendly(error.message));
        else if (!data.session)
          setNotice("Almost there — check your inbox for a confirmation link, then sign in.");
        // if confirm-email is OFF, data.session exists and the app mounts
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ambient fixed inset-0 flex items-center justify-center overflow-hidden">
      <WelcomeArt />
      <div className="rise-in relative z-10 w-full max-w-sm px-6 text-center">
        <Logo className="floaty accent-text mx-auto mb-6 h-11 w-11" />
        <h1 className="mb-2 text-2xl font-light tracking-wide text-c">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-8 text-sm text-muted-c">
          {mode === "signin"
            ? "Sign in to tend your spaces from any device."
            : "Your goals, saved to your own account."}
        </p>

        <div className="space-y-2.5">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="you@example.com"
            className="surface-soft w-full rounded-xl px-3.5 py-2.5 text-sm text-c placeholder:text-muted-c outline-none backdrop-blur"
          />
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && submit()}
            placeholder={mode === "signin" ? "password" : "choose a password (6+ characters)"}
            className="surface-soft w-full rounded-xl px-3.5 py-2.5 text-sm text-c placeholder:text-muted-c outline-none backdrop-blur"
          />
        </div>

        {error && <p className="mt-3 text-xs text-red-300/90">{error}</p>}
        {notice && <p className="mt-3 text-xs accent-text">{notice}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-[#0a0d0b] transition hover:brightness-110 disabled:opacity-70"
          style={{ background: "var(--accent)" }}
        >
          {busy ? (
            <>
              <span className="size-3 animate-spin rounded-full border-2 border-[#0a0d0b]/30 border-t-[#0a0d0b]" />
              One moment…
            </>
          ) : mode === "signin" ? (
            "Sign in"
          ) : (
            "Create account"
          )}
        </button>

        <button
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError("");
            setNotice("");
          }}
          className="mt-5 text-xs text-muted-c transition hover:text-c"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
