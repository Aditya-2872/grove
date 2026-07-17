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
  const label = ws.title || "Untitled";

  // Editing: an input capsule in place of the tab (a text field can't live
  // inside a <button>).
  if (editing) {
    return (
      <div className="surface flex max-w-48 min-w-32 shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm">
        <span className="size-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
        <input
          autoFocus
          value={ws.title}
          onChange={(e) => onRename(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setEditing(false)}
          className="w-full bg-transparent text-c outline-none"
        />
      </div>
    );
  }

  // The tab itself is now a real <button> — reachable and selectable by keyboard
  // (Tab to it, Enter/Space to switch; F2 to rename). The close button is a
  // sibling, not nested (a button can't contain a button), and appears on hover
  // OR keyboard focus so it's never a hidden target.
  return (
    <div className="group relative flex shrink-0">
      <button
        onClick={onSelect}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "F2") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        title="Double-click or F2 to rename"
        className={`flex max-w-48 min-w-32 items-center gap-2 rounded-full py-1.5 pr-8 pl-3 text-left text-sm transition ${
          active ? "surface text-c" : "text-muted-c hover:text-c"
        }`}
        style={active ? { boxShadow: "0 0 22px var(--glow)" } : undefined}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
        <span className="flex-1 truncate">{label}</span>
      </button>
      <button
        onClick={onClose}
        aria-label={`Delete goal: ${label}`}
        title="Delete goal"
        className="touch-visible absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-c opacity-0 transition group-focus-within:opacity-100 hover:text-c group-hover:opacity-100"
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
