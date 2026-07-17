// ---------------------------------------------------------------------------
// The data model. A Workspace (one tab) has a title, the original goal, a
// detected domain (which drives contextual widget suggestions), its own calm
// theme, and a list of Widgets. Widgets may carry an explicit size.
// ---------------------------------------------------------------------------

export type WidgetType =
  | "sticky_note"
  | "checklist"
  | "counter"
  | "timer"
  | "progress"
  | "bmi"
  | "metric"
  | "habit";

export type Domain =
  | "fitness"
  | "study"
  | "writing"
  | "finance"
  | "work"
  | "habit"
  | "general";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** One day's recorded value, for widget history + sparklines. d = "YYYY-MM-DD". */
export interface LogEntry {
  d: string;
  v: number;
}

interface WidgetBase {
  id: string;
  x: number;
  y: number;
  title: string;
  /** Optional explicit size; falls back to a per-type default when absent. */
  width?: number;
  height?: number;
}

export interface StickyNoteWidget extends WidgetBase {
  type: "sticky_note";
  content: string;
  color: string;
  variant?: "plain" | "gradient";
}

export interface ChecklistWidget extends WidgetBase {
  type: "checklist";
  items: ChecklistItem[];
}

export interface CounterWidget extends WidgetBase {
  type: "counter";
  value: number;
  unit?: string;
  target?: number;
  log?: LogEntry[];
}

export interface TimerWidget extends WidgetBase {
  type: "timer";
  durationSeconds: number;
}

export interface ProgressWidget extends WidgetBase {
  type: "progress";
  value: number; // 0 - 100
  log?: LogEntry[];
}

export interface BmiWidget extends WidgetBase {
  type: "bmi";
  heightCm: number;
  weightKg: number;
}

/** A number tracked toward a goal — "value / target unit", with a fill ring. */
export interface MetricWidget extends WidgetBase {
  type: "metric";
  value: number;
  unit?: string;
  target?: number;
  direction?: "up" | "down";
  log?: LogEntry[];
  /** How often the value starts over. Absent = it accumulates forever ("Total
   *  words", "Saved"). Set it for anything period-scoped ("Words today",
   *  "Workouts this week") — without it the ring reads 500/500 on day two and
   *  the app greets you saying the day is already done. The reset is derived
   *  from the log, never written: no timers, no server, no stale rollover. */
  period?: MetricPeriod;
}

export type MetricPeriod = "day" | "week" | "month";

/** A daily check-in habit. Each check-in is a local "YYYY-MM-DD" date; the
 *  current streak counts consecutive days up to today and breaks on a miss. */
export interface HabitWidget extends WidgetBase {
  type: "habit";
  checkins: string[];
}

export type Widget =
  | StickyNoteWidget
  | ChecklistWidget
  | CounterWidget
  | TimerWidget
  | ProgressWidget
  | BmiWidget
  | MetricWidget
  | HabitWidget;

// --- curation chat --------------------------------------------------------

export type ChatRole = "ai" | "user";

/** A widget the AI suggests; the user can Add (materialize) or Skip it. */
export interface WidgetProposal {
  id: string;
  spec: WidgetSpec;
  rationale: string;
  status: "pending" | "accepted" | "rejected";
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  proposals?: WidgetProposal[];
}

export interface CurationChat {
  open: boolean;
  seeded: boolean;
  status: "idle" | "thinking";
  messages: ChatMessage[];
}

/** The background scenery a tab reveals under the cursor: a built-in scene or
 *  the user's own uploaded image. Absent = the default scene. */
export type Scenery =
  | { kind: "scene"; id: string }
  | { kind: "image"; url: string };

export interface Workspace {
  id: string;
  title: string;
  goal: string;
  domain: Domain;
  widgets: Widget[];
  themeIndex: number;
  createdAt: number;
  /** Optional so workspaces saved before the chat existed still load. */
  chat?: CurationChat;
  /** Optional so older workspaces default to the built-in scene. */
  scenery?: Scenery;
}

// --- profiles (Netflix-style, one account may hold several) ----------------

export interface Profile {
  id: string;
  name: string;
  /** preset animal key (e.g. "fox") — null when an image is uploaded instead */
  avatarId: string | null;
  /** uploaded avatar as a data URL — null when using a preset animal */
  avatarImage: string | null;
  /** world theme id (applied in a later slice) — null = default */
  themePackId: string | null;
  color: string;
  createdAt: number;
}

export const uid = (): string => crypto.randomUUID();

/** Omit that distributes over a union so each variant keeps its own fields. */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * A widget without an id or position — what the generator (and, later, the AI)
 * produces. The layout/materializer step adds id + x/y. Single source of truth
 * for the shape every AI path must emit.
 */
export type WidgetSpec = DistributiveOmit<Widget, "id" | "x" | "y">;
