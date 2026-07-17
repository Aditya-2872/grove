// ---------------------------------------------------------------------------
// The canvas: ambient surface + the tab's animal scene + the widgets. While a
// widget is dragged, its edges/centers snap to nearby widgets and guide lines
// (Canva-style) are drawn at the matching coordinates.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import type { Widget, Scenery } from "../types";
import { sizeOf } from "../generateWorkspace";
import { useIsStacked } from "../hooks/useMediaQuery";
import WidgetCard from "./WidgetCard";
import SceneArt from "./SceneArt";
import SceneryLayer from "./Scenery";
import RevealTrail from "./RevealTrail";
import SceneryMenu from "./SceneryMenu";
import { IconTrash } from "./icons";

const SNAP = 6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Snap the moving rect's edges/centers to the nearest matching ones. */
function computeSnap(moving: Rect, others: Rect[]) {
  let x = moving.x;
  let y = moving.y;
  const guides: { v: number[]; h: number[] } = { v: [], h: [] };
  const mxs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const mys = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];

  let bestXd = SNAP + 1;
  let bestX: { line: number; delta: number } | null = null;
  let bestYd = SNAP + 1;
  let bestY: { line: number; delta: number } | null = null;

  for (const o of others) {
    const oxs = [o.x, o.x + o.w / 2, o.x + o.w];
    const oys = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const m of mxs)
      for (const t of oxs) {
        const d = Math.abs(m - t);
        if (d <= SNAP && d < bestXd) {
          bestXd = d;
          bestX = { line: t, delta: t - m };
        }
      }
    for (const m of mys)
      for (const t of oys) {
        const d = Math.abs(m - t);
        if (d <= SNAP && d < bestYd) {
          bestYd = d;
          bestY = { line: t, delta: t - m };
        }
      }
  }

  if (bestX) {
    x = moving.x + bestX.delta;
    guides.v.push(bestX.line);
  }
  if (bestY) {
    y = moving.y + bestY.delta;
    guides.h.push(bestY.line);
  }
  return { x, y, guides };
}

