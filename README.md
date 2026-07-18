<p align="center">
  <img src="public/og.png" alt="Grove — grow your goals in a calm, personal space" width="720">
</p>

<p align="center">
  <b>A calm widget canvas for the things you're tending.</b><br>
  <a href="https://grove-red-sigma.vercel.app"><b>Try it →</b></a> &nbsp;·&nbsp; no signup needed
</p>

---

Most goal trackers are a to-do list with a streak bolted on. Grove gives each goal
its own quiet space instead: you tell it what you're working toward, and it lays
out the handful of trackers that actually fit — a streak for the thing you do
daily, a metric for the number that matters, a checklist only when there are real
steps to name. Then you arrange them however you like.

It's dark, unhurried, and deliberately small. No badges, no nagging, no feed.

<!-- A real screenshot of the canvas would sit well here:
     <p align="center"><img src="docs/screenshot.png" width="820"></p> -->

## What's in it

- **Eight widget types** — habit streaks, metrics (with a target and an optional
  daily/weekly/monthly reset), checklists, timers, counters, progress, notes, BMI.
- **A real canvas** — drag, resize, snap to neighbours. Phones get a stacked
  column instead, since free placement needs a pointer and room.
- **AI curation** — describe a goal, get a fitting set of widgets. Free, with no
  key of your own, once you have an account.
- **A companion** — a small chat that suggests widgets you might be missing.
- **Multi-device sync** with accounts and per-account profiles, or no account at
  all: guests keep everything in the browser and it follows them if they sign up.
- **Installable** to a home screen, with an integrated clock and alarm.

## How it works

The parts worth reading:

**The AI key never reaches the browser.** [`api/ai.ts`](api/ai.ts) is an edge
function holding `GEMINI_API_KEY` server-side — deliberately without a `VITE_`
prefix, since Vite inlines those straight into the public bundle. The client
sends a high-level op (`{op: "curate", goal}`), never a model request body, and
the proxy builds the payload itself from
[`src/geminiPayloads.ts`](src/geminiPayloads.ts) with every free-text field
clamped and output tokens capped. So a signed-in user can spend the shared key
on Grove's own three prompts and nothing else. Per-user daily limits live in
Postgres behind a `SECURITY DEFINER` function
([`supabase/ai_rate_limit.sql`](supabase/ai_rate_limit.sql)) whose table has RLS
on with zero policies — you can increment your own counter by asking for AI, but
you can't read, edit, or reset it.

**Sync tries hard not to clobber you.** Each workspace is one JSONB row. Writes
use optimistic concurrency: an update only lands if the row's `updated_at` still
matches what this client last saw. If it doesn't, the client *adopts* the cloud
copy rather than overwriting it. Syncs are serialized so two in-flight runs can't
race each other onto a stale base, and a tab-focus refetch
([`src/syncReconcile.ts`](src/syncReconcile.ts)) reconciles remote updates,
additions, and deletions — so a goal deleted on your phone stays deleted.

**AI output is data, never code.** Everything a model returns passes through
`specToWidget()`, which clamps each field to a known widget shape. No `eval`, no
`innerHTML`, no model text becoming markup.

**Curation is a selection problem, not a form.** An earlier version of the prompt
asked for "4 to 6 widgets" from a menu of shapes — which is a coverage quota, so
the model padded to hit it, and every goal came out the same skeleton with the
labels swapped. [`src/curationPrompt.ts`](src/curationPrompt.ts) now describes
each widget by what its view actually renders and treats the count as evidence
rather than a target. Measured against the live API over the same ten goals,
that took it from a fixed spine — a checklist *and* a sticky note in 100% of
them — to twelve distinct shapes, with notes down to 5%.

**Time is wall-clock.** Timers and the alarm fire off absolute timestamps rather
than counting interval ticks, so a throttled or sleeping tab can't quietly skip
them.

**It runs without a backend.** With no Supabase environment variables, Grove
works entirely against `localStorage` — which is also exactly what guest mode
uses.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

`.env.example` documents all three variables. Short version: the two `VITE_`
Supabase values are public client config (Row-Level Security is what protects
the data), and `GEMINI_API_KEY` is the only real secret — never give it a
`VITE_` prefix.

Leave the Supabase values blank and Grove runs local-only, no accounts.

For a cloud setup, run the files in [`supabase/`](supabase) once each in the
Supabase SQL editor — RLS policies, the profiles migration, and the AI rate
limit. They're idempotent, and each ends with verification queries. Run those
one at a time: the SQL editor only shows the result of the last statement.

Deploying is the same three variables in Vercel. Environment changes need a
redeploy to take effect.

| Script | |
|---|---|
| `npm run dev` | dev server, with `/api/ai` served locally |
| `npm run build` | typecheck + production build |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |

One trap worth knowing: `tsc --noEmit` is a **no-op** in this repo — the root
`tsconfig.json` is a solution file that only holds references, so it compiles
nothing and always passes. Use `npm run typecheck`.

## Layout

```
api/ai.ts            the AI proxy (holds the key, builds every payload)
src/
  App.tsx            state, sync, the composer→canvas flow
  components/        canvas, widgets, tab bar, companion, clock+alarm
  curationPrompt.ts  the shared curation prompt
  geminiPayloads.ts  every Gemini request body (client + proxy share it)
  syncReconcile.ts   tab-focus reconciliation
  generateWorkspace.ts  widget templates + specToWidget (the trust boundary)
supabase/            SQL to run once: RLS, profiles, AI rate limit
```

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · Supabase (auth + Postgres + RLS) ·
Google Gemini · deployed on Vercel.
