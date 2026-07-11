// ---------------------------------------------------------------------------
// A single AI-suggested widget in the curation chat: icon + title + why, with
// Add / Skip. Collapses to a quiet line once acted on.
// ---------------------------------------------------------------------------

import type { WidgetProposal } from "../types";
import { WidgetIcon } from "./icons";

export default function ProposalCard({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: WidgetProposal;
  onAccept: () => void;
  onReject: () => void;
}) {
  if (proposal.status !== "pending") {
    return (
      <div className="surface-soft flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-muted-c">
        <WidgetIcon type={proposal.spec.type} className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">{proposal.spec.title}</span>
        <span>{proposal.status === "accepted" ? "Added" : "Skipped"}</span>
      </div>
    );
  }

  return (
    <div className="surface rounded-xl p-3">
      <div className="flex items-center gap-2">
        <WidgetIcon type={proposal.spec.type} className="accent-text h-4 w-4" />
        <span className="flex-1 text-sm font-medium text-c">{proposal.spec.title}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-c">{proposal.rationale}</p>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={onAccept}
          className="flex-1 rounded-lg py-1 text-xs font-medium text-[#0a0d0b] transition hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          Add
        </button>
        <button
          onClick={onReject}
          className="surface-soft flex-1 rounded-lg py-1 text-xs text-muted-c transition hover:text-c"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
