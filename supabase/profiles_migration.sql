-- ============================================================================
-- Aditya — profiles migration.  Run ONCE in the Supabase SQL editor.
-- Safe to re-run: every statement is guarded (if not exists / guarded insert).
-- Adds Netflix-style profiles on top of the existing accounts, and links each
-- workspace to a profile. Existing workspaces are adopted into a default 'You'
-- profile so nothing is ever orphaned.
-- ============================================================================

-- 1. Profiles: one row per profile tile, owned by the account (user_id auto-fills).
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  avatar_id     text,            -- preset animal key, e.g. "fox"  (null = uploaded / none)
  avatar_image  text,            -- uploaded image as a data URL  (null = using a preset)
  theme_pack_id text,            -- world theme id                (null = default)
  color         text not null default 'sage',
  created_at    timestamptz not null default now()
);

-- 2. Lock it down — RLS makes the policies below the only way in.
alter table public.profiles enable row level security;

-- 3-6. Per-user policies (same shape as workspaces): you only touch your own.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

-- 7. Speed up the picker's "my profiles" query.
create index if not exists profiles_user_id_idx on public.profiles (user_id);

-- 8. Link each workspace to a profile; deleting a profile deletes its tabs.
alter table public.workspaces
  add column if not exists profile_id uuid references public.profiles (id) on delete cascade;

-- 9. Speed up the per-profile fetch + the cascade check.
create index if not exists workspaces_profile_id_idx on public.workspaces (profile_id);

-- 10. Backfill A: give every user who has orphan workspaces a default 'You'
--     profile (skipped for users who already have one — re-run stays a no-op).
insert into public.profiles (user_id, name, avatar_id, color)
select distinct w.user_id, 'You', 'fox', 'sage'
from public.workspaces w
where w.profile_id is null
  and not exists (select 1 from public.profiles p where p.user_id = w.user_id);

-- 11. Backfill B: adopt every orphan workspace into its owner's OLDEST profile.
update public.workspaces w
set profile_id = p.id
from (
  select distinct on (user_id) id, user_id
  from public.profiles
  order by user_id, created_at asc
) p
where w.profile_id is null
  and w.user_id = p.user_id;
