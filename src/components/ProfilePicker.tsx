// ---------------------------------------------------------------------------
// "Who's tending today?" — the profile picker after sign-in. Glass avatar tiles
// on the night sky; pick one to enter its space, or manage to edit them.
// ---------------------------------------------------------------------------

import { useState } from "react";
import type { Profile } from "../types";
import Avatar from "./Avatar";
import WelcomeArt from "./WelcomeArt";
import { Logo } from "./icons";

export default function ProfilePicker({
  profiles,
  onPick,
  onEdit,
  onCreate,
  onSignOut,
}: {
  profiles: Profile[];
  onPick: (id: string) => void;
  onEdit: (p: Profile) => void;
  onCreate: () => void;
  onSignOut: () => void;
}) {
  const [managing, setManaging] = useState(false);

  return (
    <div className="ambient fixed inset-0 flex flex-col items-center justify-center overflow-hidden">
      <WelcomeArt />
      <button
        onClick={onSignOut}
        className="glass fixed top-4 right-4 z-40 rounded-full px-3.5 py-1.5 text-xs text-muted-c transition hover:text-c"
      >
        sign out
      </button>

      <div className="rise-in relative z-10 w-full max-w-2xl px-6 text-center">
        <Logo className="floaty accent-text mx-auto mb-5 h-10 w-10" />
        <h1 className="mb-2 text-2xl font-light tracking-wide text-c">Who's tending today?</h1>
        <p className="mb-10 text-sm text-muted-c">
          {managing ? "Tap a profile to rename it, change its avatar, or remove it." : "Each profile keeps its own goals."}
        </p>

        <div className="flex flex-wrap items-start justify-center gap-6">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => (managing ? onEdit(p) : onPick(p.id))}
              className="group flex w-24 flex-col items-center gap-3"
            >
              <span
                className="relative size-24 overflow-hidden rounded-2xl border border-white/10 transition duration-300 group-hover:scale-105"
                style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}
              >
                <Avatar avatarId={p.avatarId} avatarImage={p.avatarImage} name={p.name} color={p.color} />
                {managing && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs text-white">
                    edit
                  </span>
                )}
              </span>
              <span className="max-w-full truncate text-sm text-muted-c transition group-hover:text-c">
                {p.name}
              </span>
            </button>
          ))}

          {!managing && profiles.length < 6 && (
            <button onClick={onCreate} className="group flex w-24 flex-col items-center gap-3">
              <span className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-white/20 text-2xl text-muted-c transition duration-300 group-hover:scale-105 group-hover:border-white/40 group-hover:text-c">
                +
              </span>
              <span className="text-sm text-muted-c transition group-hover:text-c">Add profile</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setManaging((m) => !m)}
          className="mt-11 text-xs tracking-wide text-muted-c uppercase transition hover:text-c"
        >
          {managing ? "Done" : "Manage profiles"}
        </button>
      </div>
    </div>
  );
}
