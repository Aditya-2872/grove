// ---------------------------------------------------------------------------
// Persistence: everything the user creates is saved to the browser's
// localStorage, so their tabs, widgets, and edits survive a refresh.
// ---------------------------------------------------------------------------

import type { Workspace } from "./types";
import { detectDomain } from "./generateWorkspace";

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
    // auto-assigned for now) and a detected domain for contextual suggestions.
    parsed.workspaces = parsed.workspaces.map((w, i) => ({
      ...w,
      themeIndex: i,
      domain: w.domain ?? detectDomain(w.goal || ""),
    }));
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
