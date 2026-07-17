// ---------------------------------------------------------------------------
// The interactive body of each widget type, in the calm palette. Colors come
// from CSS variables so they follow the active tab's theme.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import type {
  StickyNoteWidget,
  ChecklistWidget,
  CounterWidget,
  TimerWidget,
  ProgressWidget,
  BmiWidget,
  MetricWidget,
  MetricPeriod,
  HabitWidget,
  Widget,
} from "../types";
import { uid } from "../types";
import { notifyTimerDone, requestTimerNotifyPermission } from "../chime";
import { computeStreak, toggleToday, recentDays } from "../streak";
import { recordToday, series, effectiveValue } from "../history";
import Sparkline from "./Sparkline";

type ChangeFn = (updated: Widget) => void;

// A goal of 5000 steps can't be reached one tap at a time, so the +/- step
// scales with the target: always ~20-25 taps to fill the ring, snapped to a
// round number (5000 -> 200, 10000 -> 500, 8 hours -> 1).
function niceStep(target?: number): number {
  if (!target || target <= 20) return 1;
  const raw = target / 20;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

// Cycled by the period chip. Keyed by String(period) so `undefined` (a legacy
// metric that predates the field) is a real entry. Cycling never lands back on
// undefined — it writes an explicit "total" — so the migration can't re-stamp a
// value the user set by hand.
const PERIOD_LABEL: Record<string, string> = {
  undefined: "total",
  total: "total",
  day: "daily",
  week: "weekly",
  month: "monthly",
};
const NEXT_PERIOD: Record<string, MetricPeriod> = {
  undefined: "day",
  total: "day",
  day: "week",
  week: "month",
  month: "total",
};

// An editable number that only commits on blur/Enter — so typing "5000" logs
// one value, not a reading for 5, 50 and 500 on the way there.
function ValueField({
  value,
  onCommit,
  className,
}: {
  value: number;
  onCommit: (n: number) => void;
  className: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const n = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isFinite(n)) onCommit(Math.max(0, n));
    setDraft(null);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        e.currentTarget.select();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      title="Type a value"
      className={`no-spin bg-transparent text-center tabular-nums outline-none ${className}`}
    />
  );
}

const STICKY_TINTS = ["#242c22", "#2b2a20", "#202c2a", "#2a2028", "#26281f", "#1f2530"];
const STICKY_GRADIENT =
  "linear-gradient(155deg, color-mix(in srgb, var(--accent) 26%, #10140f), color-mix(in srgb, var(--accent) 8%, #10140f))";
const ACCENT_FILL = "linear-gradient(90deg, var(--accent-soft), var(--accent))";

export function StickyNoteView({ widget, onChange }: { widget: StickyNoteWidget; onChange: ChangeFn }) {
  const isGradient = widget.variant === "gradient";
  const background = isGradient ? STICKY_GRADIENT : widget.color;

  return (
    <div className="flex h-full flex-col gap-2">
      <textarea
        value={widget.content}
        onChange={(e) => onChange({ ...widget, content: e.target.value })}
        placeholder="Write something…"
        className="min-h-24 flex-1 resize-none rounded-lg p-2 text-sm text-c placeholder:text-muted-c outline-none"
        style={{ background }}
      />
      <div className="flex items-center gap-1.5">
        {STICKY_TINTS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ ...widget, color: c, variant: "plain" })}
            className="size-4 rounded-full ring-1 ring-white/10 transition hover:scale-110"
            style={{ background: c }}
            title="Tint"
          />
        ))}
        <button
          onClick={() => onChange({ ...widget, variant: "gradient" })}
          className="size-4 rounded-full ring-1 ring-white/10 transition hover:scale-110"
          style={{ background: "var(--accent)" }}
          title="Theme tint"
        />
      </div>
    </div>
  );
}

