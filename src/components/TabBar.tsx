// ---------------------------------------------------------------------------
// Tabs as calm capsules — one per workspace, each carrying a dot in its own
// theme accent. Click to switch, double-click to rename, close on hover, and a
// "+" capsule to begin a new goal.
// ---------------------------------------------------------------------------

import { useState } from "react";
import type { Workspace } from "../types";
import { IconClose, IconPlus, IconGear, IconUsers, IconLogout, Logo } from "./icons";
import ClockBar from "./ClockBar";

function Tab({
  ws,
  active,
  onSelect,
  onClose,
  onRename,
}: {
  ws: Workspace;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      onClick={onSelect}
      onDoubleClick={() => setEditing(true)}
      className={`group flex max-w-48 min-w-32 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
        active ? "surface text-c" : "text-muted-c hover:text-c"
      }`}
      style={active ? { boxShadow: "0 0 22px var(--glow)" } : undefined}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
      {editing ? (
        <input
          autoFocus
          value={ws.title}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRename(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
          className="w-full bg-transparent outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{ws.title || "Untitled"}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="touch-visible shrink-0 opacity-0 transition hover:text-c group-hover:opacity-100"
        title="Delete goal"
      >
        <IconClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function TabBar({
  workspaces,
  activeId,
  onSelect,
  onClose,
  onNew,
  onRename,
  onOpenSettings,
  onSwitchProfile,
  onSignOut,
}: {
  workspaces: Workspace[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onOpenSettings: () => void;
  onSwitchProfile?: () => void;
  onSignOut?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <Logo className="accent-text mr-1 h-5 w-5 shrink-0" />
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {workspaces.map((ws) => (
          <Tab
            key={ws.id}
            ws={ws}
            active={ws.id === activeId}
            onSelect={() => onSelect(ws.id)}
            onClose={() => onClose(ws.id)}
            onRename={(title) => onRename(ws.id, title)}
          />
        ))}
        <button
          onClick={onNew}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-c transition hover:surface hover:text-c"
          title="New goal"
        >
          <IconPlus className="h-4 w-4" />
        </button>
      </div>
      <ClockBar />
      <span className="mx-1 h-5 w-px bg-white/8" />
      {onSwitchProfile && (
        <button
          onClick={onSwitchProfile}
          className="shrink-0 rounded-full p-1.5 text-muted-c transition hover:surface hover:text-c"
          title="Switch profile"
        >
          <IconUsers className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={onOpenSettings}
        className="shrink-0 rounded-full p-1.5 text-muted-c transition hover:surface hover:text-c"
        title="AI settings"
      >
        <IconGear className="h-4 w-4" />
      </button>
      {onSignOut && (
        <button
          onClick={onSignOut}
          className="shrink-0 rounded-full p-1.5 text-muted-c transition hover:surface hover:text-c"
          title="Sign out"
        >
          <IconLogout className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
