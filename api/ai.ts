// ---------------------------------------------------------------------------
// Grove's AI proxy (a Vercel serverless function).
//
// The browser NEVER sees the Gemini key: it lives here as a server env var
// (GEMINI_API_KEY — deliberately no VITE_ prefix, so Vite can't inline it into
// the client bundle). Grove's frontend calls /api/ai instead of Google.
//
// The endpoint is not an open relay: every request must carry a valid Supabase
// access token, so only signed-in Grove users can spend the shared key.
// ---------------------------------------------------------------------------

export const config = { runtime: "edge" };

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
// Only models Grove actually offers — stops the endpoint being used as a
// general-purpose relay for arbitrary models.
const ALLOWED_MODELS = new Set(["gemini-flash-lite-latest", "gemini-flash-latest"]);
const DEFAULT_MODEL = "gemini-flash-lite-latest";

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  if (!key || !supabaseUrl || !supabaseAnon) {
    return json({ error: "AI isn't configured on the server yet." }, 503);
  }

  // --- gate: must be a signed-in Grove user ---
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to use AI." }, 401);
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!who || !who.ok) return json({ error: "Sign in to use AI." }, 401);

  // --- forward to Gemini ---
  let body: { model?: unknown; payload?: unknown };
  try {
    body = (await req.json()) as { model?: unknown; payload?: unknown };
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!body.payload || typeof body.payload !== "object") return json({ error: "Bad request" }, 400);
  const model = typeof body.model === "string" && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

  try {
    const upstream = await fetch(`${GEMINI}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.payload),
      signal: AbortSignal.timeout(25_000),
    });
    // Pass the response straight through (the key is never echoed back).
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return json({ error: "The AI took too long to answer." }, 504);
  }
}
