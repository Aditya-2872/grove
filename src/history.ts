// ---------------------------------------------------------------------------
// Widget history: record one value per day so counters/metrics/progress can
// show a trend — "watch myself improve" — instead of only the current number.
// ---------------------------------------------------------------------------

import type { LogEntry, MetricPeriod } from "./types";
import { isoDay } from "./streak";

/** The bucket an ISO day falls in: the day itself, its week (keyed by the
 *  Monday), or its month. Local dates throughout — a day is the user's day. */
export function periodKey(iso: string, period: MetricPeriod): string {
  if (period === "day") return iso;
  if (period === "month") return iso.slice(0, 7);
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // getDay(): 0=Sun. Shift so weeks start Monday.
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return `W${isoDay(dt)}`;
}

/** What a period-scoped metric is worth RIGHT NOW.
 *
 *  A metric's `value` is just the last number written. For "Words today" that
 *  number is still 500 on Tuesday, so the ring showed a full day the user
 *  hadn't started. Rather than run a rollover job (which needs the app open at
 *  midnight, and would rewrite data behind the user's back), derive it: if the
 *  newest logged day is in an earlier period than today, this period is empty.
 *  Metrics with no period accumulate forever and are returned untouched. */
export function effectiveValue(
  value: number,
  log: LogEntry[] | undefined,
  period: MetricPeriod | undefined,
): number {
  // "total" and absent both accumulate — nothing rolls over.
  if (!period || period === "total") return value;
  const last = (log ?? []).reduce<string | null>((acc, e) => (acc && acc >= e.d ? acc : e.d), null);
  if (!last) return value; // never logged — nothing has rolled over yet
  return periodKey(last, period) === periodKey(isoDay(), period) ? value : 0;
}

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
