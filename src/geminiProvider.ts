// ---------------------------------------------------------------------------
// The free Google Gemini backend — used when the user pastes a (free) Gemini
// key. Calls the REST API directly with fetch (no SDK, browser-friendly, CORS-
// enabled). Output is structured JSON via responseSchema, then App runs it
// through specToWidget() (the clamping trust boundary) before the canvas.
//
// SECURITY: the key sits in the browser (fine for a personal free-tier key,
// not a public launch). Later it can move into a Supabase Edge Function.
// The keyless mock stays the default; this path needs a key to exercise.
// ---------------------------------------------------------------------------

import type { WidgetSpec, ChatMessage, Domain } from "./types";
import type { AIProvider, AIContext, CurationTurn, CurationResult } from "./ai";
import { supabase } from "./supabase";
import { curationBody, WIDGET_SHAPES, ANALYSIS_DESC, SKIPPED_DESC } from "./curationPrompt";

const rid = () => crypto.randomUUID();
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini responseSchema uses an OpenAPI subset (UPPERCASE types).
const WIDGET_SCHEMA = {
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

/** Normalize the wire shape (checklist rows arrive as strings) into WidgetSpec.
 *  Returns null for junk: callers filter PER WIDGET, so one bad element can
 *  never throw away a whole good curation. */
function normalizeSpec(raw: unknown): WidgetSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const spec = raw as WidgetSpec & { items?: unknown[] };
  if (typeof (spec as { type?: unknown }).type !== "string") return null;
  if (spec.type === "checklist" && Array.isArray(spec.items)) {
    spec.items = spec.items.map((it) =>
      typeof it === "string"
        ? { id: rid(), text: it, done: false }
        : { id: rid(), text: String((it as { text?: unknown })?.text ?? ""), done: false },
    ) as never;
  }
  return spec as WidgetSpec;
}

// The complex calls (curate a whole workspace, propose several widgets in chat)
// describe their JSON shape in the PROMPT rather than via responseSchema. A
// deeply-nested responseSchema (array-of-objects-containing-arrays) wedges the
// model's constrained decoding and hangs for 30s+ on the free flash-lite model
// — observed live. Free-form JSON (responseMimeType only) generates in ~2-3s,
// and specToWidget() still clamps every field, so nothing untrusted gets through.
// The prompt itself lives in curationPrompt.ts, shared with the Claude path.
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

const chatSystem = (ctx: AIContext) =>
  `You are a calm, warm companion helping curate a personal tracking workspace. ${contextLine(ctx)} ` +
  `Ask ONE short question at a time and propose up to 3 concrete widgets the user likely hasn't added (never duplicate an existing one). Keep replies brief and kind.\n\n` +
  `Reply with ONLY a JSON object (no markdown fences) of this shape:\n` +
  `{ "message": "your brief warm reply, ending with ONE question", "proposals": [ { "rationale": "one short line on why", "widget": <a widget> } ] }\n\n` +
  WIDGET_SHAPES +
  `\n\nSame rule: checklist items must be real, specific names — never "Item 1" / "First step".`;

