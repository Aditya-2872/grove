// ---------------------------------------------------------------------------
// Widget history: record one value per day so counters/metrics/progress can
// show a trend — "watch myself improve" — instead of only the current number.
// ---------------------------------------------------------------------------

import type { LogEntry } from "./types";
import { isoDay } from "./streak";

/** Upsert today's value into the log (one entry per day), keeping ~180 days. */
export function recordToday(log: LogEntry[] | undefined, value: number): LogEntry[] {
  const today = isoDay();
  const rest = (log ?? []).filter((e) => e.d !== today);
  return [...rest, { d: today, v: value }].slice(-180);
}

/** The logged values in date order — the sparkline series. */
export function series(log: LogEntry[] | undefined): number[] {
  return (log ?? [])
    .slice()
    .sort((a, b) => a.d.localeCompare(b.d))
    .map((e) => e.v);
}
