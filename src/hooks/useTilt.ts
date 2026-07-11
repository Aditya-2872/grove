// ---------------------------------------------------------------------------
// Pointer-tracked 3D tilt. Writes CSS custom properties only (--rx/--ry/--tz/
// --mx/--my/--nx/--ny) at requestAnimationFrame cadence; the .tilt CSS class
// composes the transform and owns the easing, so one hook powers tilt,
// cursor-glow, and shine effects.
//
// Auto-off: touch pointers, prefers-reduced-motion, focus inside an input
// (typing), pointer pressed (drag/click), or the `disabled` option.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

export interface TiltOptions {
  maxTilt?: number; // degrees at the card edge
  scale?: number; // hover scale
  perspective?: number; // px — smaller = more dramatic
  disabled?: boolean; // pass drag/resize/edit state here
}

const reduced =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

export function useTilt<T extends HTMLElement>(opts: TiltOptions = {}) {
  const ref = useRef<T | null>(null);
  // Options flow through a ref so listeners bind exactly once.
  const cfg = useRef(opts);
  cfg.current = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let px = 0;
    let py = 0; // latest pointer coords
    let hover = false;
    let pressed = false;
    let typing = false;
    let settleTimer: number | undefined;

    const off = () => cfg.current.disabled || typing || pressed || reduced?.matches;

    function frame() {
      raf = 0;
      if (!el || !hover || off()) return;
      const r = el.getBoundingClientRect();
      const nx = (px - r.left) / r.width - 0.5; // -0.5 .. 0.5
      const ny = (py - r.top) / r.height - 0.5;
      const max = cfg.current.maxTilt ?? 4;
      el.style.setProperty("--rx", `${(-ny * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(nx * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--tz", String(cfg.current.scale ?? 1.012));
      el.style.setProperty("--mx", `${(px - r.left).toFixed(1)}px`); // cursor glow
      el.style.setProperty("--my", `${(py - r.top).toFixed(1)}px`);
      el.style.setProperty("--nx", nx.toFixed(3)); // shine sweep
      el.style.setProperty("--ny", ny.toFixed(3));
    }

    function schedule(e: PointerEvent) {
      if (e.pointerType !== "mouse") return; // touch never tilts
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame); // coalesce to one per frame
    }

    function enter(e: PointerEvent) {
      if (!el || e.pointerType !== "mouse" || off()) return;
      hover = true;
      window.clearTimeout(settleTimer);
      el.dataset.tilt = "on"; // fast tracking transition
      el.style.willChange = "transform"; // promote only while hovered
      el.style.setProperty("--tp", `${cfg.current.perspective ?? 900}px`);
      schedule(e);
    }

    function flatten() {
      if (!el) return;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      el.dataset.tilt = "settle"; // springy return transition
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--tz", "1");
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        el.style.willChange = ""; // release the GPU layer
        delete el.dataset.tilt;
      }, 650);
    }

    function leave() {
      hover = false;
      flatten();
    }
    function down() {
      pressed = true;
      flatten(); // press = go flat (drag/click)
    }
    function up() {
      pressed = false;
    }
    function focusIn(e: FocusEvent) {
      const t = e.target as HTMLElement;
      if (t.matches("input, textarea, select, [contenteditable='true']")) {
        typing = true;
        flatten(); // typing dead-zone
      }
    }
    function focusOut() {
      typing = false;
    }

    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", schedule, { passive: true });
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", schedule);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
      window.clearTimeout(settleTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // If drag/resize starts mid-hover (`disabled` flips true), flatten immediately.
  useEffect(() => {
    const el = ref.current;
    if (opts.disabled && el) {
      el.dataset.tilt = "settle";
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--tz", "1");
    }
  }, [opts.disabled]);

  return ref;
}
