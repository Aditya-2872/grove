import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Serve /api/ai during `npm run dev`.
 *
 * Vite's dev server doesn't run serverless functions, so without this the AI
 * proxy would only exist on Vercel and local dev would silently fall back to
 * the offline mock. This reuses the SAME handler as production (api/ai.ts),
 * bridging Node's req/res to the Web Request/Response it expects — so there's
 * one implementation, not a dev copy that can drift.
 */
function devApi(): Plugin {
  return {
    name: 'grove-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        try {
          const mod = (await server.ssrLoadModule('/api/ai.ts')) as {
            default: (r: Request) => Promise<Response>
          }

          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const body = Buffer.concat(chunks)

          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v)
            else if (Array.isArray(v)) headers.set(k, v.join(', '))
          }

          const response = await mod.default(
            new Request('http://localhost/api/ai', {
              method: req.method ?? 'POST',
              headers,
              body: body.length ? body : undefined,
            }),
          )

          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `dev /api/ai failed: ${String(e).slice(0, 200)}` }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load every var (the '' prefix includes un-prefixed ones) so the dev proxy
  // can read the SERVER-side secrets. These have no VITE_ prefix, so Vite never
  // inlines them into the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!process.env.SUPABASE_URL && url) process.env.SUPABASE_URL = url
  if (!process.env.SUPABASE_ANON_KEY && anon) process.env.SUPABASE_ANON_KEY = anon

  return {
    plugins: [react(), tailwindcss(), devApi()],
    server: {
      port: Number(process.env.PORT) || 5173,
    },
  }
})
