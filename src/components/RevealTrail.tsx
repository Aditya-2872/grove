// ---------------------------------------------------------------------------
// The reveal-trail. A near-opaque dark canvas sits over the scenery; the cursor
// punches a soft, fading hole through it, so moving the mouse unveils the scene
// behind in a gentle trail that heals back to calm dark.
//
// Two canvases: a persistent "mask" accumulates the trail (white = revealed) and
// fades each frame; the visible canvas is filled with the world's --bg and then
// erased through the mask. GPU-cheap: two fills + one drawImage per frame.
// Respects prefers-reduced-motion (static dim scrim, no trail).
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

const RADIUS = 128; // reveal radius, CSS px
const FADE = 0.06; // per-frame trail fade (higher = shorter trail)
const BASE_ALPHA = 0.9; // overlay opacity at rest (lower = scene more visible)
const reduced =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function RevealTrail() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reduced?.matches) return;
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d");
    if (!mctx) return;

    // soft round brush, pre-rendered once
    const brush = document.createElement("canvas");
    brush.width = brush.height = RADIUS * 2;
    const bctx = brush.getContext("2d")!;
    const g = bctx.createRadialGradient(RADIUS, RADIUS, 0, RADIUS, RADIUS, RADIUS);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.55, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, RADIUS * 2, RADIUS * 2);

    let dpr = 1;
    let W = 0;
    let H = 0;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = parent!.clientWidth;
      H = parent!.clientHeight;
      for (const c of [canvas!, mask]) {
        c.width = Math.max(1, Math.round(W * dpr));
        c.height = Math.max(1, Math.round(H * dpr));
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    let bg: [number, number, number] = [10, 13, 11];
    let bgTick = 0;
    const refreshBg = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--bg");
      if (v) bg = hexToRgb(v);
    };
    refreshBg();

    let px = -999;
    let py = -999;
    let lx = -999;
    let ly = -999;
    let inside = false;

    const onMove = (e: PointerEvent) => {
      const r = canvas!.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      px = x;
      py = y;
    };
    const onLeave = () => {
      inside = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      if ((bgTick = (bgTick + 1) % 20) === 0) refreshBg();

      // fade the accumulated trail
      mctx!.globalCompositeOperation = "destination-out";
      mctx!.fillStyle = `rgba(0,0,0,${FADE})`;
      mctx!.fillRect(0, 0, W, H);

      // stamp the brush along the path since last frame (continuous trail)
      if (inside) {
        mctx!.globalCompositeOperation = "source-over";
        const startX = lx < -900 ? px : lx;
        const startY = ly < -900 ? py : ly;
        const dist = Math.hypot(px - startX, py - startY);
        const steps = Math.max(1, Math.round(dist / 16));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = startX + (px - startX) * t;
          const y = startY + (py - startY) * t;
          mctx!.drawImage(brush, x - RADIUS, y - RADIUS, RADIUS * 2, RADIUS * 2);
        }
      }
      lx = inside ? px : -999;
      ly = inside ? py : -999;

      // paint the dark overlay, then erase it through the trail mask
      ctx!.globalCompositeOperation = "source-over";
      ctx!.clearRect(0, 0, W, H);
      ctx!.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${BASE_ALPHA})`;
      ctx!.fillRect(0, 0, W, H);
      ctx!.globalCompositeOperation = "destination-out";
      ctx!.drawImage(mask, 0, 0, W, H);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  if (reduced?.matches) {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--bg)", opacity: BASE_ALPHA }}
      />
    );
  }
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
