// ---------------------------------------------------------------------------
// Date-aware streaks for the habit widget. All dates are local "YYYY-MM-DD".
// The current streak counts consecutive days ending today (or yesterday, while
// today is still open) and breaks the moment a day is missed.
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date as "YYYY-MM-DD" (not UTC — a day is the user's day). */
export function isoDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse "YYYY-MM-DD" back into a date at LOCAL midnight.
 *  `new Date("2026-07-17")` parses a date-only string as UTC midnight, which
 *  then reads back as the PREVIOUS day through isoDay()'s local getters for
 *  anyone west of UTC — their streak silently lost a day, or showed 0 while the
 *  button said "Done today ✓". Invisible from IST, which is why it shipped.
 *  Also DST-safe: the y/m/d constructor lands on local midnight either way. */
function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** `offset` days from today (negative = past). */
export function dayOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoDay(d);
}

export interface StreakInfo {
  current: number;
  longest: number;
  doneToday: boolean;
  /** streak is alive but today isn't checked in yet — nudge-worthy */
  atRisk: boolean;
}

export function computeStreak(checkins: string[]): StreakInfo {
  const set = new Set(checkins);
  const today = isoDay();
  const yesterday = dayOffset(-1);
  const doneToday = set.has(today);

  // Current streak: walk back from today (if done) or yesterday (still open).
  let current = 0;
  let cursor = doneToday ? today : set.has(yesterday) ? yesterday : null;
  if (cursor) {
    const d = fromIso(cursor);
    while (set.has(isoDay(d))) {
      current += 1;
      d.setDate(d.getDate() - 1);
    }
  }

  // Longest streak: scan all dates sorted ascending for the longest run.
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const iso of sorted) {
    const d = fromIso(iso);
    if (prev) {
      const gap = Math.round((d.getTime() - prev.getTime()) / 86_400_000);
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest: Math.max(longest, current), doneToday, atRisk: current > 0 && !doneToday };
}

/** Toggle today's check-in on/off, returning the new list. */
export function toggleToday(checkins: string[]): string[] {
  const today = isoDay();
  return checkins.includes(today) ? checkins.filter((d) => d !== today) : [...checkins, today];
}

/** The last `n` days (oldest→newest) as { iso, done, isToday } for the dot row. */
export function recentDays(checkins: string[], n = 14): { iso: string; done: boolean; isToday: boolean }[] {
  const set = new Set(checkins);
  const today = isoDay();
  const out: { iso: string; done: boolean; isToday: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const iso = dayOffset(-i);
    out.push({ iso, done: set.has(iso), isToday: iso === today });
  }
  return out;
}
