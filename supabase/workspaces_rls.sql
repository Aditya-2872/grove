-- ============================================================================
-- Aditya — workspaces tenancy baseline. Run ONCE in the Supabase SQL editor.
-- The workspaces table was created in an early session; this file commits its
-- security model so it's auditable, and GUARANTEES it (idempotent, safe to
-- re-run): Row-Level Security ON + four owner-only policies. Running it makes
-- the table secure regardless of its current state.
-- ============================================================================

-- 1. Turn RLS on (no-op if already on). Without this the public anon key can
--    read/write every user's rows.
alter table public.workspaces enable row level security;

-- 2. Owner-only policies. Each user may only touch rows where user_id = their id.
--    (user_id is filled server-side by the column default auth.uid(); the client
--    never sends it.)
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own" on public.workspaces
  for select using (auth.uid() = user_id);

drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own" on public.workspaces
  for insert with check (auth.uid() = user_id);

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own" on public.workspaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_delete_own" on public.workspaces
  for delete using (auth.uid() = user_id);

-- 3. Verify. NOTE: the Supabase SQL editor only shows the LAST statement's
--    result, so run each of these two SELECTs on its own (paste one, Run, then
--    the other) to see both.

--    (a) both tables should show rls_enabled = true
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in ('workspaces', 'profiles');

--    (b) each table should list select/insert/update/delete owner policies
select tablename, policyname, cmd
from pg_policies
where tablename in ('workspaces', 'profiles')
order by tablename, cmd;