export default function Canvas({
  widgets,
  sceneIndex,
  scenery,
  onChangeScenery,
  onChange,
  onMove,
  onResize,
  onDelete,
}: {
  widgets: Widget[];
  sceneIndex: number;
  scenery?: Scenery;
  onChangeScenery: (s: Scenery) => void;
  onChange: (updated: Widget) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
}) {
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const wrapRef = useRef<HTMLDivElement>(null);
  const stacked = useIsStacked();

  /** Keep a widget wholly inside the canvas — the space is a page, not an
   *  endless plane, so a widget can never be pushed out of reach. */
  function clampToCanvas(x: number, y: number, w: number, h: number) {
    const el = wrapRef.current;
    if (!el) return { x: Math.max(0, x), y: Math.max(0, y) };
    const maxX = Math.max(0, el.clientWidth - w);
    const maxY = Math.max(0, el.clientHeight - h);
    return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
  }

  function handleMove(id: string, rawX: number, rawY: number) {
    const self = widgets.find((w) => w.id === id);
    if (!self) return;
    const s = sizeOf(self);
    const others = widgets
      .filter((w) => w.id !== id)
      .map((w) => {
        const sz = sizeOf(w);
        return { x: w.x, y: w.y, w: sz.w, h: sz.h };
      });
    const snapped = computeSnap({ x: rawX, y: rawY, w: s.w, h: s.h }, others);
    setGuides(snapped.guides);
    const { x, y } = clampToCanvas(snapped.x, snapped.y, s.w, s.h);
    onMove(id, x, y);
  }

  /** Resizing stops at the canvas edge too, for the same reason. */
  function handleResize(id: string, width: number, height: number) {
    const self = widgets.find((w) => w.id === id);
    const el = wrapRef.current;
    if (!self || !el) return onResize(id, width, height);
    onResize(
      id,
      Math.min(width, Math.max(1, el.clientWidth - self.x)),
      Math.min(height, Math.max(1, el.clientHeight - self.y)),
    );
  }

  const clearGuides = () => setGuides({ v: [], h: [] });

  // --- stacked: lift a card and drop it on the trash zone ---
  const [lifting, setLifting] = useState<string | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const overTrashRef = useRef(false); // pointerup reads this, not the state
  const trashRef = useRef<HTMLDivElement | null>(null);

  const handleLift = (id: string) => {
    setLifting(id);
    overTrashRef.current = false;
    setOverTrash(false);
  };
  const handleLiftMove = (x: number, y: number) => {
    const r = trashRef.current?.getBoundingClientRect();
    const over = !!r && y >= r.top && y <= r.bottom && x >= r.left && x <= r.right;
    if (over !== overTrashRef.current) {
      overTrashRef.current = over;
      setOverTrash(over);
      if (over) navigator.vibrate?.(18); // "it'll drop here"
    }
  };
  const handleLiftEnd = (id: string) => {
    if (overTrashRef.current) onDelete(id);
    setLifting(null);
    overTrashRef.current = false;
    setOverTrash(false);
  };

  return (
    // Two layers. The outer one never scrolls and holds the scenery, so the
    // world stays put behind the content like a real backdrop instead of
    // sliding away with the widgets.
    <div className="relative h-full w-full overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* scene at the back, hidden by the reveal-trail until the cursor unveils it */}
      <SceneryLayer scenery={scenery} />
      <RevealTrail />
      <div className="dots pointer-events-none absolute inset-0" />
      <SceneArt index={sceneIndex} />

      {/* The scroller. overflow-auto, not hidden: dragging is clamped so nothing
          can be pushed out, but if the WINDOW shrinks below existing widgets they
          must stay reachable rather than being sealed off. */}
      <div ref={wrapRef} className="absolute inset-0 overflow-auto">
      {widgets.length === 0 ? (
        <div className="pointer-events-none flex h-full w-full items-center justify-center px-6 text-center">
          <p className="text-sm text-muted-c">A quiet space. Add a widget to begin.</p>
        </div>
      ) : stacked ? (
        // Phones: a readable, scrollable column. Free placement needs a pointer
        // and room; neither exists here, so we drop it rather than ship a
        // canvas you can't actually use.
        <div className="relative z-[1] flex flex-col gap-4 px-4 pt-16 pb-52">
          {widgets.map((wd, i) => (
            <WidgetCard
              key={wd.id}
              widget={wd}
              index={i}
              stacked
              onChange={onChange}
              onMove={handleMove}
              onMoveEnd={clearGuides}
              onResize={handleResize}
              onDelete={onDelete}
              onLift={handleLift}
              onLiftMove={handleLiftMove}
              onLiftEnd={handleLiftEnd}
            />
          ))}
        </div>
      ) : (
        widgets.map((wd, i) => (
          <WidgetCard
            key={wd.id}
            widget={wd}
            index={i}
            onChange={onChange}
            onMove={handleMove}
            onMoveEnd={clearGuides}
            onResize={handleResize}
            onDelete={onDelete}
          />
        ))
      )}

      {guides.v.map((vx, i) => (
        <div key={`v${i}`} className="guide-v" style={{ left: vx, zIndex: 20 }} />
      ))}
      {guides.h.map((hy, i) => (
        <div key={`h${i}`} className="guide-h" style={{ top: hy, zIndex: 20 }} />
      ))}
      </div>

      {/* outside the scroller: a control, so it stays put while content scrolls */}
      <SceneryMenu scenery={scenery} onChange={onChangeScenery} />

      {/* Drop-to-delete. Only exists while a card is actually lifted, so it costs
          no space the rest of the time. */}
      {stacked && lifting && (
        <div
          ref={trashRef}
          className="pop-in pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex h-32 flex-col items-center justify-center gap-1.5"
          style={{
            background: overTrash
              ? "linear-gradient(0deg, rgba(184,86,76,0.92), rgba(184,86,76,0))"
              : "linear-gradient(0deg, rgba(0,0,0,0.72), rgba(0,0,0,0))",
            transition: "background 0.2s ease",
          }}
        >
          <IconTrash
            className={`h-6 w-6 transition-transform ${overTrash ? "scale-125 text-white" : "text-muted-c"}`}
          />
          <span className={`text-xs ${overTrash ? "text-white" : "text-muted-c"}`}>
            {overTrash ? "Release to delete" : "Drag here to delete"}
          </span>
        </div>
      )}
    </div>
  );
}
