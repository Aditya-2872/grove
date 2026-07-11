// ---------------------------------------------------------------------------
// The swappable AI layer.
//
// Everything that "uses AI" goes through getAI() -> an AIProvider. Today the
// only provider is a smart, keyless MockProvider (offline heuristics). When the
// user adds a Claude API key (a later slice), getAI() will return a real
// provider with the SAME interface — nothing else in the app changes.
//
// A provider only ever returns a WidgetSpec (data). That spec is ALWAYS passed
// through specToWidget() (the clamping trust boundary in generateWorkspace.ts)
// before it reaches the canvas — AI text never becomes code or markup.
// ---------------------------------------------------------------------------

import type { WidgetSpec, Domain, ChatMessage, WidgetProposal } from "./types";
import { ClaudeProvider } from "./claudeProvider";
import { GeminiProvider } from "./geminiProvider";

export interface AIContext {
  goal: string;
  domain: Domain;
  existingTitles: string[];
}

export interface CurationTurn {
  text: string;
  proposals: WidgetProposal[];
}

/** A whole starting workspace, built by AI from the user's goal. */
export interface CurationResult {
  title: string;
  domain: Domain;
  widgets: WidgetSpec[];
}

export interface AIProvider {
  /** Turn a free-text description into a widget spec (data only). */
  generateCustomWidget(description: string, ctx: AIContext): Promise<WidgetSpec>;
  /** Continue the curation chat: given the conversation so far, return the next AI turn. */
  curationChat(history: ChatMessage[], ctx: AIContext): Promise<CurationTurn>;
  /** Build the INITIAL workspace for a goal (optional — mock uses templates instead). */
  curateWorkspace?(goal: string): Promise<CurationResult>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const rid = () => crypto.randomUUID();

function titleFromDescription(desc: string): string {
  const t = desc.trim().replace(/\s+/g, " ").replace(/^(a|an|my|the)\s+/i, "");
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return s.length > 32 ? s.slice(0, 32) + "…" : s;
}

// Map words in the description to a sensible unit for a metric.
const UNIT_HINTS: [RegExp, string][] = [
  [/hour|hrs?\b/, "hrs"],
  [/minute|mins?\b/, "min"],
  [/glass|cups?\b|water|drink/, "glasses"],
  [/steps?\b/, "steps"],
  [/pages?\b|read/, "pages"],
  [/books?\b/, "books"],
  [/words?\b|writ/, "words"],
  [/km|kilomet|miles?\b|run|walk/, "km"],
  [/reps?\b|push[- ]?ups?|sets?\b|workout/, "reps"],
  [/cal(orie)?s?\b/, "kcal"],
  [/\$|dollar|save|saving|money|budget|spend/, "$"],
  [/kg|pounds?\b|lbs?\b|weight/, "kg"],
  [/days?\b|streak/, "days"],
];

function guessMetric(desc: string): WidgetSpec {
  const d = desc.toLowerCase();
  const numMatch = d.match(/(\d[\d,]*\.?\d*)/);
  const target = numMatch ? Number(numMatch[1].replace(/,/g, "")) : undefined;
  let unit = "";
  for (const [re, u] of UNIT_HINTS) {
    if (re.test(d)) {
      unit = u;
      break;
    }
  }
  return { type: "metric", title: titleFromDescription(desc), value: 0, unit, target };
}

// --- curation ideas: things the mock proposes to round out a workspace ------

const ci = (text: string) => ({ id: rid(), text, done: false });

type Idea = { spec: WidgetSpec; rationale: string };

const CURATION_IDEAS: Record<Domain, Idea[]> = {
  fitness: [
    { spec: { type: "metric", title: "Sleep", value: 0, unit: "hrs", target: 8 }, rationale: "Recovery drives progress as much as training." },
    { spec: { type: "metric", title: "Body weight", value: 0, unit: "kg" }, rationale: "A weekly weigh-in shows the real trend." },
    { spec: { type: "metric", title: "Steps", value: 0, unit: "steps", target: 8000 }, rationale: "Movement outside the gym quietly adds up." },
    { spec: { type: "checklist", title: "Meal prep", items: [ci("Plan meals"), ci("Shop"), ci("Cook a batch")] }, rationale: "Prepping ahead is where most plans succeed." },
  ],
  study: [
    { spec: { type: "timer", title: "Pomodoro", durationSeconds: 25 * 60 }, rationale: "Short focused blocks beat long unfocused ones." },
    { spec: { type: "metric", title: "Practice questions", value: 0, unit: "", target: 20 }, rationale: "Active recall sticks; passive reading doesn't." },
    { spec: { type: "counter", title: "Revision streak", value: 0, unit: "days" }, rationale: "A visible streak is quietly motivating." },
  ],
  writing: [
    { spec: { type: "metric", title: "Words today", value: 0, unit: "words", target: 500 }, rationale: "A small daily count compounds fast." },
    { spec: { type: "counter", title: "Writing streak", value: 0, unit: "days" }, rationale: "Momentum matters more than mood." },
    { spec: { type: "checklist", title: "Outline", items: [ci("Beginning"), ci("Middle"), ci("End")] }, rationale: "An outline unblocks the blank page." },
  ],
  finance: [
    { spec: { type: "metric", title: "Savings", value: 0, unit: "$", target: 1000 }, rationale: "Name the number you're saving toward." },
    { spec: { type: "counter", title: "No-spend days", value: 0, unit: "days" }, rationale: "A gentle game that adds up." },
    { spec: { type: "checklist", title: "Cancel subscriptions", items: [ci("List them"), ci("Cancel the unused")] }, rationale: "Recurring charges are the quiet leak." },
  ],
  work: [
    { spec: { type: "metric", title: "Hours logged", value: 0, unit: "hrs" }, rationale: "Track time to protect it." },
    { spec: { type: "timer", title: "Deep work", durationSeconds: 50 * 60 }, rationale: "Guard one long focused block a day." },
    { spec: { type: "checklist", title: "Deliverables", items: [ci("Draft"), ci("Review"), ci("Ship")] }, rationale: "Make 'done' visible." },
  ],
  habit: [
    { spec: { type: "counter", title: "Current streak", value: 0, unit: "days" }, rationale: "The chain is its own reward." },
    { spec: { type: "timer", title: "Session", durationSeconds: 10 * 60 }, rationale: "Small and daily beats big and rare." },
    { spec: { type: "metric", title: "Weekly goal", value: 0, unit: "", target: 5 }, rationale: "Aim for a weekly count, not perfection." },
  ],
  general: [
    { spec: { type: "metric", title: "Progress", value: 0, unit: "", target: 100 }, rationale: "Pick one number that means progress." },
    { spec: { type: "counter", title: "Streak", value: 0, unit: "days" }, rationale: "Consistency you can see." },
    { spec: { type: "checklist", title: "Next moves", items: [ci("Get started"), ci("Keep going")] }, rationale: "Break it into first moves." },
  ],
};

function toProposal(idea: Idea): WidgetProposal {
  return { id: rid(), spec: idea.spec, rationale: idea.rationale, status: "pending" };
}

/**
 * The smart offline mock. Recognizes common shapes ("track a number", a
 * checklist, a timer, a note) and — crucially — defaults to a *metric*, not a
 * note box, so keyless custom widgets are genuinely useful.
 */
class MockProvider implements AIProvider {
  async generateCustomWidget(description: string): Promise<WidgetSpec> {
    await delay(450 + Math.random() * 350); // the "thinking" beat
    const d = description.toLowerCase();
    const title = titleFromDescription(description);

    if (/timer|pomodoro|focus session|countdown|stopwatch/.test(d)) {
      const m = d.match(/(\d+)\s*(?:m\b|min|minute)/);
      const mins = m ? Math.min(240, Math.max(1, Number(m[1]))) : 25;
      return { type: "timer", title, durationSeconds: mins * 60 };
    }
    if (/checklist|to-?do|tasks?\b|steps|routine|packing|grocery|shopping|list/.test(d)) {
      return {
        type: "checklist",
        title,
        items: [
          { id: rid(), text: "Get started", done: false },
          { id: rid(), text: "Keep going", done: false },
          { id: rid(), text: "Almost there", done: false },
        ],
      };
    }
    if (/\bnote\b|journal|idea|thought|remind|scratch/.test(d)) {
      return { type: "sticky_note", title, content: "", color: "#242c22" };
    }
    if (/progress|percent|completion|% done|how far/.test(d)) {
      return { type: "progress", title, value: 0 };
    }
    // Default: a number-toward-a-goal metric (the "not a note box" default).
    return guessMetric(description);
  }

