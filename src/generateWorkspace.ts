// ---------------------------------------------------------------------------
// Goal curation + widget metadata.
//
// curate() reads the intent of a goal and assembles the trackers someone would
// actually need. The detected domain is stored on the workspace so the "+ add"
// menu can suggest only widgets that fit (BMI in a fitness tab, not a reading
// one). Still a rule-based mock — swap detectDomain()/curate() for a real LLM
// call to generalize to any goal and to build genuinely custom widgets.
// ---------------------------------------------------------------------------

import type {
  Widget,
  Workspace,
  WidgetType,
  Domain,
  ChecklistItem,
  WidgetSpec,
} from "./types";
import { uid } from "./types";

const check = (text: string): ChecklistItem => ({ id: uid(), text, done: false });
/** A note must CARRY something. An empty one is padding — the thing that made
 *  every tab look identical. Same rule the AI curation prompt enforces. */
const note = (title: string, content: string): WidgetSpec => ({
  type: "sticky_note",
  title,
  content,
  color: "#242c22",
});

// --- widget sizes: deliberately varied so the canvas isn't a uniform grid ----
export const DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  sticky_note: { w: 240, h: 210 },
  checklist: { w: 252, h: 244 },
  counter: { w: 194, h: 150 },
  timer: { w: 208, h: 182 },
  progress: { w: 292, h: 150 },
  bmi: { w: 232, h: 204 },
  metric: { w: 214, h: 172 },
  habit: { w: 236, h: 196 },
};

export function sizeOf(w: Widget): { w: number; h: number } {
  const d = DEFAULT_SIZE[w.type];
  return { w: w.width ?? d.w, h: w.height ?? d.h };
}

/** Pack specs left-to-right, wrapping to new rows — accommodates varied sizes. */
function place(specs: WidgetSpec[]): Widget[] {
  const START_X = 40;
  const START_Y = 36;
  const MAX_ROW = 980;
  const GAP = 26;
  let x = START_X;
  let y = START_Y;
  let rowH = 0;

  return specs.map((spec) => {
    const { w, h } = DEFAULT_SIZE[spec.type];
    if (x !== START_X && x + w > START_X + MAX_ROW) {
      x = START_X;
      y += rowH + GAP;
      rowH = 0;
    }
    const placed = { ...spec, id: uid(), x, y } as Widget;
    x += w + GAP;
    rowH = Math.max(rowH, h);
    return placed;
  });
}

// --- domains: detection + tracker sets + contextual suggestions --------------

interface DomainDef {
  name: Domain;
  test: RegExp;
  widgets: () => WidgetSpec[];
  suggests: WidgetType[];
}

const DOMAINS: DomainDef[] = [
  {
    name: "fitness",
    test: /(shape|fit|fitness|gym|workout|exercise|weight|muscle|run|running|marathon|health|diet|nutrition|abs|strength|yoga|lose)/,
    suggests: ["habit", "bmi", "metric", "checklist", "counter", "timer", "progress", "sticky_note"],
    // A template can't know YOUR numbers, so it never invents one: where there's
    // no honest finish line, the metric ships without a target rather than
    // guessing. Counts differ per domain because the domains differ.
    widgets: () => [
      { type: "metric", title: "Workouts this week", value: 0, unit: "sessions", target: 4, period: "week" },
      { type: "metric", title: "Body weight", value: 0, unit: "kg" },
      { type: "metric", title: "Steps", value: 0, unit: "steps", target: 8000, period: "day" },
      { type: "checklist", title: "Getting set up", items: [check("Book a gym induction"), check("Buy shoes that fit"), check("Pick 3 days that are yours"), check("Take a starting photo")] },
    ],
  },
  {
    name: "study",
    test: /(study|exam|course|class|revision|learn|assignment|homework|quiz|semester|degree|certification|cfa|gre|sat|test)/,
    suggests: ["habit", "checklist", "timer", "progress", "counter", "sticky_note"],
    widgets: () => [
      { type: "habit", title: "Study something today" },
      { type: "timer", title: "Focus session", durationSeconds: 25 * 60 },
      { type: "metric", title: "Study hours", value: 0, unit: "hrs" },
      { type: "checklist", title: "Getting set up", items: [check("List every topic"), check("Find past papers"), check("Book the exam date"), check("Pick a fixed study slot")] },
    ],
  },
  {
    name: "writing",
    test: /(write|writing|novel|book|blog|essay|thesis|article|screenplay|story|content|journal)/,
    suggests: ["counter", "checklist", "progress", "timer", "sticky_note"],
    widgets: () => [
      { type: "metric", title: "Words today", value: 0, unit: "words", target: 500, period: "day" },
      { type: "metric", title: "Total words", value: 0, unit: "words" },
      { type: "habit", title: "Write every day" },
      note("Logline", "One sentence: who wants what, and what stands in the way?"),
    ],
  },
  {
    name: "finance",
    test: /(budget|save|saving|money|finance|financial|debt|invest|expense|spend)/,
    suggests: ["progress", "metric", "counter", "checklist", "sticky_note"],
    widgets: () => [
      { type: "metric", title: "Saved", value: 0, unit: "$" },
      { type: "metric", title: "Spent this month", value: 0, unit: "$", period: "month" },
      { type: "checklist", title: "Cut these costs", items: [check("Cancel unused subscriptions"), check("Switch to a cheaper phone plan"), check("Set up a payday transfer"), check("Sell what you don't use")] },
    ],
  },
  {
    name: "work",
    test: /(client|freelanc|project|consult|engagement|deliver|contract|invoice|launch|startup|business|work|ship)/,
    suggests: ["checklist", "counter", "progress", "timer", "sticky_note"],
    widgets: () => [
      { type: "checklist", title: "Deliverables", items: [check("Kickoff & brief agreed"), check("First draft"), check("Client review"), check("Revisions"), check("Handoff & invoice")] },
      { type: "metric", title: "Hours logged", value: 0, unit: "hrs" },
      { type: "timer", title: "Deep work", durationSeconds: 50 * 60 },
      note("Scope: what's not included", "Write it down now. Everything not on this list is a new quote."),
    ],
  },
  {
    name: "habit",
    test: /(habit|routine|meditat|mindful|read more|reading|sleep|wake|discipline|consistency|calm|stress)/,
    suggests: ["habit", "counter", "metric", "checklist", "timer", "progress", "sticky_note"],
    widgets: () => [
      { type: "habit", title: "Daily check-in" },
      { type: "timer", title: "Session", durationSeconds: 10 * 60 },
      { type: "checklist", title: "Make it easy", items: [check("Put it where you'll see it"), check("Pick the same time each day"), check("Decide the smallest version"), check("Tell someone")] },
    ],
  },
];

