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
import { curatePayload, customWidgetPayload, chatPayload, type ProxyOp } from "./geminiPayloads";

const rid = () => crypto.randomUUID();
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

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

// The Gemini request bodies live in geminiPayloads.ts, shared with the /api/ai
// proxy so the personal-key path (Google directly) and the shared-key path
// (through the proxy) send byte-identical requests — and the proxy never has to
// trust a client-built payload.

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  /** With a personal key we call Google directly (their key, their quota), with
   *  the full request body we built from the shared payload builders. */
  private callGoogle(payload: object, timeoutMs: number): Promise<Response> {
    return fetch(`${ENDPOINT}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Never hang forever: a stuck request would otherwise hold one of the
      // browser's ~6 per-host connections and quietly jam later calls.
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /** No personal key: go through Grove's own /api/ai, which holds the shared key
   *  server-side. We send only the OP and its args — never a Gemini body — so
   *  the proxy builds and bounds the payload itself. Requires a signed-in user. */
  private async callProxy(op: ProxyOp, timeoutMs: number): Promise<Response> {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("sign in to use AI");
    return fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: this.model, ...op }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  private async attempt(payload: object, op: ProxyOp, timeoutMs: number): Promise<unknown> {
    const res = this.apiKey ? await this.callGoogle(payload, timeoutMs) : await this.callProxy(op, timeoutMs);
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
  private async call(
    payload: object,
    op: ProxyOp,
    opts?: { timeoutMs?: number; retry?: boolean },
  ): Promise<unknown> {
    const timeoutMs = opts?.timeoutMs ?? (this.apiKey ? 20_000 : 25_000);
    try {
      return await this.attempt(payload, op, timeoutMs);
    } catch (e) {
      if (opts?.retry === false) throw e;
      const { status, code } = e as { status?: number; code?: string };
      // Our own 429 (daily cap) is permanent for today — retrying would just
      // spend another call and fail again. Google's 429 (rate/quota) is worth
      // one retry, which is why this gates on the code, not the status.
      const permanent = code === "ai_not_configured" || code === "rate_limited";
      const retryable = !permanent && (status === undefined || status === 429 || status >= 500);
      if (!retryable) throw e;
      await new Promise((r) => setTimeout(r, 600));
      return this.attempt(payload, op, timeoutMs);
    }
  }

  private static text(data: unknown): string {
    const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts;
    const text = parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("empty response");
    return text;
  }

  /** Parse the model's JSON reply. Tolerates ```json fences on either side AND
   *  a stray lone trailing fence the model sometimes appends (the old
   *  starts-with-``` check missed that and the whole chat turn failed) by
   *  slicing to the outermost {...}/[...] before parsing. */
  private static json<T>(data: unknown): T {
    const raw = GeminiProvider.text(data).trim();
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    const body = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    return JSON.parse(body) as T;
  }

  async generateCustomWidget(description: string, ctx: AIContext): Promise<WidgetSpec> {
    const data = await this.call(customWidgetPayload(description, ctx), { op: "custom", description, ctx });
    const spec = normalizeSpec(JSON.parse(GeminiProvider.text(data)));
    if (!spec) throw new Error("no widget returned");
    return spec;
  }

  async curateWorkspace(goal: string): Promise<CurationResult> {
    const data = await this.call(
      curatePayload(goal),
      { op: "curate", goal },
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
    const data = await this.call(chatPayload(history, ctx), { op: "chat", history, ctx });

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