  async curationChat(history: ChatMessage[], ctx: AIContext): Promise<CurationTurn> {
    await delay(600 + Math.random() * 400); // the "typing" beat
    const aiTurns = history.filter((m) => m.role === "ai").length;
    const taken = new Set<string>([
      ...ctx.existingTitles.map((t) => t.toLowerCase()),
      ...history.flatMap((m) => (m.proposals ?? []).map((p) => p.spec.title.toLowerCase())),
    ]);
    const pool = CURATION_IDEAS[ctx.domain] ?? CURATION_IDEAS.general;
    const fresh = pool.filter((i) => !taken.has(i.spec.title.toLowerCase()));

    if (aiTurns === 0) {
      return {
        text: "Lovely — this space is taking shape. Here are a few things that are easy to forget; add any that fit. And tell me: what matters most to you here?",
        proposals: fresh.slice(0, 3).map(toProposal),
      };
    }
    if (fresh.length > 0 && aiTurns < 3) {
      return { text: "Good — a couple more you might like:", proposals: fresh.slice(0, 2).map(toProposal) };
    }
    return {
      text: "You've got a calm, solid space now. Add anything else whenever you like with the + widget button.",
      proposals: [],
    };
  }
}

// --- settings: which provider + the user's own key + model -------------------

export type Provider = "gemini" | "anthropic";

export interface ProviderInfo {
  label: string;
  free: boolean;
  keyUrl: string;
  keyHint: string;
  models: { id: string; label: string; note: string }[];
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  gemini: {
    label: "Google Gemini",
    free: true,
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "Free — no credit card. Get a key in ~1 minute at aistudio.google.com.",
    // Rolling aliases: Google retires dated model ids for new accounts (we hit
    // this live with "gemini-2.5-flash"); *-latest always tracks the current one.
    models: [
      { id: "gemini-flash-lite-latest", label: "Gemini Flash Lite", note: "Fast & free — best fit" },
      { id: "gemini-flash-latest", label: "Gemini Flash", note: "Deeper, but slower" },
    ],
  },
  anthropic: {
    label: "Anthropic Claude",
    free: false,
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "Paid — needs billing set up at console.anthropic.com.",
    models: [
      { id: "claude-opus-4-8", label: "Opus 4.8", note: "Most capable" },
      { id: "claude-haiku-4-5", label: "Haiku 4.5", note: "Faster & cheaper" },
    ],
  },
};

export interface AISettings {
  provider: Provider;
  apiKey: string;
  model: string;
}

const SETTINGS_KEY = "aditya.ai.settings.v1";
const DEFAULT_SETTINGS: AISettings = { provider: "gemini", apiKey: "", model: "gemini-2.0-flash" };

export function loadSettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<AISettings>;
      const provider: Provider = s.provider === "anthropic" ? "anthropic" : "gemini";
      const models = PROVIDERS[provider].models;
      const model = typeof s.model === "string" && models.some((m) => m.id === s.model) ? s.model : models[0].id;
      return { provider, apiKey: typeof s.apiKey === "string" ? s.apiKey : "", model };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: AISettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function hasKey(): boolean {
  return loadSettings().apiKey.trim().length > 0;
}

// --- provider selection ------------------------------------------------------

let mockProvider: MockProvider | null = null;
let realCache: { key: string; provider: AIProvider } | null = null;

/**
 * The active provider: the user's real AI (Gemini or Claude) when a key is set,
 * otherwise the smart offline mock. Reads settings fresh each call, so entering
 * or clearing a key takes effect immediately.
 */
export function getAI(): AIProvider {
  const s = loadSettings();
  const key = s.apiKey.trim();
  if (key) {
    const cacheKey = `${s.provider}:${s.model}:${key}`;
    if (!realCache || realCache.key !== cacheKey) {
      const provider =
        s.provider === "anthropic" ? new ClaudeProvider(key, s.model) : new GeminiProvider(key, s.model);
      realCache = { key: cacheKey, provider };
    }
    return realCache.provider;
  }
  if (!mockProvider) mockProvider = new MockProvider();
  return mockProvider;
}

/** The offline mock, for graceful fallback when a real-AI call fails. */
export function getMock(): AIProvider {
  if (!mockProvider) mockProvider = new MockProvider();
  return mockProvider;
}
