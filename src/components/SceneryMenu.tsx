// ---------------------------------------------------------------------------
// A small control to change a tab's scenery: pick a built-in scene or upload
// your own image. The choice is stored on the workspace, so it syncs and the
// reveal-trail unveils it.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import type { Scenery } from "../types";
import { SCENES, fileToSceneryDataUrl, resolveScenery } from "../scenery";
import { useAnimatedOpen } from "../hooks/useAnimatedOpen";
import { IconScene } from "./icons";

export default function SceneryMenu({
  scenery,
  onChange,
}: {
  scenery?: Scenery;
  onChange: (s: Scenery) => void;
}) {
  const [open, setOpen] = useState(false);
  const render = useAnimatedOpen(open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cur = resolveScenery(scenery);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const url = await fileToSceneryDataUrl(file);
      onChange({ kind: "image", url });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="absolute top-3 left-3 z-30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass rounded-full p-2 text-muted-c transition hover:text-c"
        title="Change scenery"
      >
        <IconScene className="h-4 w-4" />
      </button>

      {render && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`glass elevated ${open ? "pop-in" : "pop-out"} relative z-40 mt-2 w-56 rounded-2xl p-3`}
            style={{ transformOrigin: "top left" }}
          >
          <div className="mb-2 text-[11px] tracking-wide text-muted-c uppercase">Scenery</div>
          <div className="mb-2.5 grid grid-cols-3 gap-2">
            {SCENES.map((sc) => {
              const on = cur.kind === "scene" && cur.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => onChange({ kind: "scene", id: sc.id })}
                  className={`rounded-lg border p-1 text-center transition ${
                    on ? "border-[color:var(--accent)]" : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <span
                    className="mb-1 block h-8 rounded"
                    style={{ background: "radial-gradient(120% 120% at 60% 15%, var(--accent), var(--bg) 75%)" }}
                  />
                  <span className="text-[10px] text-muted-c">{sc.name}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full rounded-lg border border-dashed border-white/20 py-2 text-xs text-muted-c transition hover:text-c disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Upload your own image"}
          </button>
          {cur.kind === "image" && (
            <button
              onClick={() => onChange({ kind: "scene", id: "mountains" })}
              className="mt-1.5 w-full text-center text-[11px] text-muted-c transition hover:text-c"
            >
              Use a built-in scene
            </button>
          )}
          {error && <p className="mt-2 text-[11px] text-red-300/90">{error}</p>}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          </div>
        </>
      )}
    </div>
  );
}