export function ChecklistView({ widget, onChange }: { widget: ChecklistWidget; onChange: ChangeFn }) {
  const [draft, setDraft] = useState("");

  const toggle = (id: string) =>
    onChange({ ...widget, items: widget.items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)) });
  const remove = (id: string) =>
    onChange({ ...widget, items: widget.items.filter((it) => it.id !== id) });
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange({ ...widget, items: [...widget.items, { id: uid(), text, done: false }] });
    setDraft("");
  };

  const doneCount = widget.items.filter((it) => it.done).length;
  const pct = widget.items.length ? (doneCount / widget.items.length) * 100 : 0;

  return (
    <div className="flex h-full flex-col gap-1.5 text-sm">
      <ul className="flex-1 space-y-1 overflow-auto pr-1">
        {widget.items.map((it) => (
          <li key={it.id} className="group flex items-center gap-2">
            <input type="checkbox" checked={it.done} onChange={() => toggle(it.id)} className="size-4 shrink-0" />
            <span className={it.done ? "flex-1 text-muted-c line-through" : "flex-1 text-c"}>{it.text}</span>
            <button
              onClick={() => remove(it.id)}
              className="touch-visible text-muted-c opacity-0 transition group-focus-within:opacity-100 hover:text-c group-hover:opacity-100"
              title="Remove"
              aria-label={`Remove: ${it.text}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundImage: ACCENT_FILL }} />
      </div>

      <div className="flex items-center gap-1 pt-0.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add item…"
          className="flex-1 rounded px-1 py-0.5 text-c placeholder:text-muted-c outline-none"
        />
        <button
          onClick={add}
          className="surface-soft rounded px-2 py-0.5 text-muted-c transition hover:text-c"
        >
          +
        </button>
      </div>
      <p className="text-right text-xs text-muted-c">{doneCount}/{widget.items.length} done</p>
    </div>
  );
}

export function CounterView({ widget, onChange }: { widget: CounterWidget; onChange: ChangeFn }) {
  const set = (value: number) => onChange({ ...widget, value, log: recordToday(widget.log, value) });
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center gap-4">
        <button
          onClick={() => set(widget.value - 1)}
          className="surface size-9 rounded-full text-xl text-c transition hover:brightness-125 active:scale-90"
        >
          −
        </button>
        <span className="min-w-12 text-center text-3xl font-light tabular-nums text-c">{widget.value}</span>
        <button
          onClick={() => set(widget.value + 1)}
          className="size-9 rounded-full text-xl text-[#0a0d0b] transition hover:brightness-110 active:scale-90"
          style={{ background: "var(--accent)" }}
        >
          +
        </button>
      </div>
      <Sparkline data={series(widget.log)} />
    </div>
  );
}

export function TimerView({ widget, onChange }: { widget: TimerWidget; onChange: ChangeFn }) {
  // Repaint tick only — the countdown itself is derived from wall-clock below.
  const [, force] = useState(0);
  const chimedRef = useRef(false);
  // Read the freshest widget/onChange from the completion effect without making
  // them effect deps (which would re-fire it every render onChange changes id).
  const latest = useRef({ widget, onChange });
  latest.current = { widget, onChange };

  const running = widget.endsAt != null;
  const remaining = running
    ? Math.max(0, Math.round((widget.endsAt! - Date.now()) / 1000))
    : widget.pausedRemaining ?? widget.durationSeconds;
  const done = running && remaining === 0;

  // While running, repaint ~4x/sec (cheap; wall-clock does the real counting)
  // and immediately on tab-return, since the interval is throttled in the
  // background and the elapsed time must be caught up at once.
  useEffect(() => {
    if (!running) return;
    const tick = () => force((n) => n + 1);
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  // Chime once the moment wall-clock crosses the end, then settle to a stopped
  // 00:00 (clears endsAt so no interval or countdown lingers).
  useEffect(() => {
    if (done && !chimedRef.current) {
      chimedRef.current = true;
      const { widget: w, onChange: oc } = latest.current;
      notifyTimerDone(w.title);
      oc({ ...w, endsAt: undefined, pausedRemaining: 0 });
    }
    if (!done) chimedRef.current = false;
  }, [done]);

  const start = () => {
    requestTimerNotifyPermission();
    const secs =
      widget.pausedRemaining && widget.pausedRemaining > 0 ? widget.pausedRemaining : widget.durationSeconds;
    onChange({ ...widget, endsAt: Date.now() + secs * 1000, pausedRemaining: undefined });
  };
  const pause = () => onChange({ ...widget, endsAt: undefined, pausedRemaining: remaining });
  const reset = () => onChange({ ...widget, endsAt: undefined, pausedRemaining: undefined });
  const changeDuration = (deltaSeconds: number) => {
    const next = Math.max(60, widget.durationSeconds + deltaSeconds);
    onChange({ ...widget, durationSeconds: next, endsAt: undefined, pausedRemaining: undefined });
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <span className="text-4xl font-light tabular-nums text-c">{mm}:{ss}</span>
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => (running ? pause() : start())}
          className="rounded px-3 py-1 text-[#0a0d0b] transition hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button onClick={reset} className="surface rounded px-3 py-1 text-c transition hover:brightness-125">
          Reset
        </button>
      </div>
      {!running && (
        <div className="flex items-center gap-2 text-xs text-muted-c">
          <button onClick={() => changeDuration(-5 * 60)} className="rounded px-1.5 py-0.5 transition hover:text-c">−5m</button>
          <span>length</span>
          <button onClick={() => changeDuration(5 * 60)} className="rounded px-1.5 py-0.5 transition hover:text-c">+5m</button>
        </div>
      )}
    </div>
  );
}

export function HabitView({ widget, onChange }: { widget: HabitWidget; onChange: ChangeFn }) {
  const { current, longest, doneToday, atRisk } = computeStreak(widget.checkins);
  const days = recentDays(widget.checkins, 14);
  const checkIn = () => onChange({ ...widget, checkins: toggleToday(widget.checkins) });

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-light tabular-nums accent-text">{current}</span>
        <span className="text-xs text-muted-c">day{current === 1 ? "" : "s"}</span>
      </div>
      <div className="text-[11px] text-muted-c">
        {longest > current ? `best streak · ${longest}` : "current streak"}
      </div>
      <button
        onClick={checkIn}
        className={`rounded-full px-4 py-1.5 text-sm transition ${
          doneToday ? "surface text-muted-c hover:text-c" : "text-[#0a0d0b] hover:brightness-110"
        }`}
        style={doneToday ? undefined : { background: "var(--accent)" }}
      >
        {doneToday ? "Done today ✓" : "Check in"}
      </button>
      <div className="flex gap-1">
        {days.map((d) => (
          <span
            key={d.iso}
            title={d.iso}
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: d.done ? "var(--accent)" : "rgba(255,255,255,0.10)",
              outline: d.isToday ? "1px solid var(--accent)" : "none",
              outlineOffset: "1px",
            }}
          />
        ))}
      </div>
      {atRisk && <div className="text-[11px] text-amber-200/80">keep your streak — check in today</div>}
    </div>
  );
}

export function ProgressView({ widget, onChange }: { widget: ProgressWidget; onChange: ChangeFn }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${widget.value}%`, backgroundImage: ACCENT_FILL }} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={widget.value}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ ...widget, value: v, log: recordToday(widget.log, v) });
          }}
          className="flex-1"
        />
        <span className="w-10 text-right text-sm tabular-nums text-muted-c">{widget.value}%</span>
      </div>
      <Sparkline data={series(widget.log)} />
    </div>
  );
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function BmiView({ widget, onChange }: { widget: BmiWidget; onChange: ChangeFn }) {
  const heightM = widget.heightCm / 100;
  const bmi = heightM > 0 ? widget.weightKg / (heightM * heightM) : 0;

  const field = (label: string, value: number, key: "heightCm" | "weightKg", unit: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-c">{label}</span>
      <div className="surface-soft flex items-center rounded-lg px-2 py-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange({ ...widget, [key]: Number(e.target.value) })}
          className="w-full bg-transparent text-sm text-c outline-none"
        />
        <span className="text-xs text-muted-c">{unit}</span>
      </div>
    </label>
  );

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="grid grid-cols-2 gap-2">
        {field("Height", widget.heightCm, "heightCm", "cm")}
        {field("Weight", widget.weightKg, "weightKg", "kg")}
      </div>
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-3xl font-light tabular-nums accent-text">{bmi ? bmi.toFixed(1) : "—"}</span>
        <span className="text-sm text-muted-c">{bmi ? bmiCategory(bmi) : ""}</span>
      </div>
    </div>
  );
}

