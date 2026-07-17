// ---------------------------------------------------------------------------
// A calm "are you sure?" for the actions that can't be undone — closing a goal
// (which deletes it and everything in it, everywhere) and signing out.
// Animates both ways, like the rest of the app's popups.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Destructive actions get a red button instead of the accent. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [closing, setClosing] = useState(false);
  // One decision only: Enter can fire both the focused button and the key
  // handler, and a double-click can fire twice. Either would run the action
  // (delete!) twice.
  const fired = useRef(false);

  const close = (fn: () => void) => {
    if (fired.current) return;
    fired.current = true;
    setClosing(true);
    window.setTimeout(fn, 200); // let the pop-out play
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(onCancel);
      if (e.key === "Enter") close(onConfirm);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div
      onClick={() => close(onCancel)}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        opacity: closing ? 0 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass elevated w-full max-w-sm rounded-[26px] p-5 ${closing ? "pop-out" : "pop-in"}`}
      >
        <h2 className="text-sm font-medium text-c">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-c">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => close(onCancel)}
            className="surface rounded-full px-4 py-1.5 text-xs text-c transition hover:brightness-125"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={() => close(onConfirm)}
            className="rounded-full px-4 py-1.5 text-xs font-medium transition hover:brightness-110 active:scale-95"
            style={
              danger
                ? { background: "#b8564c", color: "#fdf3f1" }
                : { background: "var(--accent)", color: "#0a0d0b" }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
