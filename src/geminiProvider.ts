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

const rid = () => crypto.randomUUID();
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini responseSchema uses an OpenAPI subset (UPPERCASE types).
const WIDGET_SCHEMA = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["metric", "checklist", "counter", "timer", "progress", "sticky_note", "habit"] },
    title: { type: "STRING", description: "Short title, ≤40 chars" },
    value: { type: "NUMBER", description: "starting value (metric/counter/progress)" },
    unit: { type: "STRING", description: "e.g. hrs, glasses, km, $ (metric/counter)" },
    target: { type: "NUMBER", description: "goal (metric/counter)" },
    durationSeconds: { type: "NUMBER", description: "length in seconds (timer)" },
    content: { type: "STRING", description: "note body (sticky_note)" },
    // Plain strings, not nested objects: deeply-nested schemas can wedge the
    // model's constrained decoding (observed live: nested items -> 30s+ hangs).
    items: { type: "ARRAY", description: "row labels (checklist)", items: { type: "STRING" } },
  },
  required: ["type", "title"],
};

/** Normalize the wire shape (checklist rows arrive as strings) into WidgetSpec. */
function normalizeSpec(raw: unknown): WidgetSpec {
  const spec = raw as WidgetSpec & { items?: unknown[] };
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
const WIDGET_SHAPES =
  `Each widget is ONE of these JSON shapes:\n` +
  `{"type":"metric","title":"…","value":0,"unit":"chapters","target":14}   // a number tracked toward a goal — PREFER this for anything countable\n` +
  `{"type":"counter","title":"…","value":0,"unit":"days"}                   // a simple tally or streak\n` +
  `{"type":"checklist","title":"…","items":["Real name 1","Real name 2"]}   // items MUST be real, specific names — never "Item 1"\n` +
  `{"type":"timer","title":"…","durationSeconds":1500}                      // a focus / session timer\n` +
  `{"type":"progress","title":"…","value":0}                                // 0–100 percent progress\n` +
  `{"type":"habit","title":"…"}                                             // a daily check-in streak — use for anything done EVERY day\n` +
  `{"type":"sticky_note","title":"…","content":"…"}                         // only if it carries real content (a quote, a tip)`;

const curatePrompt = (goal: string) =>
  `You are curating the INITIAL tracking workspace for this goal:\n"${goal}"\n\n` +
  `Return ONLY a JSON object (no markdown fences, no prose) of exactly this shape:\n` +
  `{\n  "title": "short tab title, 24 chars max",\n  "domain": one of "fitness"|"study"|"writing"|"finance"|"work"|"habit"|"general",\n  "widgets": [ 4 to 6 widgets ]\n}\n\n` +
  WIDGET_SHAPES +
  `\n\nRules:\n` +
  `- Use your REAL knowledge of the subject. Reading a specific book → its ACTUAL chapter/section names. Training → real exercise names. A course/exam → real module or topic names.\n` +
  `- NEVER generic placeholders ("Topic 1", "First step", "Item 1", "Chapter 1"). If you don't know real names, use a metric or counter instead of a vague checklist.\n` +
  `- Prefer metrics (with unit and target) whenever a number is tracked toward a goal.\n` +
  `- At most one sticky_note, and only with real, specific content.`;

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

  private async attempt(body: object): Promise<unknown> {
    const res = await fetch(`${ENDPOINT}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Never hang forever: a stuck request would otherwise hold one of the
      // browser's ~6 per-host connections and quietly jam later calls.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const err = new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // One retry on transient failure (timeout, network, rate-limit, 5xx). A bad
  // key or malformed request (400/401/403) won't improve on retry, so fail fast.
  private async call(body: object): Promise<unknown> {
    try {
      return await this.attempt(body);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable) throw e;
      await new Promise((r) => setTimeout(r, 600));
      return this.attempt(body);
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
    return normalizeSpec(JSON.parse(GeminiProvider.text(data)));
  }

  async curateWorkspace(goal: string): Promise<CurationResult> {
    const data = await this.call({
      contents: [{ role: "user", parts: [{ text: curatePrompt(goal) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        // No responseSchema on purpose — see WIDGET_SHAPES note. thinkingLevel
        // LOW keeps a touch of reasoning (subject knowledge) at ~2-3s latency.
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    });
    const out = GeminiProvider.json<{ title: string; domain: Domain; widgets: unknown[] }>(data);
    return {
      title: out.title,
      domain: out.domain,
      widgets: (out.widgets ?? []).map(normalizeSpec),
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
      proposals: (out.proposals ?? []).map((p) => ({
        id: rid(),
        spec: normalizeSpec(p.widget),
        rationale: p.rationale,
        status: "pending" as const,
      })),
    };
  }
}
