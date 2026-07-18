-- ---------------------------------------------------------------------------
-- Per-user daily cap for Grove's shared AI (/api/ai).
--
-- The proxy holds ONE Gemini key shared by every signed-in user. Per-call cost
-- is already bounded (fixed prompts, clamped inputs, capped output tokens), but
-- nothing bounded the TOTAL — a signed-in account could loop the endpoint.
-- This is that bound.
--
-- Shape: one row per user per day, so the table stays tiny (no cleanup job).
-- The counter is only reachable through ai_rate_check(), which runs as the
-- function owner. The table itself has RLS on with NO policies and no grants,
-- so a user's token can't read, reset, or delete their own usage — they can
-- only increment it by asking for AI.
--
-- Idempotent: safe to run more than once.
-- Run in: Supabase dashboard -> SQL Editor -> Run.
-- ---------------------------------------------------------------------------

-- 1) the counter -------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  calls integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- No policies on purpose: RLS-on + zero policies denies ALL direct access via
-- PostgREST. Revoke the default grants too, so the only way in is the function.
revoke all on table public.ai_usage from anon, authenticated;

-- 2) the gate ----------------------------------------------------------------
-- Atomically counts this call and reports whether the user is still under the
-- cap. SECURITY DEFINER so it can write past RLS; auth.uid() means a caller can
-- only ever touch their OWN row, so it can't be used to affect anyone else.
-- search_path is emptied (Supabase's hardening guidance) — everything below is
-- fully qualified.
create or replace function public.ai_rate_check(p_limit integer)
returns table (allowed boolean, used integer, limit_per_day integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  -- No JWT => not a signed-in user. The proxy already rejects these, but never
  -- hand back an "allowed" for an anonymous caller.
  if uid is null then
    return query select false, 0, p_limit;
    return;
  end if;

  insert into public.ai_usage as u (user_id, day, calls)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set calls = u.calls + 1
  returning u.calls into n;

  return query select (n <= p_limit), n, p_limit;
end;
$$;

-- Signed-in users only. (Calling this directly just inflates your own counter —
-- the actual gate is server-side in api/ai.ts, which decides using `allowed`.)
revoke all on function public.ai_rate_check(integer) from public, anon;
grant execute on function public.ai_rate_check(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY (run each on its own — the SQL editor only shows the LAST result):
--
--   select count(*) as usage_rows from public.ai_usage;
--
--   select relrowsecurity as rls_on
--   from pg_class where relname = 'ai_usage';
--
--   select proname, prosecdef as is_security_definer
--   from pg_proc where proname = 'ai_rate_check';
--
-- Note: the window is the calendar day in the database's timezone (UTC on
-- Supabase), so quotas reset at UTC midnight.
-- ---------------------------------------------------------------------------
