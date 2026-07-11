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

export default function ClockBar() {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const render = useAnimatedOpen(open);
  const [alarm, setAlarm] = useState<Alarm>(loadAlarm);
  const [ringing, setRinging] = useState(false);
  const firedRef = useRef("");

  // tick every second (only this component re-renders)
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // fire once when the armed minute arrives
  useEffect(() => {
    if (!alarm.armed) return;
    const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}T${alarm.time}`;
    if (hm === alarm.time && firedRef.current !== key) {
      firedRef.current = key;
      setRinging(true);
      notifyAlarm(alarm.label);
    }
  }, [now, alarm]);

  const update = (a: Alarm) => {
    setAlarm(a);
    saveAlarm(a);
  };

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
              onChange={(e) => update({ ...alarm, time: e.target.value })}
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
                if (!alarm.armed) requestNotifyPermission();
                firedRef.current = "";
                update({ ...alarm, armed: !alarm.armed });
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
                  // snooze 9 minutes
                  const t = new Date(now.getTime() + 9 * 60 * 1000);
                  firedRef.current = "";
                  update({ ...alarm, time: `${pad(t.getHours())}:${pad(t.getMinutes())}`, armed: true });
                  setRinging(false);
                }}
                className="surface flex-1 rounded-lg py-2 text-sm text-c transition hover:brightness-125"
              >
                Snooze 9m
              </button>
              <button
                onClick={() => {
                  update({ ...alarm, armed: false });
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
