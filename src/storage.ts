// ---------------------------------------------------------------------------
// Persistence: everything the user creates is saved to the browser's
// localStorage, so their tabs, widgets, and edits survive a refresh.
// ---------------------------------------------------------------------------

import type { Workspace, MetricPeriod } from "./types";
import { detectDomain } from "./generateWorkspace";

/** A period named in a metric's title, or null if it names none. */
function periodFromTitle(title: string): MetricPeriod | null {
  const t = title.toLowerCase();
  if (/\btoday\b|\bdaily\b|\bper day\b|\ba day\b|\b\/\s*day\b/.test(t)) return "day";
  if (/\bthis week\b|\bweekly\b|\bper week\b|\ba week\b|\bthis wk\b/.test(t)) return "week";
  if (/\bthis month\b|\bmonthly\b|\bper month\b|\ba month\b|\bthis mo\b/.test(t)) return "month";
  return null;
}

/** One-time backfill: metrics created before `period` existed carry
 *  `period: undefined`, so a returning user's "Words today" never reset. Stamp
 *  the ones whose title clearly names a period. Idempotent and safe to run every
 *  load: it only touches `undefined` (a value the chip can no longer produce, so
 *  a hand-set "total" is never re-stamped), and a stamped metric is no longer
 *  undefined. Returns the same object when nothing changed, to keep identities
 *  stable for the sync diff. */
export function migrateMetricPeriods(w: Workspace): Workspace {
  let changed = false;
  const widgets = w.widgets.map((wd) => {
    if (wd.type === "metric" && wd.period === undefined) {
      const p = periodFromTitle(wd.title);
      if (p) {
        changed = true;
        return { ...wd, period: p };
      }
    }
    return wd;
  });
  return changed ? { ...w, widgets } : w;
}

export interface AppState {
  workspaces: Workspace[];
  activeId: string;
}

const STATE_KEY = "aditya.state.v1";
const THEME_KEY = "aditya.theme.v1";

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    // Full quota in local-only mode is usually a large uploaded scenery image.
    if (e instanceof DOMException && /quota/i.test(e.name)) {
      console.warn(
        "Local storage is full — recent changes weren't saved. Sign in to sync to the cloud, or pick a smaller scenery image.",
      );
    }
  }
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.workspaces || parsed.workspaces.length === 0) return null;
    // Backfill fields added over time: a distinct theme per tab (themes are
    // auto-assigned for now), a detected domain for contextual suggestions, and
    // a period on any metric whose title names one.
    parsed.workspaces = parsed.workspaces.map((w, i) =>
      migrateMetricPeriods({
        ...w,
        themeIndex: i,
        domain: w.domain ?? detectDomain(w.goal || ""),
      }),
    );
    return parsed;
  } catch {
    return null;
  }
}

export function saveTheme(theme: string): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function loadTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
