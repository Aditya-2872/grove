// ---------------------------------------------------------------------------
// Between AuthGate and App. In cloud mode it manages the active PROFILE:
//   • loads the account's profiles (with an error/retry beat)
//   • a brand-new account with none is sent straight to "create your first"
//   • the picker chooses one; the choice lives in sessionStorage (per browser tab)
//   • App is mounted with key={profileId} so its state + sync reset cleanly on
//     every switch — one profile's sync can never bleed into another
// In local-only mode it just renders App, untouched.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { cloudEnabled } from "../supabase";
import { useAuth } from "../auth";
import type { Profile } from "../types";
import {
  fetchProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getActiveProfileId,
  setActiveProfileId,
  clearActiveProfileId,
  type ProfileInput,
} from "../profiles";
import { adoptOrphanWorkspaces } from "../cloudStore";
import { applyWorld, resolveWorld, DEFAULT_WORLD } from "../worlds";
import App from "../App";
import ProfilePicker from "./ProfilePicker";
import ProfileEditor from "./ProfileEditor";

const Loading = () => (
  <div className="ambient flex h-full items-center justify-center">
    <span
      className="size-3 rounded-full"
      style={{ background: "var(--accent)", animation: "breathe 2s ease-in-out infinite" }}
    />
  </div>
);

export default function ProfileGate() {
  const { user, signOut, guest } = useAuth();

  // Local-only mode, or a guest trying Grove without an account: no cloud
  // profiles — just the app, backed by this browser's storage.
  if (!cloudEnabled || guest) return <App profileId={null} isOldestProfile={false} />;
  return <CloudProfileGate userId={user?.id} signOut={signOut} />;
}

function CloudProfileGate({ userId, signOut }: { userId?: string; signOut: () => Promise<void> }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  // null = closed; { profile } = editing; { } = creating a new one
  const [editor, setEditor] = useState<{ profile?: Profile } | null>(null);

  async function load() {
    setError("");
    setProfiles(null);
    try {
      const ps = await fetchProfiles();
      // Safety net beside the SQL backfill: adopt any profile-less workspaces
      // into the oldest profile so nothing is ever stranded.
      if (ps.length > 0) {
        try {
          await adoptOrphanWorkspaces(ps[0].id);
        } catch (e) {
          console.error("orphan adoption skipped:", e);
        }
      }
      setProfiles(ps);
      const sess = getActiveProfileId();
      if (sess && ps.some((p) => p.id === sess)) setActiveId(sess);
      else {
        clearActiveProfileId();
        setActiveId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your profiles.");
    }
  }

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Re-skin the whole app to the active profile's world (the picker/login use
  // the default world).
  useEffect(() => {
    const ap = profiles?.find((p) => p.id === activeId);
    applyWorld(activeId && ap ? resolveWorld(ap.themePackId) : DEFAULT_WORLD);
  }, [activeId, profiles]);

  function activate(id: string) {
    setActiveProfileId(id);
    setActiveId(id);
  }
  function switchProfile() {
    clearActiveProfileId();
    setActiveId(null);
  }

  async function saveProfile(input: ProfileInput, id?: string) {
    const firstEver = (profiles?.length ?? 0) === 0;
    if (id) await updateProfile(id, input);
    else {
      const created = await createProfile(input);
      if (firstEver) activate(created.id);
    }
    await load();
    setEditor(null);
  }

  async function removeProfile(id: string) {
    await deleteProfile(id);
    if (getActiveProfileId() === id) switchProfile();
    await load();
    setEditor(null);
  }

  if (error) {
    return (
      <div className="ambient flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-c">{error}</p>
        <button
          onClick={load}
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-c transition hover:brightness-125"
        >
          Try again
        </button>
      </div>
    );
  }

  if (profiles === null) return <Loading />;

  // A brand-new account: send them straight to creating their first profile.
  const mustCreate = profiles.length === 0;

  if (activeId) {
    const active = profiles.find((p) => p.id === activeId);
    if (active) {
      return (
        <App
          key={active.id}
          profileId={active.id}
          isOldestProfile={active.id === profiles[0].id}
          onSwitchProfile={switchProfile}
        />
      );
    }
  }

  return (
    <>
      <ProfilePicker
        profiles={profiles}
        onPick={activate}
        onEdit={(p) => setEditor({ profile: p })}
        onCreate={() => setEditor({})}
        onSignOut={signOut}
      />
      {(editor || mustCreate) && (
        <ProfileEditor
          initial={editor?.profile}
          canDelete={profiles.length > 1}
          canCancel={!mustCreate}
          onSave={saveProfile}
          onDelete={editor?.profile ? removeProfile : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
