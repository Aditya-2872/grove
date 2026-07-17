// ---------------------------------------------------------------------------
// The ONE place a Gemini request body is built — shared by the browser provider
// (personal-key path, calling Google directly) and the /api/ai edge proxy
// (shared-key path). Because both construct the payload from the SAME builders,
// the two paths are byte-identical, and the proxy never has to trust a
// client-supplied payload: the client sends only {op, goal/description/ctx/
// history}, and the server builds the rest here.
//
// SECURITY: this file is what stops /api/ai being a general-purpose Gemini
// relay. Every free-text field is clamped, the model config is fixed per op,
// and maxOutputTokens is capped, so a signed-in user can spend the shared key
// ONLY on Grove's own three prompts, at bounded size.
//
// Must stay dependency-free (no browser/node globals) so the edge runtime can
// import it — only pure string building + type-only imports.
// ---------------------------------------------------------------------------

import type { AIContext } from "./ai";
import type { ChatMessage, Domain } from "./types";
import { curationBody, WIDGET_SHAPES, ANALYSIS_DESC, SKIPPED_DESC } from "./curationPrompt";

// --- input bounds (all server-enforced on the proxy path) --------------------
const MAX_GOAL = 200;
const MAX_DESC = 200;
const MAX_TITLE = 60;
const MAX_TITLES = 30;
// Kept tight, not generous: the client controls the chat `contents` (and even
// each turn's role), so this array is the one place a signed-in user gets
// free-text inference on the shared key. These bounds are the real curation-chat
// UX need (a short back-and-forth), which shrinks that surface. Total volume
// still wants a per-user rate limit at the edge (needs a shared KV store).
const MAX_HISTORY = 16; // chat messages kept (most recent)
const MAX_MSG = 600; // chars per chat message

const DOMAINS: Domain[] = ["fitness", "study", "writing", "finance", "work", "habit", "general"];

/** Clamp any value to a bounded string (non-strings become ""). */
export function clampStr(s: unknown, max: number): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

/** Coerce untrusted context (goal/domain/existing titles) into a safe AIContext. */
export function sanitizeCtx(raw: unknown): AIContext {
  const c = (raw ?? {}) as Partial<AIContext>;
  const domain = (DOMAINS as string[]).includes(c.domain as string) ? (c.domain as Domain) : "general";
  const existingTitles = Array.isArray(c.existingTitles)
    ? c.existingTitles.slice(0, MAX_TITLES).map((t) => clampStr(t, MAX_TITLE)).filter(Boolean)
    : [];
  return { goal: clampStr(c.goal, MAX_GOAL), domain, existingTitles };
}

// --- Gemini responseSchema (OpenAPI subset, UPPERCASE types) -----------------
export const WIDGET_SCHEMA = {
  type: "OBJECT",
  properties: {
    type: {
      type: "STRING",
      enum: ["metric", "checklist", "counter", "timer", "progress", "sticky_note", "habit", "bmi"],
    },
    title: { type: "STRING", description: "Short title, ≤40 chars" },
    value: { type: "NUMBER", description: "starting value (metric/counter/progress)" },
    unit: { type: "STRING", description: "e.g. hrs, glasses, km, $ (metric only — a counter renders no unit)" },
    target: { type: "NUMBER", description: "the real finish line (metric only; omit for a level with no finish line)" },
    period: {
      type: "STRING",
      enum: ["day", "week", "month"],
      description: "metric only: the value starts over each period. Omit for a total that accumulates.",
    },
    durationSeconds: { type: "NUMBER", description: "length in seconds (timer)" },
    content: { type: "STRING", description: "note body (sticky_note)" },
    heightCm: { type: "NUMBER", description: "height in cm (bmi)" },
    weightKg: { type: "NUMBER", description: "weight in kg (bmi)" },
    // Plain strings, not nested objects: deeply-nested schemas can wedge the
    // model's constrained decoding (observed live: nested items -> 30s+ hangs).
    items: { type: "ARRAY", description: "row labels (checklist)", items: { type: "STRING" } },
  },
  required: ["type", "title"],
};

// --- prompts -----------------------------------------------------------------
function contextLine(ctx: AIContext): string {
  return `Goal: "${ctx.goal}" (topic: ${ctx.domain}). Existing widgets: ${ctx.existingTitles.join(", ") || "none"}.`;
}

