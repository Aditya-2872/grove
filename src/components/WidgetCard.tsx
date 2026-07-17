// ---------------------------------------------------------------------------
// The card frame: a frosted-glass panel with an organic (per-widget) corner
// radius, its own size, a draggable header, and a resize grip. Dragging reports
// the raw position up to the Canvas, which snaps it to alignment guides.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
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

  return (
    <div
      className={stacked ? "smoke-in relative w-full" : "smoke-in absolute"}
      style={
        stacked
          ? { minHeight: h, animationDelay: `${Math.min(index * 0.08, 0.6)}s` }
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
        onPointerDown={stacked ? undefined : onHeaderDown}
        onPointerMove={stacked ? undefined : onHeaderMove}
        onPointerUp={stacked ? undefined : onHeaderUp}
        className={`flex touch-none items-center justify-between px-4 pt-3 pb-1.5 ${
          stacked ? "" : "cursor-grab active:cursor-grabbing"
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
          className="touch-visible ml-2 text-muted-c opacity-0 transition hover:text-c group-hover/card:opacity-100"
          title="Delete widget"
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
