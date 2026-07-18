// ---------------------------------------------------------------------------
// Grove's AI proxy (a Vercel serverless function).
//
// The browser NEVER sees the Gemini key: it lives here as a server env var
// (GEMINI_API_KEY — deliberately no VITE_ prefix, so Vite can't inline it into
// the client bundle). Grove's frontend calls /api/ai instead of Google.
//
// The endpoint is not an open relay: every request carries a valid Supabase
// access token (only signed-in Grove users), AND — the important part — the
// client sends only a high-level op ({op:"curate", goal} etc.), never a Gemini
// request body. The proxy builds the payload itself from Grove's own prompts
// (payloadForOp), with every free-text field clamped and output tokens capped.
// So a signed-in user can spend the shared key ONLY on Grove's three prompts,
// not on arbitrary general-purpose inference.
// ---------------------------------------------------------------------------

import { payloadForOp } from "../src/geminiPayloads";

export const config = { runtime: "edge" };

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
// Only models Grove actually offers — stops the endpoint being used as a
// general-purpose relay for arbitrary models.
const ALLOWED_MODELS = new Set(["gemini-flash-lite-latest", "gemini-flash-latest"]);
const DEFAULT_MODEL = "gemini-flash-lite-latest";

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Calls per user per day on the shared key. Real use is ~10-30 in a heavy
 *  session, so a genuine user never meets this; a runaway one stops fast. */
const DAILY_LIMIT = 150;

/**
 * Count this call against the user's daily quota and report whether they're
 * still under it. The counter is a Postgres row reachable only through the
 * ai_rate_check() function, so nobody can reset their own.
 *
 * FAILS OPEN. This is a spend guard, not a security boundary (auth + the closed
 * relay are that) — a hiccup in the counter, or the SQL simply not having been
 * run yet, must never take AI down. That also lets this ship before the
 * migration: until ai_rate_check() exists the RPC 404s and everything behaves
 * exactly as before.
 */
export async function underDailyCap(supabaseUrl: string, anonKey: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/ai_rate_check`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_limit: DAILY_LIMIT }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return true; // not migrated yet / transient — fail open
    const out = await res.json();
    const row = Array.isArray(out) ? out[0] : out;
    // Only an explicit `false` blocks; anything unexpected fails open.
    return row?.allowed !== false;
  } catch {
    return true;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // GEMINI_API_KEY is the only real secret here. The Supabase URL/anon key are
  // public (they already ship in the browser bundle), so we just reuse the VITE_
  // ones rather than making the deployer enter them twice.
  const key = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!key || !supabaseUrl || !supabaseAnon) {
    // A machine-readable code: this 503 is PERMANENT until someone sets the env
    // var, unlike Google's transient "model is overloaded" 503. The client
    // retries one and not the other.
    return json({ error: "AI isn't configured on the server yet.", code: "ai_not_configured" }, 503);
  }

  // --- gate: must be a signed-in Grove user ---
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to use AI." }, 401);
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!who || !who.ok) return json({ error: "Sign in to use AI." }, 401);

  // --- build the payload OURSELVES from the op (never trust a client body) ---
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  // JSON.parse("null") / a non-object body would crash `body.op` below with an
  // unhandled 500 — reject it as a plain bad request instead.
  if (!body || typeof body !== "object") return json({ error: "Bad request" }, 400);
  const payload = payloadForOp(body.op, body);
  if (!payload) return json({ error: "Unknown operation." }, 400);
  const model = typeof body.model === "string" && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

  // --- per-user daily cap on the shared key (see supabase/ai_rate_limit.sql) ---
  // Counted only for calls we're actually about to make, so a bad request never
  // costs the user quota.
  if (!(await underDailyCap(supabaseUrl, supabaseAnon, token))) {
    return json(
      { error: "You've used today's AI. It resets tomorrow.", code: "rate_limited" },
      429,
    );
  }

  try {
    const upstream = await fetch(`${GEMINI}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });
    // Pass the response straight through (the key is never echoed back).
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return json({ error: "The AI took too long to answer.", code: "upstream_timeout" }, 504);
  }
}
