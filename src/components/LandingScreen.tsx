// ---------------------------------------------------------------------------
// The front door for logged-out visitors. Before this, a stranger's first view
// was a password form ("Welcome back") — which explains nothing about what
// Grove is. This says it, then offers the two real ways in: try it now (guest,
// no account), or sign in.
// ---------------------------------------------------------------------------

import { useAuth } from "../auth";
import WelcomeArt from "./WelcomeArt";
import { Logo } from "./icons";

export default function LandingScreen({ onSignIn }: { onSignIn: () => void }) {
  const { enterGuest } = useAuth();

  return (
    <div className="ambient fixed inset-0 flex items-center justify-center overflow-hidden">
      <WelcomeArt />
      <div className="rise-in relative z-10 w-full max-w-md px-6 text-center">
        <Logo className="floaty accent-text mx-auto mb-6 h-12 w-12" />

        <h1 className="mb-3 text-3xl font-light tracking-wide text-c">Grove</h1>
        <p className="mb-4 text-base text-c">Grow your goals in a calm, personal space.</p>
        <p className="mb-9 text-sm leading-relaxed text-muted-c">
          Tell Grove what you're working toward, and it lays out the few trackers that actually fit
          — a streak, a number, a short list — on a canvas you arrange yourself.
        </p>

        <button
          onClick={enterGuest}
          className="flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-medium text-[#0a0d0b] transition hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          Try it — no account needed
        </button>

        <button onClick={onSignIn} className="mt-5 text-xs text-muted-c transition hover:text-c">
          I have an account — sign in
        </button>

        <p className="mt-8 text-[11px] text-muted-c/70">
          Trying it keeps everything in this browser. Make an account later and it comes with you.
        </p>
      </div>
    </div>
  );
}
