// ---------------------------------------------------------------------------
// Small device-local UI preferences (not tied to an account/profile).
// Glass transparency: how see-through the widgets and panels are — lower lets
// more of the scenery show through; higher makes them solid.
// ---------------------------------------------------------------------------

const GLASS_KEY = "aditya.glass.alpha";

export const GLASS_MIN = 0.15;
export const GLASS_MAX = 0.85;
export const DEFAULT_GLASS_ALPHA = 0.5;

export function loadGlassAlpha(): number {
  try {
    const v = parseFloat(localStorage.getItem(GLASS_KEY) || "");
    return isNaN(v) ? DEFAULT_GLASS_ALPHA : Math.min(GLASS_MAX, Math.max(GLASS_MIN, v));
  } catch {
    return DEFAULT_GLASS_ALPHA;
  }
}

/** Write the alpha to the document root so every .glass surface updates live. */
export function applyGlassAlpha(v: number): void {
  document.documentElement.style.setProperty("--glass-alpha", String(v));
}

export function saveGlassAlpha(v: number): void {
  try {
    localStorage.setItem(GLASS_KEY, String(v));
  } catch {
    /* ignore */
  }
  applyGlassAlpha(v);
}

// --- alarm (device-local) --------------------------------------------------

const ALARM_KEY = "aditya.alarm.v1";

export interface Alarm {
  time: string; // "HH:MM" (24h)
  armed: boolean;
  label: string;
  /** Absolute epoch ms the alarm should fire — the next occurrence of `time`.
   *  Set when armed. Firing off this instead of matching the current minute
   *  means a throttled/asleep tab that skips the target minute still fires on
   *  its next tick or when it wakes, rather than missing the alarm forever. */
  firesAt?: number;
}

export function loadAlarm(): Alarm {
  try {
    const raw = localStorage.getItem(ALARM_KEY);
    if (raw) {
      const a = JSON.parse(raw) as Partial<Alarm>;
      if (typeof a.time === "string" && /^\d{2}:\d{2}$/.test(a.time)) {
        return {
          time: a.time,
          armed: !!a.armed,
          label: typeof a.label === "string" ? a.label : "",
          firesAt: typeof a.firesAt === "number" ? a.firesAt : undefined,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { time: "07:00", armed: false, label: "" };
}

export function saveAlarm(a: Alarm): void {
  try {
    localStorage.setItem(ALARM_KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}
