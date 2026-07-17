// ---------------------------------------------------------------------------
// The integrated clock + alarm that lives in the top bar (not a widget). Shows
// the live day / date / time, and an alarm you can set from a small popover.
// When the alarm's minute arrives it chimes + notifies + shows a dismiss banner.
// The alarm is device-local (localStorage) — a personal utility, not synced data.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { loadAlarm, saveAlarm, type Alarm } from "../prefs";
import { notifyAlarm, requestNotifyPermission } from "../chime";
import { useAnimatedOpen } from "../hooks/useAnimatedOpen";
import { IconClock } from "./icons";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

// A web alarm can only ring while the tab is open. If it was skipped because the
// tab was frozen/asleep through the target minute, fire it when we next look —
// but only if it's still recent enough to be useful; a wall-clock alarm that's
// hours stale (laptop was shut) should quietly lapse, not blare on reopen.
const GRACE_MS = 30 * 60 * 1000;

/** Epoch ms of the next time local wall-clock reads "HH:MM" (today, else tomorrow). */
function nextOccurrence(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export default function ClockBar() {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const render = useAnimatedOpen(open);
  const [alarm, setAlarm] = useState<Alarm>(loadAlarm);
  const [ringing, setRinging] = useState(false);
  // The firesAt value already handled, so a ringing alarm doesn't re-fire every
  // tick (a fresh firesAt from re-arm/snooze fires again).
  const firedRef = useRef<number | undefined>(undefined);

  const update = (a: Alarm) => {
    setAlarm(a);
    saveAlarm(a);
  };

  // tick every second for the clock display; also re-check the instant the tab
  // is refocused, so an alarm skipped while the tab slept fires on wake instead
  // of waiting up to the next throttled tick.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  // Fire when wall-clock crosses the target (not when a tick lands inside the
  // target minute — that's what a frozen tab silently missed).
  useEffect(() => {
    if (!alarm.armed || !alarm.firesAt || firedRef.current === alarm.firesAt) return;
    const late = Date.now() - alarm.firesAt;
    if (late < 0) return; // not due yet
    firedRef.current = alarm.firesAt;
    if (late <= GRACE_MS) {
      setRinging(true);
      notifyAlarm(alarm.label);
    } else {
      // Missed by too long to be useful (tab was asleep for ages) — lapse it.
      update({ ...alarm, armed: false, firesAt: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, alarm]);

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateStr = `${DAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      <div className="hidden flex-col items-end leading-tight sm:flex">
        <span className="text-sm tabular-nums text-c">{time}</span>
        <span className="text-[10px] tracking-wide text-muted-c">{dateStr}</span>
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-1.5 text-muted-c transition hover:surface hover:text-c"
        title="Alarm"
      >
        <IconClock className="h-4 w-4" />
        {alarm.armed && (
          <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        )}
      </button>

      {render && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`glass elevated ${open ? "pop-in" : "pop-out"} absolute top-full right-0 z-40 mt-2 w-56 rounded-2xl p-3`}
            style={{ transformOrigin: "top right" }}
          >
            <div className="mb-2 text-[11px] tracking-wide text-muted-c uppercase">Alarm</div>
            <input
              type="time"
              value={alarm.time}
              onChange={(e) => {
                const time = e.target.value;
                // Keep firesAt in step if they retime an already-armed alarm.
                update({ ...alarm, time, firesAt: alarm.armed ? nextOccurrence(time) : alarm.firesAt });
              }}
              className="surface-soft mb-2 w-full rounded-lg px-3 py-2 text-sm text-c outline-none"
            />
            <input
              type="text"
              value={alarm.label}
              maxLength={40}
              onChange={(e) => update({ ...alarm, label: e.target.value })}
              placeholder="label (optional)"
              className="surface-soft mb-2.5 w-full rounded-lg px-3 py-2 text-sm text-c placeholder:text-muted-c outline-none"
            />
            <button
              onClick={() => {
                const arming = !alarm.armed;
                if (arming) requestNotifyPermission();
                firedRef.current = undefined;
                update({ ...alarm, armed: arming, firesAt: arming ? nextOccurrence(alarm.time) : undefined });
                setOpen(false);
              }}
              className={`w-full rounded-lg py-2 text-sm transition ${
                alarm.armed ? "surface text-muted-c hover:text-c" : "text-[#0a0d0b] hover:brightness-110"
              }`}
              style={alarm.armed ? undefined : { background: "var(--accent)" }}
            >
              {alarm.armed ? "Turn off alarm" : "Set alarm"}
            </button>
          </div>
        </>
      )}

      {ringing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="pop-in glass elevated w-full max-w-xs rounded-2xl p-6 text-center">
            <div className="mb-1 text-2xl font-light text-c">{time}</div>
            <div className="mb-5 text-sm text-muted-c">{alarm.label || "Alarm"}</div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // snooze 9 minutes — a precise offset from now, not a re-parsed
                  // "HH:MM", so it lands exactly 9 min out.
                  const t = new Date(Date.now() + 9 * 60 * 1000);
                  firedRef.current = undefined;
                  update({
                    ...alarm,
                    time: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
                    armed: true,
                    firesAt: t.getTime(),
                  });
                  setRinging(false);
                }}
                className="surface flex-1 rounded-lg py-2 text-sm text-c transition hover:brightness-125"
              >
                Snooze 9m
              </button>
              <button
                onClick={() => {
                  update({ ...alarm, armed: false, firesAt: undefined });
                  setRinging(false);
                }}
                className="flex-1 rounded-lg py-2 text-sm font-medium text-[#0a0d0b] transition hover:brightness-110"
                style={{ background: "var(--accent)" }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
