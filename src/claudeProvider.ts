// ---------------------------------------------------------------------------
// The real Claude backend — used only when the user has entered their own key.
//
// Calls the Anthropic API directly from the browser via the official SDK, which
// is LAZY-imported so keyless users never download it. Output is STRUCTURED
// (strict tool use), so it arrives as a WidgetSpec; App still runs it through
// specToWidget() (the clamping trust boundary) before it reaches the canvas.
//
// SECURITY: a browser-held key is visible to the page (fine for personal dev,
// not a public launch). When the Supabase backend lands, move this call
// server-side so the key never reaches the browser.
//
// NOTE: this path is unverified in-app (it needs a real key to exercise). The
// keyless mock remains the default and is fully tested.
// ---------------------------------------------------------------------------

import type { WidgetSpec, ChatMessage, Domain } from "./types";
import type { AIProvider, AIContext, CurationTurn, CurationResult } from "./ai";
import { curationBody, ANALYSIS_DESC, SKIPPED_DESC } from "./curationPrompt";

const rid = () => crypto.randomUUID();

// A flat schema Claude fills; specToWidget() clamps/ignores the rest.
const WIDGET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    // habit and bmi were missing here, so this path could not emit two widget
    // types that already render — a streak had nowhere to go but a counter.
    type: {
      type: "string",
      enum: ["metric", "checklist", "counter", "timer", "progress", "sticky_note", "habit", "bmi"],
    },
    title: { type: "string", description: "Short title, ≤40 chars" },
    value: { type: "number", description: "starting value (metric/counter/progress)" },
    unit: { type: "string", description: "e.g. hrs, glasses, km, $ (metric only — a counter renders no unit)" },
    target: { type: "number", description: "the real finish line (metric only; omit for a level with no finish line)" },
    durationSeconds: { type: "number", description: "length in seconds (timer)" },
    content: { type: "string", description: "note body (sticky_note)" },
    heightCm: { type: "number", description: "height in cm (bmi)" },
    weightKg: { type: "number", description: "weight in kg (bmi)" },
    items: {
      type: "array",
      description: "rows (checklist)",
      items: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
    },
  },
  required: ["type", "title"],
};

const CURATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string", description: "Your brief, warm reply ending with ONE question." },
    proposals: {
      type: "array",
      description: "Up to 3 widgets the user probably hasn't added.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { rationale: { type: "string" }, widget: WIDGET_SCHEMA },
        required: ["rationale", "widget"],
      },
    },
  },
  required: ["message", "proposals"],
};

function contextLine(ctx: AIContext): string {
  return `Goal: "${ctx.goal}" (topic: ${ctx.domain}). Existing widgets: ${ctx.existingTitles.join(", ") || "none"}.`;
}

export class ClaudeProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async client() {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    return new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
  }

  async generateCustomWidget(description: string, ctx: AIContext): Promise<WidgetSpec> {
    const anthropic = await this.client();
    const msg = await anthropic.messages.create({
      model: this.model,
      max_tokens: 1024,
      tools: [
        {
          name: "create_widget",
          description: "Create the single most useful tracker widget for the request.",
          input_schema: WIDGET_SCHEMA,
          strict: true,
        } as never,
      ],
      tool_choice: { type: "tool", name: "create_widget" },
      messages: [
        {
          role: "user",
          content: `${contextLine(ctx)}\n\nBuild one widget for: "${description}". Prefer a metric (value/target/unit) for anything tracked as a number. Return only the tool call.`,
        },
      ],
    });
    if ((msg.stop_reason as string) === "refusal") throw new Error("request refused");
    const tool = msg.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("no widget returned");
    return tool.input as WidgetSpec;
  }

  async curateWorkspace(goal: string): Promise<CurationResult> {
    const anthropic = await this.client();
    const msg = await anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      tools: [
        {
          name: "create_workspace",
          description: "Create the initial tracking workspace for the user's goal.",
          // Field order matches the Gemini path and is deliberate: the
          // scratchpad fields come first so they constrain the widgets, and
          // `domain` comes LAST so the model isn't picking a stereotype before
          // it has chosen anything. (Property order is only a hint to a tool-use
          // model — weaker than Gemini's free-form ordering, but free.)
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              analysis: { type: "string", description: ANALYSIS_DESC },
              skipped: { type: "string", description: SKIPPED_DESC },
              widgets: { type: "array", items: WIDGET_SCHEMA },
              title: { type: "string", description: "Short tab title, ≤24 chars" },
              domain: { type: "string", enum: ["fitness", "study", "writing", "finance", "work", "habit", "general"] },
            },
            required: ["analysis", "skipped", "widgets", "title", "domain"],
          },
          strict: true,
        } as never,
      ],
      tool_choice: { type: "tool", name: "create_workspace" },
      messages: [{ role: "user", content: curationBody(goal) }],
    });
    if ((msg.stop_reason as string) === "refusal") throw new Error("request refused");
    const tool = msg.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("no workspace returned");
    // analysis/skipped are the model's scratchpad — they're separate keys, so
    // they can never reach specToWidget.
    return tool.input as { title: string; domain: Domain; widgets: WidgetSpec[] };
  }

  async curationChat(history: ChatMessage[], ctx: AIContext): Promise<CurationTurn> {
    const anthropic = await this.client();
    const convo = history.map((m) => ({
      role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
      content: m.text,
    }));
    const messages = convo.length === 0 ? [{ role: "user" as const, content: "Start the conversation." }] : convo;

    const msg = await anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: `You are a calm, warm companion helping curate a personal tracking workspace. ${contextLine(ctx)} Ask ONE short question at a time and propose up to 3 concrete widgets the user likely hasn't added (never duplicate an existing one). Keep replies brief and kind.`,
      tools: [
        { name: "respond", description: "Your chat reply plus any widget proposals.", input_schema: CURATION_SCHEMA, strict: true } as never,
      ],
      tool_choice: { type: "tool", name: "respond" },
      messages,
    });
    if ((msg.stop_reason as string) === "refusal") throw new Error("request refused");
    const tool = msg.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("no reply returned");
    const out = tool.input as { message: string; proposals?: { rationale: string; widget: WidgetSpec }[] };
    return {
      text: out.message,
      proposals: (out.proposals ?? []).map((p) => ({
        id: rid(),
        spec: p.widget,
        rationale: p.rationale,
        status: "pending" as const,
      })),
    };
  }
}
