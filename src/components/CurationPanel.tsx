// ---------------------------------------------------------------------------
// The curation chat: a calm right-side panel that opens after a goal. The AI
// asks a question and proposes widgets (Add / Skip); the user can also reply.
// Runs on the offline mock now; upgrades to real Claude with a key later.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import type { CurationChat } from "../types";
import { hasKey } from "../ai";
import ProposalCard from "./ProposalCard";
import { IconClose, Logo } from "./icons";

export default function CurationPanel({
  chat,
  onSend,
  onAccept,
  onReject,
  onClose,
}: {
  chat: CurationChat;
  onSend: (text: string) => void;
  onAccept: (messageId: string, proposalId: string) => void;
  onReject: (messageId: string, proposalId: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.status]);

  const send = () => {
    const v = draft.trim();
    if (!v || chat.status === "thinking") return;
    onSend(v);
    setDraft("");
  };

  return (
    <div className="fade-in glass absolute top-0 right-0 bottom-0 z-20 flex w-[360px] max-w-[86%] flex-col border-l hair">
      <div className="hair flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="accent-text h-4 w-4" />
          <span className="text-sm font-medium text-c">Companion</span>
        </div>
        <button onClick={onClose} className="text-muted-c transition hover:text-c" title="Close">
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-auto px-4 py-4">
        {chat.messages.map((m) => (
          <div key={m.id}>
            <div
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm text-[#0a0d0b]"
                  : "max-w-[94%] text-sm leading-relaxed text-c"
              }
              style={m.role === "user" ? { background: "var(--accent)" } : undefined}
            >
              {m.text}
            </div>
            {m.proposals && m.proposals.length > 0 && (
              <div className="mt-2 space-y-2">
                {m.proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onAccept={() => onAccept(m.id, p.id)}
                    onReject={() => onReject(m.id, p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {chat.status === "thinking" && (
          <div className="flex gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 rounded-full"
                style={{ background: "var(--accent)", animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hair border-t p-3">
        <div className="surface-soft flex items-center gap-2 rounded-xl px-3 py-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Reply…"
            className="flex-1 bg-transparent text-sm text-c placeholder:text-muted-c outline-none"
          />
          <button onClick={send} className="accent-text text-xs transition hover:brightness-125">
            Send
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-c">
          {hasKey() ? "Powered by AI" : "Offline companion — add a free key in settings for full AI"}
        </p>
      </div>
    </div>
  );
}