function contextLine(ctx: AIContext): string {
  return `Goal: "${ctx.goal}" (topic: ${ctx.domain}). Existing widgets: ${ctx.existingTitles.join(", ") || "none"}.`;
}

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  /** With a personal key we call Google directly (their key, their quota). */
  private callGoogle(body: object, timeoutMs: number): Promise<Response> {
    return fetch(`${ENDPOINT}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Never hang forever: a stuck request would otherwise hold one of the
      // browser's ~6 per-host connections and quietly jam later calls.
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /** No personal key: go through Grove's own /api/ai, which holds the shared
   *  key server-side. Requires a signed-in user (the proxy enforces it too). */
  private async callProxy(body: object, timeoutMs: number): Promise<Response> {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("sign in to use AI");
    return fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: this.model, payload: body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  private async attempt(body: object, timeoutMs: number): Promise<unknown> {
    const res = this.apiKey ? await this.callGoogle(body, timeoutMs) : await this.callProxy(body, timeoutMs);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // Grove's own proxy sets a STRING `code` at the top level. Google's
      // passthrough body has error.code as a NUMBER — accept only a string, or a
      // Google 503 would set code = 503 and defeat the point of the check.
      let code: string | undefined;
      try {
        const parsed = JSON.parse(detail) as { code?: unknown };
        if (typeof parsed.code === "string") code = parsed.code;
      } catch {
        /* not JSON */
      }
      const err = new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`) as Error & {
        status?: number;
        code?: string;
      };
      err.status = res.status;
      err.code = code;
      throw err;
    }
    return res.json();
  }

  // One retry on TRANSIENT failure (timeout, network, rate-limit, 5xx). A bad
  // key or malformed request (400/401/403) won't improve on retry, so fail fast.
  // Neither will a missing server key — but that returns 503, and Google ALSO
  // returns a genuine transient 503 ("model is overloaded"), so gate on our
  // proxy's own string code rather than on the status alone.
  private async call(body: object, opts?: { timeoutMs?: number; retry?: boolean }): Promise<unknown> {
    const timeoutMs = opts?.timeoutMs ?? (this.apiKey ? 20_000 : 25_000);
    try {
      return await this.attempt(body, timeoutMs);
    } catch (e) {
      if (opts?.retry === false) throw e;
      const { status, code } = e as { status?: number; code?: string };
      const permanent = code === "ai_not_configured";
      const retryable = !permanent && (status === undefined || status === 429 || status >= 500);
      if (!retryable) throw e;
      await new Promise((r) => setTimeout(r, 600));
      return this.attempt(body, timeoutMs);
    }
  }

  private static text(data: unknown): string {
    const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts;
    const text = parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("empty response");
    return text;
  }

  /** Parse the model's JSON reply, tolerating stray ```json fences. */
  private static json<T>(data: unknown): T {
    let t = GeminiProvider.text(data).trim();
    if (t.startsWith("```")) t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(t) as T;
  }

  async generateCustomWidget(description: string, ctx: AIContext): Promise<WidgetSpec> {
    const data = await this.call({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${contextLine(ctx)}\n\nBuild one tracker widget for: "${description}". Prefer a metric (value/target/unit) for anything tracked as a number. IMPORTANT: when the description implies a quantity or goal, you MUST fill "unit" (e.g. chapters, hrs, glasses, km) and "target" (the number to reach) — e.g. "read 14 chapters" → unit "chapters", target 14. Start "value" at 0 unless told otherwise.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: WIDGET_SCHEMA,
        // Gemini 3.x models "think" before answering; with a JSON schema that
        // can run 30s+. LOW keeps a touch of reasoning at ~1s latency.
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    });
    const spec = normalizeSpec(JSON.parse(GeminiProvider.text(data)));
    if (!spec) throw new Error("no widget returned");
    return spec;
  }

  async curateWorkspace(goal: string): Promise<CurationResult> {
    const data = await this.call(
      {
        contents: [{ role: "user", parts: [{ text: curatePrompt(goal) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          // No responseSchema on purpose — see WIDGET_SHAPES note. thinkingLevel
          // LOW keeps a touch of reasoning (subject knowledge) at ~2-3s latency.
          thinkingConfig: { thinkingLevel: "LOW" },
          // Pinned, not incidental: at temperature 0 this returns byte-identical
          // widget sets across goals — the exact sameness this prompt exists to
          // fix — and high values degenerate to metric+metric+metric.
          temperature: 1.0,
        },
      },
      // This call blocks the Begin button, so budget it hard and don't retry:
      // a retry can't finish inside the budget, and the old 25s + 600ms + 25s
      // path could block Begin for ~50s before silently revealing a template.
      { timeoutMs: 9_000, retry: false },
    );
    // "analysis" and "skipped" are the model's scratchpad — read and discarded.
    // They're separate JSON keys, so they can never reach specToWidget.
    const out = GeminiProvider.json<{
      analysis?: string;
      skipped?: string;
      title: string;
      domain: Domain;
      widgets: unknown[];
    }>(data);
    if (import.meta.env.DEV) console.debug("[curate]", { analysis: out.analysis, skipped: out.skipped });
    return {
      title: out.title,
      domain: out.domain,
      widgets: (Array.isArray(out.widgets) ? out.widgets : []).flatMap((w) => {
        const spec = normalizeSpec(w);
        return spec ? [spec] : [];
      }),
    };
  }

  async curationChat(history: ChatMessage[], ctx: AIContext): Promise<CurationTurn> {
    const contents =
      history.length > 0
        ? history.map((m) => ({ role: m.role === "ai" ? "model" : "user", parts: [{ text: m.text }] }))
        : [{ role: "user", parts: [{ text: "Start the conversation." }] }];

    const data = await this.call({
      systemInstruction: { parts: [{ text: chatSystem(ctx) }] },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    });

    const out = GeminiProvider.json<{
      message: string;
      proposals?: { rationale: string; widget: WidgetSpec }[];
    }>(data);
    return {
      text: out.message,
      proposals: (out.proposals ?? []).flatMap((p) => {
        const spec = normalizeSpec(p.widget);
        return spec ? [{ id: rid(), spec, rationale: p.rationale, status: "pending" as const }] : [];
      }),
    };
  }
}