const GENERAL_SUGGESTS: WidgetType[] = ["habit", "checklist", "counter", "metric", "progress", "timer", "sticky_note"];

export function detectDomain(goal: string): Domain {
  const g = goal.toLowerCase();
  return DOMAINS.find((d) => d.test.test(g))?.name ?? "general";
}

/** Widget types worth suggesting for a given domain (contextual add menu). */
export function suggestedTypes(domain: Domain): WidgetType[] {
  return DOMAINS.find((d) => d.name === domain)?.suggests ?? GENERAL_SUGGESTS;
}

function curate(goal: string): Widget[] {
  const domain = DOMAINS.find((d) => d.test.test(goal.toLowerCase()));
  return place(
    domain
      ? domain.widgets()
      : [
          // The honest "we know nothing about this goal" case, and the one real
          // niche for progress: no unit to measure and no steps we can name.
          // A vague checklist ("Get started", "Build momentum") is worse than
          // no checklist — it's the padding that made every tab look the same.
          { type: "progress", title: "Progress", value: 0 },
          { type: "habit", title: "Work on it today" },
          note("What does done look like?", "Describe the finish line in one line. Then the trackers pick themselves."),
        ],
  );
}

function titleFromGoal(goal: string): string {
  const t = goal.trim().replace(/\s+/g, " ");
  const cleaned = t.replace(/^(i (want|wanna|need|would like) to|help me|let me|i'?m going to)\s+/i, "");
  const s = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return s.length > 26 ? s.slice(0, 26) + "…" : s;
}

export function createWorkspaceFromGoal(goal: string, themeIndex: number): Workspace {
  return {
    id: uid(),
    title: titleFromGoal(goal),
    goal,
    domain: detectDomain(goal),
    widgets: curate(goal),
    themeIndex,
    createdAt: Date.now(),
  };
}

export function createWidget(type: WidgetType, x: number, y: number): Widget {
  const base = { id: uid(), x, y };
  switch (type) {
    case "sticky_note":
      return { ...base, type, title: "Note", content: "", color: "#242c22" };
    case "checklist":
      return { ...base, type, title: "Checklist", items: [check("New item")] };
    case "counter":
      return { ...base, type, title: "Counter", value: 0 };
    case "timer":
      return { ...base, type, title: "Timer", durationSeconds: 25 * 60 };
    case "progress":
      return { ...base, type, title: "Progress", value: 0 };
    case "bmi":
      return { ...base, type, title: "BMI", heightCm: 170, weightKg: 70 };
    case "metric":
      return { ...base, type, title: "Metric", value: 0, unit: "", target: 10 };
    case "habit":
      return { ...base, type, title: "Daily habit", checkins: [] };
  }
}

// ---------------------------------------------------------------------------
// The trust boundary. Any WidgetSpec — including future AI output — becomes a
// real Widget ONLY through here, where every field is coerced and clamped. Only
// data reaches our fixed renderers; AI text can never become code or markup.
// ---------------------------------------------------------------------------

const clampStr = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : String(v ?? "")).slice(0, max);

const clampNum = (v: unknown, fallback: number, min = -1e9, max = 1e9): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
};

