// ---------------------------------------------------------------------------
// A soft two-note chime + optional desktop notification when a timer finishes.
// The sound is synthesized (Web Audio) so there's no asset to ship. Notification
// permission is requested when a timer starts (a user gesture), so it can fire
// even if the user has switched to another tab.
// ---------------------------------------------------------------------------

function playChime(): void {
  try {
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // A5 then D6 — a calm, resolving two-note figure.
    const notes: [number, number][] = [
      [880, 0],
      [1174.66, 0.18],
    ];
    for (const [freq, t] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(0.18, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 1);
    }
    window.setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* audio blocked — silent is acceptable */
  }
}

/** Ask for notification permission (call from a click — starting a timer, arming
 *  an alarm). Named export kept for the timer; aliased for general use. */
export function requestTimerNotifyPermission(): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
export const requestNotifyPermission = requestTimerNotifyPermission;

/** A more insistent triple chime + notification when an alarm fires. */
export function notifyAlarm(label: string): void {
  playChime();
  window.setTimeout(playChime, 700);
  window.setTimeout(playChime, 1400);
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Alarm", { body: label || "Time's up" });
    }
  } catch {
    /* ignore */
  }
}

/** Fire the chime + a notification when a timer completes. */
export function notifyTimerDone(title: string): void {
  playChime();
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Timer finished", {
        body: title ? `${title} — time's up` : "Time's up",
      });
    }
  } catch {
    /* ignore */
  }
}