const curatePrompt = (goal: string) =>
  curationBody(goal) +
  `\n\nReturn ONLY a JSON object (no markdown fences, no prose outside it), with the fields in EXACTLY this order:\n` +
  `{\n` +
  `  "analysis": "${ANALYSIS_DESC}",\n` +
  `  "skipped": "${SKIPPED_DESC}",\n` +
  `  "widgets": [ the widgets — as many as the goal contains, no more ],\n` +
  `  "title": "short tab title, 24 chars max",\n` +
  `  "domain": one of "fitness"|"study"|"writing"|"finance"|"work"|"habit"|"general"\n` +
  `}`;

const customWidgetPrompt = (description: string, ctx: AIContext) =>
  `${contextLine(ctx)}\n\nBuild one tracker widget for: "${description}". Prefer a metric (value/target/unit) for anything tracked as a number. IMPORTANT: when the description implies a quantity or goal, you MUST fill "unit" (e.g. chapters, hrs, glasses, km) and "target" (the number to reach) — e.g. "read 14 chapters" → unit "chapters", target 14. Start "value" at 0 unless told otherwise.`;

const chatSystem = (ctx: AIContext) =>
  `You are a calm, warm companion helping curate a personal tracking workspace. ${contextLine(ctx)} ` +
  `Ask ONE short question at a time and propose up to 3 concrete widgets the user likely hasn't added (never duplicate an existing one). Keep replies brief and kind.\n\n` +
  `Reply with ONLY a JSON object (no markdown fences) of this shape:\n` +
  `{ "message": "your brief warm reply, ending with ONE question", "proposals": [ { "rationale": "one short line on why", "widget": <a widget> } ] }\n\n` +
  WIDGET_SHAPES +
  `\n\nSame rule: checklist items must be real, specific names — never "Item 1" / "First step".`;

// --- payload builders (each clamps its own inputs) ---------------------------
export function curatePayload(goal: string) {
  return {
    contents: [{ role: "user", parts: [{ text: curatePrompt(clampStr(goal, MAX_GOAL)) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      // No responseSchema on purpose — a nested schema wedges flash-lite.
      thinkingConfig: { thinkingLevel: "LOW" },
      // Pinned: at temp 0 curation returns byte-identical sets across goals.
      temperature: 1.0,
      // A hard ceiling to bound abuse of the shared key — NOT a tight fit:
      // thinkingLevel LOW spends "thinking" tokens that count against this, so
      // too low truncates real output mid-JSON (observed live). Generous enough
      // to never clip a legit answer, far below general-purpose-essay territory.
      maxOutputTokens: 6144,
    },
  };
}

export function customWidgetPayload(description: string, ctx: AIContext) {
  return {
    contents: [{ role: "user", parts: [{ text: customWidgetPrompt(clampStr(description, MAX_DESC), sanitizeCtx(ctx)) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: WIDGET_SCHEMA,
      thinkingConfig: { thinkingLevel: "LOW" },
      // See curate's note — 1024 truncated a one-widget reply because thinking
      // ate the budget. 3072 leaves ample room for output above the thinking.
      maxOutputTokens: 3072,
    },
  };
}

export function chatPayload(history: ChatMessage[], ctx: AIContext) {
  const trimmed = (Array.isArray(history) ? history : [])
    // Drop non-object elements first — a null slips a `null.role` TypeError into
    // the edge function (an easy way for a client to force a 500).
    .filter((m): m is ChatMessage => !!m && typeof m === "object")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role === "ai" ? "model" : "user", parts: [{ text: clampStr(m.text, MAX_MSG) }] }));
  const contents = trimmed.length ? trimmed : [{ role: "user", parts: [{ text: "Start the conversation." }] }];
  return {
    systemInstruction: { parts: [{ text: chatSystem(sanitizeCtx(ctx)) }] },
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "LOW" },
      maxOutputTokens: 2048,
    },
  };
}

// --- the wire message the client sends the proxy (never a raw Gemini body) ---
export type ProxyOp =
  | { op: "curate"; goal: string }
  | { op: "custom"; description: string; ctx: AIContext }
  | { op: "chat"; history: ChatMessage[]; ctx: AIContext };

/** Build the Gemini payload for a proxy op. Returns null for an unknown op so
 *  the proxy answers 400 rather than forwarding anything. */
export function payloadForOp(op: unknown, body: Record<string, unknown>): object | null {
  switch (op) {
    case "curate":
      return curatePayload(clampStr(body.goal, MAX_GOAL));
    case "custom":
      return customWidgetPayload(clampStr(body.description, MAX_DESC), sanitizeCtx(body.ctx));
    case "chat":
      return chatPayload(Array.isArray(body.history) ? (body.history as ChatMessage[]) : [], sanitizeCtx(body.ctx));
    default:
      return null;
  }
}
