// ---------------------------------------------------------------------------
// Create or edit a profile: a name, and an avatar chosen from the app's own
// creatures OR uploaded as your own image. Deleting a profile also deletes its
// goal tabs (confirmed, and never allowed for your last remaining profile).
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import type { Profile } from "../types";
import { AVATAR_PRESETS, fileToAvatarDataUrl, type ProfileInput } from "../profiles";
import { WORLDS, worldForAnimal } from "../worlds";
import Avatar from "./Avatar";

export default function ProfileEditor({
  initial,
  canDelete,
  canCancel,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Profile;
  canDelete: boolean;
  canCancel: boolean;
  onSave: (input: ProfileInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [avatarId, setAvatarId] = useState<string | null>(initial?.avatarId ?? "fox");
  const [avatarImage, setAvatarImage] = useState<string | null>(initial?.avatarImage ?? null);
  const [color, setColor] = useState(initial?.color ?? "#9db38c");
  const [themePackId, setThemePackId] = useState<string>(
    initial?.themePackId ?? worldForAnimal(initial?.avatarId ?? "fox").id,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [closing, setClosing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const requestClose = () => {
    setClosing(true);
    window.setTimeout(onClose, 220);
  };

  function pickAnimal(id: string, c: string) {
    setAvatarId(id);
    setAvatarImage(null);
    setColor(c);
    // Choosing a creature suggests its world (the user can still change it below).
    setThemePackId(worldForAnimal(id).id);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarImage(dataUrl);
      setAvatarId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that image.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    const n = name.trim();
    if (!n) {
      setError("Give this profile a name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ name: n, avatarId, avatarImage, color, themePackId }, initial?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial || !onDelete) return;
    setBusy(true);
    try {
      await onDelete(initial.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className={`${closing ? "pop-out" : "pop-in"} w-full max-w-md rounded-2xl border border-white/10 bg-[#0e120e]/95 p-6 shadow-2xl`}
      >
        <div className="mb-5 flex items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-2xl border border-white/10">
            <Avatar avatarId={avatarId} avatarImage={avatarImage} name={name} color={color} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs tracking-wide text-muted-c uppercase">Profile name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Focus, or your name"
              className="surface-soft w-full rounded-xl px-3.5 py-2.5 text-sm text-c placeholder:text-muted-c outline-none"
            />
          </div>
        </div>

        <div className="mb-2 text-xs tracking-wide text-muted-c uppercase">Choose an avatar</div>
        <div className="mb-5 grid grid-cols-4 gap-2.5">
          {AVATAR_PRESETS.map((a) => (
            <button
              key={a.id}
              onClick={() => pickAnimal(a.id, a.color)}
              className={`aspect-square overflow-hidden rounded-xl border transition ${
                avatarId === a.id ? "border-[color:var(--accent)]" : "border-white/8 hover:border-white/25"
              }`}
              title={a.name}
              style={avatarId === a.id ? { boxShadow: "0 0 0 1px var(--accent)" } : undefined}
            >
              <Avatar avatarId={a.id} color={a.color} />
            </button>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-muted-c transition hover:text-c ${
              avatarImage ? "border-[color:var(--accent)]" : "border-dashed border-white/20 hover:border-white/40"
            }`}
            title="Upload your own"
          >
            <span className="text-lg leading-none">↑</span>
            <span className="text-[10px] tracking-wide">upload</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        </div>

        <div className="mb-2 text-xs tracking-wide text-muted-c uppercase">World</div>
        <div className="mb-5 grid grid-cols-3 gap-2.5">
          {WORLDS.map((w) => (
            <button
              key={w.id}
              onClick={() => setThemePackId(w.id)}
              className={`rounded-xl border p-1.5 text-left transition ${
                themePackId === w.id ? "border-[color:var(--accent)]" : "border-white/8 hover:border-white/25"
              }`}
              title={w.tagline}
              style={themePackId === w.id ? { boxShadow: "0 0 0 1px var(--accent)" } : undefined}
            >
              <span
                className="mb-1.5 block h-8 rounded-lg"
                style={{ background: `radial-gradient(120% 120% at 30% 15%, ${w.vars.accent}, ${w.vars.bg})` }}
              />
              <span className="block truncate px-0.5 text-[11px] text-muted-c">{w.name}</span>
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-xs text-red-300/90">{error}</p>}

        <div className="flex items-center gap-2.5">
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[#0a0d0b] transition hover:brightness-110 disabled:opacity-70"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "Saving…" : initial ? "Save changes" : "Create profile"}
          </button>
          {canCancel && (
            <button
              onClick={requestClose}
              disabled={busy}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-c transition hover:text-c"
            >
              Cancel
            </button>
          )}
        </div>

        {initial && onDelete && (
          <div className="mt-4 border-t border-white/8 pt-4">
            {confirmDelete ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-c">
                  Delete “{initial.name}” and all its tabs?
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={remove}
                    disabled={busy}
                    className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted-c hover:text-c"
                  >
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => canDelete && setConfirmDelete(true)}
                disabled={!canDelete}
                className="text-xs text-muted-c transition enabled:hover:text-red-300 disabled:opacity-40"
                title={canDelete ? "Delete this profile" : "Your last profile can't be deleted"}
              >
                Delete this profile
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
