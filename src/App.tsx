// ---------------------------------------------------------------------------
// App: owns all state and orchestrates the flow —
//   welcome (centered composer) → curating pause → reveal (tab + widgets).
// Each workspace carries its own calm theme, applied via CSS variables here.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import type { Widget, WidgetType, Workspace, CurationChat, WidgetSpec, Domain, Scenery } from "./types";
import {
  createWorkspaceFromGoal,
  createWidget,
  specToWidget,
  reflow,
  suggestedTypes,
} from "./generateWorkspace";
import { getAI, getMock } from "./ai";
import { loadState, saveState, type AppState } from "./storage";
import { cloudEnabled } from "./supabase";
import { useAuth } from "./auth";
import {
  fetchWorkspaces,
  insertWorkspaces,
  updateWorkspaceCAS,
  upsertWorkspaces,
  deleteWorkspaces,
  countAllWorkspaces,
  migrationDone,
  markMigrationDone,
} from "./cloudStore";
import Canvas from "./components/Canvas";
import TabBar from "./components/TabBar";
import AddWidgetMenu from "./components/AddWidgetMenu";
import Composer from "./components/Composer";
import CurationPanel from "./components/CurationPanel";
import SettingsModal from "./components/SettingsModal";
import { Logo } from "./components/icons";

function bootstrap(): AppState {
  // Cloud mode starts empty — the signed-in user's workspaces load from the
  // cloud (never another account's local leftovers on a shared device).
  if (cloudEnabled) return { workspaces: [], activeId: "" };
  const loaded = loadState();
  if (loaded && loaded.workspaces.length) return loaded;
  return { workspaces: [], activeId: "" };
}

// The sync base: per workspace, the JSON we last synced + the row's cloud
// updated_at (used for optimistic-concurrency writes).
type SyncBase = Map<string, { json: string; updatedAt: string }>;
type SaveStatus = "idle" | "saving" | "saved" | "offline";

function computeDiff(workspaces: Workspace[], base: SyncBase) {
  const current = new Map(workspaces.map((w) => [w.id, JSON.stringify(w)]));
  const changed = workspaces.filter((w) => base.get(w.id)?.json !== current.get(w.id));
  const removed = [...base.keys()].filter((id) => !current.has(id));
  return { current, changed, removed };
}

