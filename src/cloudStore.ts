// ---------------------------------------------------------------------------
// Cloud persistence. Each workspace is one Postgres row (id, profile_id, data,
// updated_at), scoped to the signed-in user by RLS and to the active profile by
// an explicit profile_id filter (a same-account UX scope; RLS on user_id is the
// real fence). The client never sends user_id — the DB default auth.uid() fills it.
//
// Writes use OPTIMISTIC CONCURRENCY: an update only lands if the row's
// updated_at still matches what we last saw. If another tab/device wrote in the
// meantime the update matches 0 rows (a conflict) and the caller re-fetches,
// so a stale client can never silently clobber a fresher write.
// ---------------------------------------------------------------------------

import { supabase } from "./supabase";
import type { Workspace } from "./types";

const TABLE = "workspaces";
const MIGRATED_KEY = "aditya.cloud.migrated.v1";

export interface CloudRow {
  data: Workspace;
  updatedAt: string;
}

export async function fetchWorkspaces(profileId: string): Promise<CloudRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("data, updated_at")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: true });
  if (error) throw new Error(`cloud load failed: ${error.message}`);
  return (data ?? []).map((r) => ({ data: r.data as Workspace, updatedAt: r.updated_at as string }));
}

/** Insert brand-new rows. Returns each new row's updated_at (the sync base). */
export async function insertWorkspaces(
  workspaces: Workspace[],
  profileId: string,
): Promise<Record<string, string>> {
  if (!supabase || workspaces.length === 0) return {};
  const now = new Date().toISOString();
  const rows = workspaces.map((w) => ({ id: w.id, profile_id: profileId, data: w, updated_at: now }));
  // upsert, not insert: if a previous sync inserted the row but died before it
  // could record the new base, a plain insert would throw 23505 forever and
  // wedge sync for the session. Writing the same row twice is harmless.
  const { data, error } = await supabase.from(TABLE).upsert(rows).select("id, updated_at");
  if (error) throw new Error(`cloud insert failed: ${error.message}`);
  return Object.fromEntries((data ?? []).map((r) => [r.id as string, r.updated_at as string]));
}

/** Conditional update: only writes if updated_at still equals `expectedUpdatedAt`.
 *  Returns the new updated_at on success, or null on a conflict (0 rows matched). */
export async function updateWorkspaceCAS(
  workspace: Workspace,
  profileId: string,
  expectedUpdatedAt: string,
): Promise<string | null> {
  if (!supabase) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ data: workspace, updated_at: now })
    .eq("id", workspace.id)
    .eq("profile_id", profileId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) throw new Error(`cloud update failed: ${error.message}`);
  return data && data.length > 0 ? now : null;
}

/** Blind upsert — used for migration and last-ditch flushes where saving the
 *  user's data matters more than conflict detection. Returns updated_at per id. */
export async function upsertWorkspaces(
  workspaces: Workspace[],
  profileId: string,
): Promise<Record<string, string>> {
  if (!supabase || workspaces.length === 0) return {};
  const now = new Date().toISOString();
  const rows = workspaces.map((w) => ({ id: w.id, profile_id: profileId, data: w, updated_at: now }));
  const { data, error } = await supabase.from(TABLE).upsert(rows).select("id, updated_at");
  if (error) throw new Error(`cloud save failed: ${error.message}`);
  return Object.fromEntries((data ?? []).map((r) => [r.id as string, r.updated_at as string]));
}

export async function deleteWorkspaces(ids: string[], profileId: string): Promise<void> {
  if (!supabase || ids.length === 0) return;
  const { error } = await supabase.from(TABLE).delete().in("id", ids).eq("profile_id", profileId);
  if (error) throw new Error(`cloud delete failed: ${error.message}`);
}

/** Count ALL of the account's workspaces (across every profile) — the migration
 *  guard uses this un-scoped count so it can only fire on a truly empty account. */
export async function countAllWorkspaces(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase.from(TABLE).select("id", { count: "exact", head: true });
  if (error) throw new Error(`cloud count failed: ${error.message}`);
  return count ?? 0;
}

/** Adopt any workspaces with no profile into the given profile (idempotent). */
export async function adoptOrphanWorkspaces(profileId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).update({ profile_id: profileId }).is("profile_id", null);
  if (error) throw new Error(`orphan adoption failed: ${error.message}`);
}

/** Has this browser already pushed its pre-cloud data into an account? */
export function migrationDone(): boolean {
  try {
    return localStorage.getItem(MIGRATED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markMigrationDone(): void {
  try {
    localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    /* ignore */
  }
}