const optNum = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = (v: unknown): string =>
  typeof v === "string" && HEX.test(v) ? v : "#242c22";

export function specToWidget(spec: WidgetSpec, x: number, y: number): Widget {
  const base = { id: uid(), x, y, title: clampStr(spec.title, 40) || "Widget" };
  switch (spec.type) {
    case "sticky_note":
      return {
        ...base,
        type: "sticky_note",
        content: clampStr(spec.content, 2000),
        color: safeColor(spec.color),
        variant: spec.variant === "gradient" ? "gradient" : "plain",
      };
    case "checklist":
      return {
        ...base,
        type: "checklist",
        items: (Array.isArray(spec.items) ? spec.items : [])
          .slice(0, 20)
          .map((it) => ({
            id: uid(),
            text: clampStr((it as { text?: unknown })?.text, 120),
            done: !!(it as { done?: unknown })?.done,
          })),
      };
    case "counter":
      return {
        ...base,
        type: "counter",
        value: clampNum(spec.value, 0),
        unit: spec.unit ? clampStr(spec.unit, 12) : undefined,
        target: optNum(spec.target),
      };
    case "timer":
      return { ...base, type: "timer", durationSeconds: clampNum(spec.durationSeconds, 25 * 60, 60, 240 * 60) };
    case "progress":
      return { ...base, type: "progress", value: clampNum(spec.value, 0, 0, 100) };
    case "bmi":
      return { ...base, type: "bmi", heightCm: clampNum(spec.heightCm, 170, 50, 300), weightKg: clampNum(spec.weightKg, 70, 20, 500) };
    case "metric":
      return {
        ...base,
        type: "metric",
        value: clampNum(spec.value, 0),
        unit: spec.unit ? clampStr(spec.unit, 12) : undefined,
        target: optNum(spec.target),
        direction: spec.direction === "down" ? "down" : "up",
        // Anything the AI sends that isn't one of these three is dropped to
        // undefined = accumulates forever, which is the safe reading.
        period:
          spec.period === "day" || spec.period === "week" || spec.period === "month" ? spec.period : undefined,
      };
    case "habit":
      return {
        ...base,
        type: "habit",
        checkins: (Array.isArray(spec.checkins) ? spec.checkins : [])
          .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
          .slice(0, 3660),
      };
    default:
      // Unknown/garbage type at runtime -> safe fallback.
      return { ...base, type: "sticky_note", content: "", color: "#242c22" };
  }
}

/**
 * Re-pack every widget into a tidy, gap-free shelf layout (left-to-right,
 * wrapping to new rows), preserving order and respecting each widget's size.
 * Called after add/delete so the canvas never overlaps or leaves holes.
 */
export function reflow(widgets: Widget[]): Widget[] {
  const START_X = 40;
  const START_Y = 36;
  const MAX_ROW = 980;
  const GAP = 26;
  let x = START_X;
  let y = START_Y;
  let rowH = 0;

  return widgets.map((widget) => {
    const { w, h } = sizeOf(widget);
    if (x !== START_X && x + w > START_X + MAX_ROW) {
      x = START_X;
      y += rowH + GAP;
      rowH = 0;
    }
    const placed = { ...widget, x, y } as Widget;
    x += w + GAP;
    rowH = Math.max(rowH, h);
    return placed;
  });
}

/**
 * Build a widget from a free-text description. For now a keyword heuristic picks
 * the closest widget type and names it after the description. This is the exact
 * seam a real LLM slots into to build genuinely bespoke widgets.
 */
export function createCustomWidget(description: string, x: number, y: number): Widget {
  const d = description.toLowerCase();
  let type: WidgetType = "sticky_note";
  if (/\b(bmi|body mass)\b/.test(d)) type = "bmi";
  else if (/timer|pomodoro|minutes|session|focus|countdown/.test(d)) type = "timer";
  else if (/list|checklist|tasks?|steps|todo|to-do|habits|routine/.test(d)) type = "checklist";
  else if (/progress|percent|completion|toward|goal bar/.test(d)) type = "progress";
  else if (/count|counter|streak|reps|glasses|days|tally|number/.test(d)) type = "counter";

  const clean = description.trim().replace(/\s+/g, " ");
  const title = (clean.charAt(0).toUpperCase() + clean.slice(1)).slice(0, 30);
  return { ...createWidget(type, x, y), title };
}
