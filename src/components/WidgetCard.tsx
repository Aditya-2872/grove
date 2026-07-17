// ---------------------------------------------------------------------------
// The card frame: a frosted-glass panel with an organic (per-widget) corner
// radius, its own size, a draggable header, and a resize grip. Dragging reports
// the raw position up to the Canvas, which snaps it to alignment guides.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import type { Widget } from "../types";
import { sizeOf } from "../generateWorkspace";
import { useTilt } from "../hooks/useTilt";
import { IconClose } from "./icons";
import {
  StickyNoteView,
  ChecklistView,
  CounterView,
  TimerView,
  ProgressView,
  BmiView,
  MetricView,
  HabitView,
} from "./WidgetViews";

const MIN_W = 168;
const MIN_H = 120;

// Uniform, iOS-style rounded corners — clean and consistent across every widget.
const RADIUS = "26px";

export default function WidgetCard({
  widget,
  index,
  stacked = false,
  onChange,
  onMove,
  onMoveEnd,
  onResize,
  onDelete,
  onLift,
  onLiftMove,
  onLiftEnd,
}: {
  widget: Widget;
  index: number;
  /** Phone layout: the card flows full-width in a column instead of being
   *  free-placed, so there's nothing to drag or resize. */
  stacked?: boolean;
  onChange: (updated: Widget) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: () => void;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  /** Stacked only: long-press picks the card up so it can be dropped on the
   *  trash zone the Canvas shows. */
  onLift?: (id: string) => void;
  onLiftMove?: (x: number, y: number) => void;
  onLiftEnd?: (id: string) => void;
}) {
  const drag = useRef<{ px: number; py: number; wx: number; wy: number } | null>(null);
  const resize = useRef<{ px: number; py: number; w: number; h: number } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  // While dragging/resizing, disable the position transition so the card tracks
  // the pointer 1:1. When idle, the transition animates the auto-reflow that
  // runs on add/delete.
  const [moving, setMoving] = useState(false);

  const { w, h } = sizeOf(widget);
  const radius = RADIUS;
  // Tilt the glass card toward the cursor — off while dragging, resizing, or
  // editing the title so it never fights those interactions.
  const tiltRef = useTilt<HTMLDivElement>({
    maxTilt: 3.5,
    scale: 1.012,
    perspective: 900,
    disabled: moving || editingTitle,
  });

  // --- drag ---
  function onHeaderDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setMoving(true);
    drag.current = { px: e.clientX, py: e.clientY, wx: widget.x, wy: widget.y };
  }
  function onHeaderMove(e: React.PointerEvent) {
    const s = drag.current;
    if (!s) return;
    onMove(widget.id, Math.max(0, s.wx + (e.clientX - s.px)), Math.max(0, s.wy + (e.clientY - s.py)));
  }
  function onHeaderUp() {
    setMoving(false);
    if (drag.current) {
      drag.current = null;
      onMoveEnd();
    }
  }

  // --- resize ---
  function onGripDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setMoving(true);
    resize.current = { px: e.clientX, py: e.clientY, w, h };
  }
  function onGripMove(e: React.PointerEvent) {
    const s = resize.current;
    if (!s) return;
    onResize(
      widget.id,
      Math.max(MIN_W, s.w + (e.clientX - s.px)),
      Math.max(MIN_H, s.h + (e.clientY - s.py)),
    );
  }
  function onGripUp() {
    setMoving(false);
    resize.current = null;
  }

  // --- stacked: long-press to lift, drag to the trash zone ---
  // A press that MOVES before the timer fires is a scroll, not a lift, so the
  // list must stay scrollable from anywhere on the card until we're sure.
  const [lifted, setLifted] = useState(false);
  const [dy, setDy] = useState(0);
  const press = useRef<{ timer: number; sx: number; sy: number } | null>(null);
  // smoke-in is an entrance, but it fills forwards — and a filling CSS animation
  // outranks inline styles, so it would pin transform and the lifted card could
  // never follow the finger. Retire the class once it has played.
  const [entered, setEntered] = useState(false);
  const LIFT_MS = 320;
  const SLOP = 8;

  function cancelPress() {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    press.current = null;
  }
  function onStackDown(e: React.PointerEvent) {
    const sx = e.clientX;
    const sy = e.clientY;
    const el = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    const timer = window.setTimeout(() => {
      if (press.current) press.current.timer = 0;
      try {
        el.setPointerCapture(pid);
      } catch {
        /* pointer already gone */
      }
      setEntered(true); // never replay the entrance after the card is touched
      setLifted(true);
      navigator.vibrate?.(12);
      onLift?.(widget.id);
    }, LIFT_MS);
    press.current = { timer, sx, sy };
  }
  function onStackMove(e: React.PointerEvent) {
    const p = press.current;
    if (!p) return;
    if (!lifted) {
      if (Math.abs(e.clientY - p.sy) > SLOP || Math.abs(e.clientX - p.sx) > SLOP) cancelPress();
      return;
    }
    setDy(e.clientY - p.sy);
    onLiftMove?.(e.clientX, e.clientY);
  }
  function onStackUp() {
    if (lifted) {
      onLiftEnd?.(widget.id);
      setLifted(false);
      setDy(0);
    }
    cancelPress();
  }

  // touch-action can't be changed mid-gesture, so once lifted we block the
  // page's scroll directly. Non-passive, or preventDefault is ignored.
  useEffect(() => {
    if (!lifted) return;
    const block = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, [lifted]);
  useEffect(() => cancelPress, []);

  return (
    <div
      className={`${entered ? "" : "smoke-in"} ${stacked ? "relative w-full" : "absolute"}`}
      // self only: pop-in/fade-in from children bubble through here too
      onAnimationEnd={(e) => e.target === e.currentTarget && setEntered(true)}
      style={
        stacked
          ? {
              minHeight: h,
              animationDelay: `${Math.min(index * 0.08, 0.6)}s`,
              // lifted: ride the finger, floating above the rest of the column
              transform: lifted ? `translateY(${dy}px) scale(1.04)` : undefined,
              zIndex: lifted ? 40 : undefined,
              transition: lifted ? "none" : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: lifted ? "transform" : undefined,
            }
          : {
              left: widget.x,
              top: widget.y,
              width: w,
              height: h,
              zIndex: moving ? 3 : 1,
              animationDelay: `${Math.min(index * 0.08, 0.6)}s`,
              transition: moving
                ? "none"
                : "left 0.32s cubic-bezier(0.22, 1, 0.36, 1), top 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
            }
      }
    >
      <div
        ref={tiltRef}
        className="tilt tilt-shadow glass blob group/card relative flex h-full w-full flex-col"
        style={{ borderRadius: radius }}
      >
      {/* header / drag handle */}
      <div
        onPointerDown={stacked ? onStackDown : onHeaderDown}
        onPointerMove={stacked ? onStackMove : onHeaderMove}
        onPointerUp={stacked ? onStackUp : onHeaderUp}
        onPointerCancel={stacked ? onStackUp : undefined}
        // In the column the header must NOT swallow touch-action, or the list
        // can't be scrolled by dragging from a card header — which is most of
        // the card. Only the lifted card takes the gesture.
        className={`flex items-center justify-between px-4 pt-3 pb-1.5 ${
          stacked ? (lifted ? "touch-none" : "") : "touch-none cursor-grab active:cursor-grabbing"
        }`}
      >
        {editingTitle ? (
          <input
            autoFocus
            value={widget.title}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ ...widget, title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
            className="w-full bg-transparent text-xs font-medium tracking-wide text-c uppercase outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => setEditingTitle(true)}
            className="truncate text-xs font-medium tracking-wider text-muted-c uppercase"
            title="Double-click to rename"
          >
            {widget.title}
          </span>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(widget.id)}
          className="touch-visible ml-2 text-muted-c opacity-0 transition group-focus-within/card:opacity-100 hover:text-c group-hover/card:opacity-100"
          title="Delete widget"
          aria-label={`Delete widget: ${widget.title}`}
        >
          <IconClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {widget.type === "sticky_note" && <StickyNoteView widget={widget} onChange={onChange} />}
        {widget.type === "checklist" && <ChecklistView widget={widget} onChange={onChange} />}
        {widget.type === "counter" && <CounterView widget={widget} onChange={onChange} />}
        {widget.type === "timer" && <TimerView widget={widget} onChange={onChange} />}
        {widget.type === "progress" && <ProgressView widget={widget} onChange={onChange} />}
        {widget.type === "bmi" && <BmiView widget={widget} onChange={onChange} />}
        {widget.type === "metric" && <MetricView widget={widget} onChange={onChange} />}
        {widget.type === "habit" && <HabitView widget={widget} onChange={onChange} />}
      </div>

      {/* resize grip — pointless in the stacked column, where cards are full-width */}
      {!stacked && (
        <div
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          className="absolute right-0.5 bottom-0.5 h-4 w-4 cursor-nwse-resize touch-none opacity-0 transition group-hover/card:opacity-100"
          title="Resize"
        >
          <svg viewBox="0 0 10 10" className="h-full w-full text-muted-c">
            <path d="M9 3 L3 9 M9 6 L6 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      )}
      </div>
    </div>
  );
}
