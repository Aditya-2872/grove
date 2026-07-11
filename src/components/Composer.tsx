// ---------------------------------------------------------------------------
// The centered prompt. It welcomes the user, takes their goal, shows a calm
// "curating" pause, then flies to the top-left corner to become the new tab.
//
// phase: "input"    → the prompt is shown
//        "curating" → the breathing loader plays (~1s)
//        "exiting"  → the card flies to the corner and fades
// ---------------------------------------------------------------------------

import { useState } from "react";
import WelcomeArt from "./WelcomeArt";
import { Logo } from "./icons";

const SUGGESTIONS = [
  "I want to get in shape",
  "Prepare for my final exams",
  "Launch a client project",
  "Write my first novel",
  "Build a daily reading habit",
];

function Curating() {
  return (
    <div className="flex flex-col items-center gap-7 py-12">
      <div className="relative h-20 w-20">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: "var(--accent)", animation: `breathe 2.4s ease-in-out ${i * 0.4}s infinite` }}
          />
        ))}
        <span className="absolute inset-[38%] rounded-full" style={{ background: "var(--accent)" }} />
      </div>
      <p className="fade-in text-sm tracking-wide text-muted-c">Curating your space…</p>
    </div>
  );
}

export default function Composer({
  phase,
  welcome,
  onSubmit,
  onCancel,
}: {
  phase: "input" | "curating" | "exiting";
  welcome: boolean;
  onSubmit: (goal: string) => void;
  onCancel?: () => void;
}) {
  const [goal, setGoal] = useState("");
  const submit = () => {
    const v = goal.trim();
    if (v) onSubmit(v);
  };

  return (
    <div className={`ambient fixed inset-0 z-30 flex items-center justify-center overflow-hidden ${phase === "exiting" ? "pointer-events-none" : ""}`}>
      <WelcomeArt />
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-500 ${phase === "exiting" ? "opacity-0" : "opacity-100"}`}
      />

      <div className={`relative z-10 w-full max-w-xl px-6 ${phase === "exiting" ? "fly-away" : "rise-in"}`}>
        {phase === "curating" ? (
          <Curating />
        ) : (
          <div className="text-center">
            <Logo className="floaty accent-text mx-auto mb-6 h-11 w-11" />
            <h1 className="mb-2 text-2xl font-light tracking-wide text-c">
              {welcome ? "What would you like to grow?" : "Start a new space"}
            </h1>
            <p className="mb-8 text-sm text-muted-c">
              Tell me a goal, and I'll shape a calm space to help you tend it.
            </p>

            <div className="surface-soft flex items-center gap-2 rounded-2xl px-3 py-2.5 shadow-lg backdrop-blur">
              <input
                autoFocus
                value={goal}
                maxLength={200}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="e.g. I want to get in shape"
                className="flex-1 bg-transparent px-2 text-c placeholder:text-muted-c outline-none"
              />
              <button
                onClick={submit}
                className="rounded-xl px-4 py-1.5 text-sm font-medium text-[#0a0d0b] transition hover:brightness-110"
                style={{ background: "var(--accent)" }}
              >
                Begin
              </button>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSubmit(s)}
                  className="hair rounded-full border px-3 py-1 text-xs text-muted-c transition hover:text-c"
                >
                  {s}
                </button>
              ))}
            </div>

            {onCancel && (
              <button onClick={onCancel} className="mt-7 text-xs text-muted-c transition hover:text-c">
                cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