export function MetricView({ widget, onChange }: { widget: MetricWidget; onChange: ChangeFn }) {
  // What this period is worth, not what was last written. Everything below —
  // ring, number, and the +/- maths — reads THIS. A display-only fix would make
  // the first tap on day two read 520 instead of 20.
  const value = effectiveValue(widget.value, widget.log, widget.period);
  const setValue = (next: number) => {
    const v = Math.max(0, next);
    onChange({ ...widget, value: v, log: recordToday(widget.log, v) });
  };
  const hasTarget = typeof widget.target === "number" && widget.target > 0;
  const pct = hasTarget ? Math.min(100, (value / (widget.target as number)) * 100) : 0;
  const step = niceStep(widget.target);
  const R = 30;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-1 items-center justify-center gap-4">
        {hasTarget ? (
          <div className="relative h-[84px] w-[84px] shrink-0">
            <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
              <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle
                cx="38"
                cy="38"
                r={R}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC - (pct / 100) * CIRC}
                className="transition-all"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <ValueField value={value} onCommit={setValue} className="w-16 text-lg font-light text-c" />
              <span className="text-[10px] text-muted-c">
                / {widget.target}
                {widget.unit ? " " + widget.unit : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <ValueField value={value} onCommit={setValue} className="w-24 text-3xl font-light text-c" />
            {widget.unit ? <div className="text-xs text-muted-c">{widget.unit}</div> : null}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setValue(value + step)}
            className="h-8 min-w-8 rounded-full px-2 text-xs font-medium text-[#0a0d0b] tabular-nums transition hover:brightness-110 active:scale-90"
            style={{ background: "var(--accent)" }}
            title={`Add ${step}`}
          >
            {step === 1 ? "+" : `+${step}`}
          </button>
          <button
            onClick={() => setValue(value - step)}
            className="surface h-8 min-w-8 rounded-full px-2 text-xs font-medium text-c tabular-nums transition hover:brightness-125 active:scale-90"
            title={`Subtract ${step}`}
          >
            {step === 1 ? "−" : `−${step}`}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-c">
        <label className="flex items-center gap-1">
          goal
          <input
            type="number"
            value={widget.target ?? ""}
            onChange={(e) =>
              onChange({ ...widget, target: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className="surface-soft w-12 rounded px-1 py-0.5 text-c outline-none"
          />
        </label>
        <button
          onClick={() => onChange({ ...widget, period: NEXT_PERIOD[String(widget.period)] })}
          className="surface-soft shrink-0 rounded px-1.5 py-0.5 text-c transition hover:brightness-125"
          title="How often this starts over"
        >
          {PERIOD_LABEL[String(widget.period)]}
        </button>
        <label className="flex flex-1 items-center gap-1">
          unit
          <input
            value={widget.unit ?? ""}
            onChange={(e) => onChange({ ...widget, unit: e.target.value })}
            placeholder="hrs"
            className="surface-soft w-full rounded px-1 py-0.5 text-c placeholder:text-muted-c outline-none"
          />
        </label>
      </div>
      <Sparkline data={series(widget.log)} />
    </div>
  );
}
