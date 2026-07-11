// ---------------------------------------------------------------------------
// A quiet floating control to add a widget. It only suggests widgets that fit
// the current tab's goal (so no BMI in a reading tab), and offers a
// "describe a custom widget" field as the last option.
// ---------------------------------------------------------------------------

import { useState } from "react";
import type { WidgetType } from "../types";
import { useAnimatedOpen } from "../hooks/useAnimatedOpen";
import { WidgetIcon, IconPlus } from "./icons";

const LABELS: Record<WidgetType, string> = {
  sticky_note: "Note",
  checklist: "Checklist",
  counter: "Counter",
  timer: "Timer",
  progress: "Progress",
  bmi: "BMI",
  metric: "Metric",
  habit: "Streak",
};

export default function AddWidgetMenu({
  suggested,
  onAdd,
  onAddCustom,
}: {
  suggested: WidgetType[];
  onAdd: (type: WidgetType) => void;
  onAddCustom: (description: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const render = useAnimatedOpen(open);
  const [describing, setDescribing] = useState(false);
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const close = () => {
    setOpen(false);
    setDescribing(false);
    setDesc("");
    setCreating(false);
  };

  const submitCustom = async () => {
    const v = desc.trim();
    if (!v || creating) return;
    setCreating(true);
    try {
      await onAddCustom(v);
      close();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      {render && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div
            className={`glass elevated ${open ? "pop-in" : "pop-out"} absolute right-0 bottom-full z-20 mb-2 w-56 overflow-hidden rounded-2xl`}
            style={{ transformOrigin: "bottom right" }}
          >
            <p className="px-3 pt-2.5 pb-1 text-[11px] tracking-wider text-muted-c uppercase">Suggested</p>
            {suggested.map((t) => (
              <button
                key={t}
                onClick={() => {
                  onAdd(t);
                  close();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted-c transition hover:bg-white/5 hover:text-c"
              >
                <WidgetIcon type={t} className="h-4 w-4 accent-text" />
                {LABELS[t]}
              </button>
            ))}

            <div className="my-1 border-t hair" />

            {describing ? (
              <div className="p-2">
                <input
                  autoFocus
                  value={desc}
                  disabled={creating}
                  onChange={(e) => setDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCustom();
                    if (e.key === "Escape") setDescribing(false);
                  }}
                  placeholder="e.g. sleep hours, aim for 8"
                  className="surface-soft w-full rounded-lg px-2.5 py-1.5 text-sm text-c placeholder:text-muted-c outline-none disabled:opacity-60"
                />
                <button
                  onClick={submitCustom}
                  disabled={creating}
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-sm text-[#0a0d0b] transition hover:brightness-110 disabled:opacity-70"
                  style={{ background: "var(--accent)" }}
                >
                  {creating ? (
                    <>
                      <span className="size-3 animate-spin rounded-full border-2 border-[#0a0d0b]/30 border-t-[#0a0d0b]" />
                      Creating…
                    </>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDescribing(true)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm accent-text transition hover:bg-white/5"
              >
                <IconPlus className="h-4 w-4" />
                Describe a custom widget…
              </button>
            )}
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="glass flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-c transition hover:brightness-125"
        title="Add a widget"
      >
        <IconPlus className="h-4 w-4 accent-text" />
        widget
      </button>
    </div>
  );
}
