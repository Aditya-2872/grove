// ---------------------------------------------------------------------------
// The pure core of refetch(): given the cloud rows, the last-synced base, and
// the current local workspaces, decide what the merged set should be. Pulled
// out of App so it can be unit-tested — this is data-integrity code (a wrong
// answer resurrects a deleted goal or drops a live one) and it can't be driven
// from the browser without a second signed-in device.
// ---------------------------------------------------------------------------

import type { Workspace } from "./types";
import type { CloudRow } from "./cloudStore";
import { migrateMetricPeriods } from "./storage";

/** Per-workspace sync base: the JSON we last synced + the row's cloud ts. */
export type SyncBase = Map<string, { json: string; updatedAt: string }>;

export interface Reconciled {
  workspaces: Workspace[];
  nextBase: SyncBase;
  changed: boolean;
}

/**
 * Reconcile a fresh cloud fetch against local state on tab-focus:
 *  - adopt a cloud row we haven't locally edited but that moved on elsewhere,
 *  - add rows created on another device,
 *  - DROP rows deleted on another device — but only when we've synced them
 *    before (so a brand-new row whose insert is still in flight survives) and
 *    haven't edited them since (an unsynced local edit re-creates the row).
 */
export function reconcileFetched(cloud: CloudRow[], base: SyncBase, local: Workspace[]): Reconciled {
  const migrated = cloud.map((r) => ({ ...r, data: migrateMetricPeriods(r.data) }));
  const byId = new Map(migrated.map((r) => [r.data.id, r]));
  const localIds = new Set(local.map((w) => w.id));
  const nextBase = new Map(base);
  let changed = false;

  const merged = local.flatMap((w) => {
    const c = byId.get(w.id);
    const b = base.get(w.id);
    if (!c) {
      // Cloud-absent.
      if (b && b.json === JSON.stringify(w)) {
        nextBase.delete(w.id);
        changed = true;
        return [];
      }
      return [w];
    }
    const notDiverged = b && b.json === JSON.stringify(w);
    if (notDiverged && c.updatedAt !== b!.updatedAt) {
      changed = true;
      nextBase.set(w.id, { json: JSON.stringify(c.data), updatedAt: c.updatedAt });
      return [c.data];
    }
    return [w];
  });

  const added = migrated.filter((r) => !localIds.has(r.data.id));
  added.forEach((r) => {
    nextBase.set(r.data.id, { json: JSON.stringify(r.data), updatedAt: r.updatedAt });
    changed = true;
  });

  return { workspaces: [...merged, ...added.map((r) => r.data)], nextBase, changed };
}
