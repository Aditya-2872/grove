// ---------------------------------------------------------------------------
// A calm, on-theme time picker. The native <input type="time"> opens a browser
// "dialer" popup that is OS chrome — it can't be styled and clashes with the
// glass UI. This is two spinner columns (hours 0-23, minutes 0-59): scroll,
// use the chevrons, arrow keys, or type. Emits/accepts "HH:MM".
// ---------------------------------------------------------------------------

import { useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const wrap = (n: number, mod: number) => ((n % mod) + mod) % mod;

const Chevron = ({ up }: { up?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {up ? <path d="M6 14l6-6 6 6" /> : <path d="M6 10l6 6 6-6" />}
  </svg>
);

function Column({
  value,
  mod,
  onSet,
  label,
}: {
  value: number;
  mod: number;
  onSet: (v: number) => void;
  label: string;
}) {
  // While focused, the input is free-form (a draft string) so typing "13"
  // doesn't fight a controlled value re-render mid-keystroke; it commits on blur.
  const [draft, setDraft] = useState<string | null>(null);
  const step = (d: number) => onSet(wrap(value + d, mod));
  const commit = () => {
    if (draft !== null && draft !== "") onSet(wrap(parseInt(draft, 10), mod));
    setDraft(null);
  };

  return (
    <div
      className="surface-soft flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1"
      onWheel={(e) => {
        e.preventDefault();
        step(e.deltaY < 0 ? 1 : -1);
      }}
    >
      <button
        onClick={() => step(1)}
        className="rounded p-0.5 text-muted-c transition hover:text-c"
        aria-label={`${label} up`}
        title={`${label} up`}
      >
        <Chevron up />
      </button>
      <input
        value={draft ?? pad(value)}
        inputMode="numeric"
        aria-label={label}
        onFocus={(e) => {
          setDraft(pad(value));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="w-9 bg-transparent text-center text-2xl font-light tabular-nums text-c outline-none"
      />
      <button
        onClick={() => step(-1)}
        className="rounded p-0.5 text-muted-c transition hover:text-c"
        aria-label={`${label} down`}
        title={`${label} down`}
      >
        <Chevron />
      </button>
    </div>
  );
}

export default function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hRaw, mRaw] = value.split(":").map((n) => parseInt(n, 10));
  const h = Number.isFinite(hRaw) ? hRaw : 0;
  const m = Number.isFinite(mRaw) ? mRaw : 0;
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <Column value={h} mod={24} label="Hours" onSet={(v) => onChange(`${pad(v)}:${pad(m)}`)} />
      <span className="pb-1 text-2xl font-light text-muted-c">:</span>
      <Column value={m} mod={60} label="Minutes" onSet={(v) => onChange(`${pad(h)}:${pad(v)}`)} />
    </div>
  );
}
