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
  HabitWidget,
  Widget,
} from "../types";
import { uid } from "../types";
import { notifyTimerDone, requestTimerNotifyPermission } from "../chime";
import { computeStreak, toggleToday, recentDays } from "../streak";
import { recordToday, series } from "../history";
import Sparkline from "./Sparkline";

type ChangeFn = (updated: Widget) => void;

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
              className="text-muted-c opacity-0 transition hover:text-c group-hover:opacity-100"
              title="Remove"
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
  const [remaining, setRemaining] = useState(widget.durationSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const chimedRef = useRef(false);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  // Chime + notify once when the countdown reaches zero (reset when re-armed).
  useEffect(() => {
    if (remaining === 0 && !chimedRef.current) {
      chimedRef.current = true;
      notifyTimerDone(widget.title);
    } else if (remaining !== 0) {
      chimedRef.current = false;
    }
  }, [remaining, widget.title]);

  const changeDuration = (deltaSeconds: number) => {
    const next = Math.max(60, widget.durationSeconds + deltaSeconds);
    onChange({ ...widget, durationSeconds: next });
    setRemaining(next);
    setRunning(false);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <span className="text-4xl font-light tabular-nums text-c">{mm}:{ss}</span>
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => {
            if (!running) requestTimerNotifyPermission();
            setRunning((v) => !v);
          }}
          className="rounded px-3 py-1 text-[#0a0d0b] transition hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button onClick={() => { setRunning(false); setRemaining(widget.durationSeconds); }} className="surface rounded px-3 py-1 text-c transition hover:brightness-125">
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
  const setValue = (value: number) => {
    const v = Math.max(0, value);
    onChange({ ...widget, value: v, log: recordToday(widget.log, v) });
  };
  const hasTarget = typeof widget.target === "number" && widget.target > 0;
  const pct = hasTarget ? Math.min(100, (widget.value / (widget.target as number)) * 100) : 0;
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
              <span className="text-lg font-light tabular-nums text-c">{widget.value}</span>
              <span className="text-[10px] text-muted-c">
                / {widget.target}
                {widget.unit ? " " + widget.unit : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-3xl font-light tabular-nums text-c">{widget.value}</div>
            {widget.unit ? <div className="text-xs text-muted-c">{widget.unit}</div> : null}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setValue(widget.value + 1)}
            className="size-8 rounded-full text-[#0a0d0b] transition hover:brightness-110 active:scale-90"
            style={{ background: "var(--accent)" }}
          >
            +
          </button>
          <button
            onClick={() => setValue(widget.value - 1)}
            className="surface size-8 rounded-full text-c transition hover:brightness-125 active:scale-90"
          >
            −
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-c">
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