export default function App({
  profileId,
  isOldestProfile,
  onSwitchProfile,
}: {
  // In cloud mode this is the active profile; App is remounted (key=profileId)
  // on every switch, so all state below resets cleanly per profile. Null in
  // local-only mode, where the profile concept doesn't exist.
  profileId: string | null;
  isOldestProfile: boolean;
  onSwitchProfile?: () => void;
}) {
  const { user, signOut } = useAuth();
  const cloudScoped = cloudEnabled && !!user && !!profileId;
  const [state, setState] = useState<AppState>(bootstrap);
  const [composing, setComposing] = useState<boolean>(() => state.workspaces.length === 0);
  const [composerPhase, setComposerPhase] = useState<"input" | "curating" | "exiting">("input");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [reloadNonce, setReloadNonce] = useState(0);
  // Per-workspace sync base: the JSON we last synced + the row's cloud updated_at.
  const lastSynced = useRef<SyncBase>(new Map());
  // Latest state, read by flushes (a closure would capture stale state).
  const stateRef = useRef(state);
  stateRef.current = state;
  // Monotonic token so a late-resolving sync can't overwrite the base snapshot
  // that a later sync already advanced.
  const syncSeq = useRef(0);

  // The next theme = one past the highest theme currently in use, so every tab
  // gets its own accent (cycling through the palette once they exceed its size).
  const nextThemeIndex = () =>
    state.workspaces.reduce((max, w) => Math.max(max, w.themeIndex), -1) + 1;

  // --- sync helpers (all read live state/base via refs) ---

  // Push local changes with optimistic concurrency; on conflict, adopt the
  // cloud version rather than clobber it. `seq` guards against out-of-order syncs.
  async function syncNow(pid: string, seq: number): Promise<void> {
    const base = lastSynced.current;
    const { current, changed, removed } = computeDiff(stateRef.current.workspaces, base);
    if (changed.length === 0 && removed.length === 0) {
      setSaveStatus("idle");
      return;
    }
    try {
      const nextBase = new Map(base);
      const fresh = changed.filter((w) => !base.has(w.id));
      const existing = changed.filter((w) => base.has(w.id));

      if (fresh.length) {
        const map = await insertWorkspaces(fresh, pid);
        fresh.forEach((w) => nextBase.set(w.id, { json: current.get(w.id)!, updatedAt: map[w.id] }));
      }
      const conflicts: string[] = [];
      for (const w of existing) {
        const nu = await updateWorkspaceCAS(w, pid, base.get(w.id)!.updatedAt);
        if (nu) nextBase.set(w.id, { json: current.get(w.id)!, updatedAt: nu });
        else conflicts.push(w.id);
      }
      if (removed.length) {
        await deleteWorkspaces(removed, pid);
        removed.forEach((id) => nextBase.delete(id));
      }
      if (conflicts.length) {
        // another tab/device wrote these — take the cloud version, never overwrite
        const cloud = await fetchWorkspaces(pid);
        const byId = new Map(cloud.map((r) => [r.data.id, r]));
        conflicts.forEach((id) => {
          const c = byId.get(id);
          if (c) nextBase.set(id, { json: JSON.stringify(c.data), updatedAt: c.updatedAt });
        });
        setState((s) => ({
          ...s,
          workspaces: s.workspaces.map((w) => {
            const c = byId.get(w.id);
            return conflicts.includes(w.id) && c ? c.data : w;
          }),
        }));
      }
      if (seq === syncSeq.current) lastSynced.current = nextBase;
      setSaveStatus("saved");
    } catch (e) {
      console.error("cloud sync failed (will retry on next change):", e);
      setSaveStatus("offline");
    }
  }

  // Last-ditch blind save on tab close / hide — prioritizes not losing the edit.
  function blindFlush(pid: string): void {
    const { changed, removed } = computeDiff(stateRef.current.workspaces, lastSynced.current);
    if (changed.length) upsertWorkspaces(changed, pid).catch(() => {});
    if (removed.length) deleteWorkspaces(removed, pid).catch(() => {});
  }

  // Pull the latest on tab-focus; adopt cloud rows we haven't locally edited, and
  // any workspaces created on another device.
  async function refetch(pid: string): Promise<void> {
    try {
      const cloud = await fetchWorkspaces(pid);
      const base = lastSynced.current;
      const s = stateRef.current;
      const byId = new Map(cloud.map((r) => [r.data.id, r]));
      const localIds = new Set(s.workspaces.map((w) => w.id));
      const nextBase = new Map(base);
      let changed = false;
      const merged = s.workspaces.map((w) => {
        const c = byId.get(w.id);
        if (!c) return w;
        const b = base.get(w.id);
        const notDiverged = b && b.json === JSON.stringify(w);
        if (notDiverged && c.updatedAt !== b!.updatedAt) {
          changed = true;
          nextBase.set(w.id, { json: JSON.stringify(c.data), updatedAt: c.updatedAt });
          return c.data;
        }
        return w;
      });
      const added = cloud.filter((r) => !localIds.has(r.data.id));
      added.forEach((r) => {
        nextBase.set(r.data.id, { json: JSON.stringify(r.data), updatedAt: r.updatedAt });
        changed = true;
      });
      if (!changed) return;
      lastSynced.current = nextBase;
      setState((cur) => ({ ...cur, workspaces: [...merged, ...added.map((r) => r.data)] }));
    } catch {
      /* offline — will retry on the next focus */
    }
  }

  // --- cloud bootstrap: load THIS profile's workspaces (once per mount/retry) ---
  useEffect(() => {
    if (!cloudScoped || !profileId) return;
    let cancelled = false;
    setLoadError(false);
    (async () => {
      try {
        const cloud = await fetchWorkspaces(profileId);
        if (cancelled) return;
        const legacy = loadState();
        // Migrate pre-cloud localStorage tabs ONLY when the whole ACCOUNT is
        // empty AND this is the oldest profile — so a second profile (or a
        // second device) can never absorb another profile's tabs.
        const accountTotal = await countAllWorkspaces();
        if (cancelled) return;
        if (accountTotal === 0 && isOldestProfile && legacy?.workspaces.length && !migrationDone()) {
          try {
            const map = await upsertWorkspaces(legacy.workspaces, profileId);
            markMigrationDone();
            lastSynced.current = new Map(
              legacy.workspaces.map((w) => [w.id, { json: JSON.stringify(w), updatedAt: map[w.id] ?? "" }]),
            );
          } catch (e) {
            console.error("migration upload failed (will retry on next change):", e);
            lastSynced.current = new Map();
          }
          if (!cancelled) {
            setState(legacy);
            setComposing(false);
          }
        } else {
          // Cloud has now been entered on this browser — mark migration done so
          // pre-cloud localStorage tabs can NEVER later leak into a different,
          // empty account on a shared device.
          markMigrationDone();
          lastSynced.current = new Map(
            cloud.map((r) => [r.data.id, { json: JSON.stringify(r.data), updatedAt: r.updatedAt }]),
          );
          if (!cancelled) {
            setState({ workspaces: cloud.map((r) => r.data), activeId: cloud[0]?.data.id ?? "" });
            setComposing(cloud.length === 0);
          }
        }
      } catch (e) {
        // Do NOT fall through to an empty composer — that looks like data loss.
        console.error("cloud load failed:", e);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setCloudReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, reloadNonce]);

  // --- persist everything ---
  // Local mode: the single localStorage bucket. Cloud mode: debounced diff-sync
  // with optimistic concurrency.
  useEffect(() => {
    if (!cloudEnabled) {
      saveState(state);
      return;
    }
    if (!cloudScoped || !profileId || !cloudReady) return;
    const { changed, removed } = computeDiff(state.workspaces, lastSynced.current);
    if (changed.length === 0 && removed.length === 0) return;
    const t = window.setTimeout(() => {
      const seq = ++syncSeq.current;
      setSaveStatus("saving");
      void syncNow(profileId, seq);
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, cloudScoped, profileId, cloudReady]);

  // Flush on unmount (profile switch / sign-out) — best-effort blind save.
  useEffect(() => {
    if (!cloudScoped || !profileId) return;
    return () => blindFlush(profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Flush on tab hide / close; refetch on return so two devices stay in step.
  useEffect(() => {
    if (!cloudScoped || !profileId) return;
    const onVisibility = () => (document.hidden ? blindFlush(profileId) : void refetch(profileId));
    const onPageHide = () => blindFlush(profileId);
    const onFocus = () => void refetch(profileId);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // "Saved" fades back to idle.
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = window.setTimeout(() => setSaveStatus("idle"), 1600);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  // closing the last tab returns to the welcome composer
  useEffect(() => {
    if (state.workspaces.length === 0 && !composing) {
      setComposerPhase("input");
      setComposing(true);
    }
  }, [state.workspaces.length, composing]);

  const active = state.workspaces.find((w) => w.id === state.activeId);

  // --- widget ops on the active workspace ---
  const setActiveWidgets = (fn: (widgets: Widget[]) => Widget[]) =>
    setState((s) => ({
      ...s,
      workspaces: s.workspaces.map((w) =>
        w.id === s.activeId ? { ...w, widgets: fn(w.widgets) } : w,
      ),
    }));

  const updateWidget = (u: Widget) =>
    setActiveWidgets((ws) => ws.map((w) => (w.id === u.id ? u : w)));
  const moveWidget = (id: string, x: number, y: number) =>
    setActiveWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, x, y } : w)));
  const deleteWidget = (id: string) =>
    setActiveWidgets((ws) => reflow(ws.filter((w) => w.id !== id)));
  const resizeWidget = (id: string, width: number, height: number) =>
    setActiveWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, width, height } : w)));

  function addWidget(type: WidgetType) {
    setActiveWidgets((ws) => reflow([...ws, createWidget(type, 0, 0)]));
  }
  async function addCustomWidget(description: string) {
    const ctx = {
      goal: active?.goal ?? "",
      domain: active?.domain ?? ("general" as const),
      existingTitles: active?.widgets.map((w) => w.title) ?? [],
    };
    try {
      const spec = await getAI().generateCustomWidget(description, ctx);
      setActiveWidgets((ws) => reflow([...ws, specToWidget(spec, 0, 0)]));
    } catch (e) {
      // Real AI failed — say why in the console, then fall back to the SMART
      // mock (which builds a fitting metric), never a bare note.
      console.error("AI widget generation failed; using offline fallback:", e);
      const spec = await getMock().generateCustomWidget(description, ctx);
      setActiveWidgets((ws) => reflow([...ws, specToWidget(spec, 0, 0)]));
    }
  }

  // --- curation chat ---
  const seededRef = useRef<Set<string>>(new Set());
  const ctxFor = (ws: Workspace) => ({
    goal: ws.goal,
    domain: ws.domain,
    existingTitles: ws.widgets.map((w) => w.title),
  });

  const updateChat = (wsId: string, fn: (c: CurationChat) => CurationChat) =>
    setState((s) => ({
      ...s,
      workspaces: s.workspaces.map((w) =>
        w.id === wsId
          ? { ...w, chat: fn(w.chat ?? { open: false, seeded: false, status: "idle", messages: [] }) }
          : w,
      ),
    }));

  const openChat = (wsId: string) => updateChat(wsId, (c) => ({ ...c, open: true }));
  const closeChat = (wsId: string) => updateChat(wsId, (c) => ({ ...c, open: false }));
  const chatError = (wsId: string) =>
    updateChat(wsId, (c) => ({
      ...c,
      status: "idle",
      messages: [
        ...c.messages,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: "I couldn't reach the AI just now — check your key and model in settings (the gear, top-right). If it keeps happening, tell me the error and I'll fix it.",
        },
      ],
    }));

  function sendUserReply(wsId: string, text: string) {
    const ws = state.workspaces.find((w) => w.id === wsId);
    if (!ws) return;
    const history = [
      ...(ws.chat?.messages ?? []),
      { id: crypto.randomUUID(), role: "user" as const, text },
    ];
    updateChat(wsId, (c) => ({ ...c, status: "thinking", messages: history }));
    getAI()
      .curationChat(history, ctxFor(ws))
      .then((turn) =>
        updateChat(wsId, (c) => ({
          ...c,
          status: "idle",
          messages: [
            ...c.messages,
            { id: crypto.randomUUID(), role: "ai", text: turn.text, proposals: turn.proposals },
          ],
        })),
      )
      .catch(() => chatError(wsId));
  }

  function acceptProposal(wsId: string, messageId: string, proposalId: string) {
    setState((s) => ({
      ...s,
      workspaces: s.workspaces.map((w) => {
        if (w.id !== wsId || !w.chat) return w;
        let picked: WidgetSpec | null = null;
        const messages = w.chat.messages.map((m) =>
          m.id !== messageId
            ? m
            : {
                ...m,
                proposals: m.proposals?.map((p) => {
                  if (p.id !== proposalId) return p;
                  picked = p.spec;
                  return { ...p, status: "accepted" as const };
                }),
              },
        );
        const widgets = picked ? reflow([...w.widgets, specToWidget(picked, 0, 0)]) : w.widgets;
        return { ...w, widgets, chat: { ...w.chat, messages } };
      }),
    }));
  }

  function rejectProposal(wsId: string, messageId: string, proposalId: string) {
    updateChat(wsId, (c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id !== messageId
          ? m
          : {
              ...m,
              proposals: m.proposals?.map((p) =>
                p.id === proposalId ? { ...p, status: "rejected" as const } : p,
              ),
            },
      ),
    }));
  }

  // Seed the first AI turn once a chat panel opens. The ref guards against a
  // double-seed (React StrictMode runs mount effects twice in dev).
  useEffect(() => {
    const a = state.workspaces.find((w) => w.id === state.activeId);
    if (!a || composing || !a.chat) return;
    if (a.chat.open && !a.chat.seeded && a.chat.status === "idle" && !seededRef.current.has(a.id)) {
      seededRef.current.add(a.id);
      updateChat(a.id, (c) => ({ ...c, seeded: true, status: "thinking" }));
      getAI()
        .curationChat([], ctxFor(a))
        .then((turn) =>
          updateChat(a.id, (c) => ({
            ...c,
            status: "idle",
            messages: [
              ...c.messages,
              { id: crypto.randomUUID(), role: "ai", text: turn.text, proposals: turn.proposals },
            ],
          })),
        )
        .catch(() => chatError(a.id));
    }
  }, [state.activeId, state.workspaces, composing]);

  // --- the signature flow: curate, then reveal ---
  const VALID_DOMAINS: Domain[] = ["fitness", "study", "writing", "finance", "work", "habit", "general"];

  async function beginCuration(goal: string) {
    setComposerPhase("curating");
    const themeIndex = nextThemeIndex();
    const started = Date.now();

    const reveal = (ws: Workspace) => {
      // Keep the calm "curating" beat even when the answer is instant.
      const wait = Math.max(0, 900 - (Date.now() - started));
      window.setTimeout(() => {
        setState((s) => ({ workspaces: [...s.workspaces, ws], activeId: ws.id }));
        setComposerPhase("exiting");
        window.setTimeout(() => {
          setComposing(false);
          setComposerPhase("input");
        }, 640);
      }, wait);
    };

    const template = (): Workspace => ({
      ...createWorkspaceFromGoal(goal, themeIndex),
      chat: { open: true, seeded: false, status: "idle", messages: [] },
    });

    // Real AI builds the initial page when available; keyword templates are
    // only the keyless/error fallback.
    const ai = getAI();
    if (!ai.curateWorkspace) {
      reveal(template());
      return;
    }
    try {
      const out = await ai.curateWorkspace(goal);
      const widgets = reflow(out.widgets.slice(0, 6).map((s) => specToWidget(s, 0, 0)));
      if (widgets.length === 0) throw new Error("empty curation");
      const base = template();
      reveal({
        ...base,
        title: out.title?.trim() ? out.title.trim().slice(0, 26) : base.title,
        domain: VALID_DOMAINS.includes(out.domain) ? out.domain : base.domain,
        widgets,
      });
    } catch (e) {
      console.error("AI workspace curation failed; using template fallback:", e);
      reveal(template());
    }
  }

  const openComposer = () => {
    setComposerPhase("input");
    setComposing(true);
  };
  const cancelComposer = () => setComposing(false);

  // --- tab ops ---
  const selectWorkspace = (id: string) => setState((s) => ({ ...s, activeId: id }));
  const setScenery = (scenery: Scenery) =>
    setState((s) => ({
      ...s,
      workspaces: s.workspaces.map((w) => (w.id === s.activeId ? { ...w, scenery } : w)),
    }));
  const renameWorkspace = (id: string, title: string) =>
    setState((s) => ({
      ...s,
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, title } : w)),
    }));
  function closeWorkspace(id: string) {
    setState((s) => {
      const remaining = s.workspaces.filter((w) => w.id !== id);
      if (remaining.length === 0) return { workspaces: [], activeId: "" };
      const activeId =
        s.activeId === id ? remaining[remaining.length - 1].id : s.activeId;
      return { workspaces: remaining, activeId };
    });
  }

  // Flush pending changes to the cloud and WAIT — used before an explicit sign
  // out, which revokes the session (the fire-and-forget unmount flush would then
  // be rejected by RLS and the last edit lost).
  async function flushNow() {
    if (!cloudScoped || !profileId) return;
    const { current, changed, removed } = computeDiff(stateRef.current.workspaces, lastSynced.current);
    if (changed.length === 0 && removed.length === 0) return;
    try {
      const map = await upsertWorkspaces(changed, profileId);
      await deleteWorkspaces(removed, profileId);
      const next = new Map(lastSynced.current);
      changed.forEach((w) =>
        next.set(w.id, { json: current.get(w.id)!, updatedAt: map[w.id] ?? next.get(w.id)?.updatedAt ?? "" }),
      );
      removed.forEach((id) => next.delete(id));
      lastSynced.current = next;
    } catch (e) {
      console.error("final flush before sign-out failed:", e);
    }
  }
  const handleSignOut = async () => {
    await flushNow(); // save the last edit while the session is still valid
    await signOut();
  };
  const handleSwitchProfile = onSwitchProfile
    ? async () => {
        await flushNow(); // guarantee this profile's last edit lands before remount
        onSwitchProfile();
      }
    : undefined;

  if (loadError) {
    return (
      <div className="ambient flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-xs text-sm text-muted-c">
          Couldn't reach your space just now. Your goals are safe in the cloud — this is only a
          connection hiccup.
        </p>
        <button
          onClick={() => {
            setLoadError(false);
            setCloudReady(false);
            setReloadNonce((n) => n + 1);
          }}
          className="rounded-full border border-white/12 px-4 py-2 text-sm text-c transition hover:brightness-125"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!cloudReady) {
    return (
      <div className="ambient flex h-full items-center justify-center">
        <span
          className="size-3 rounded-full"
          style={{ background: "var(--accent)", animation: "breathe 2s ease-in-out infinite" }}
        />
      </div>
    );
  }

  return (
    <div className="ambient flex h-full flex-col">
      {cloudEnabled && user && saveStatus !== "idle" && (
        <div
          className={`pop-in fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs backdrop-blur ${
            saveStatus === "offline"
              ? "border border-amber-400/30 bg-amber-500/15 text-amber-100"
              : "glass text-muted-c"
          }`}
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "Saved"
              : "Offline — your changes will sync when you reconnect"}
        </div>
      )}

      {active && (
        <TabBar
          workspaces={state.workspaces}
          activeId={state.activeId}
          onSelect={selectWorkspace}
          onClose={closeWorkspace}
          onNew={openComposer}
          onRename={renameWorkspace}
          onOpenSettings={() => setSettingsOpen(true)}
          onSwitchProfile={handleSwitchProfile}
          onSignOut={cloudEnabled && user ? handleSignOut : undefined}
        />
      )}

      {/* In cloud mode the welcome screen has no tab bar — keep these reachable. */}
      {composing && cloudEnabled && user && (
        <div className="fixed top-4 right-4 z-40 flex gap-2">
          {handleSwitchProfile && (
            <button
              onClick={handleSwitchProfile}
              className="glass rounded-full px-3.5 py-1.5 text-xs text-muted-c transition hover:text-c"
            >
              switch profile
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="glass rounded-full px-3.5 py-1.5 text-xs text-muted-c transition hover:text-c"
          >
            sign out
          </button>
        </div>
      )}

      {active && (
        <main className="relative flex-1 overflow-hidden">
          <Canvas
            widgets={active.widgets}
            sceneIndex={active.themeIndex}
            scenery={active.scenery}
            onChangeScenery={setScenery}
            onChange={updateWidget}
            onMove={moveWidget}
            onResize={resizeWidget}
            onDelete={deleteWidget}
          />
          <div className="absolute right-5 bottom-5 z-10">
            <AddWidgetMenu
              suggested={suggestedTypes(active.domain)}
              onAdd={addWidget}
              onAddCustom={addCustomWidget}
            />
          </div>

          {active.chat?.open ? (
            <CurationPanel
              chat={active.chat}
              onSend={(t) => sendUserReply(active.id, t)}
              onAccept={(mId, pId) => acceptProposal(active.id, mId, pId)}
              onReject={(mId, pId) => rejectProposal(active.id, mId, pId)}
              onClose={() => closeChat(active.id)}
            />
          ) : (
            <button
              onClick={() => openChat(active.id)}
              className="glass absolute bottom-5 left-5 z-10 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-c transition hover:brightness-125"
              title="Open companion"
            >
              <Logo className="accent-text h-4 w-4" />
              companion
            </button>
          )}
        </main>
      )}

      {composing && (
        <Composer
          phase={composerPhase}
          welcome={state.workspaces.length === 0}
          onSubmit={beginCuration}
          onCancel={state.workspaces.length > 0 ? cancelComposer : undefined}
        />
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
