import { useState } from "react";
import { Lock, Clock, ChevronRight } from "lucide-react";
import { BusinessVerificationModal } from "@/components/BusinessVerificationModal";

interface Tier2NoticeProps {
  /** Completes the sentence "Business verification required to ___." */
  reason: string;
  /** Which venue the application is filed against. Verification is per-venue. */
  venueId?: string | null;
}

/**
 * Blocked state for Tier 2 gated surfaces, and the entry point to filing.
 *
 * The modal is owned here rather than by each of the five surfaces on purpose:
 * this is the one component every gated surface already renders, so wiring the
 * trigger once covers Go Active, VenuePriceEditor, StaffCommissionEditor,
 * ManagerApprovalPanel and PayoutsPanel without five near-identical edits.
 *
 * `submitted` is local, not fetched. Reading "is there already a pending
 * application" from the DB would mean one query per notice, i.e. five per
 * dashboard mount, the same N+1 that useVenueVerified exists to avoid. The
 * cost of keeping it local is that after a reload the prompt reads as
 * actionable again; clicking it hits the one-pending-per-venue unique index
 * and the modal reports "already under review", so the outcome is still
 * correct, just one tap less elegant. Promote this to context alongside
 * business_verified if that becomes annoying in practice.
 */
export const Tier2Notice = ({ reason, venueId }: Tier2NoticeProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
        <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/90 leading-relaxed">
          Business verification under review.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={!venueId}
        className="w-full flex items-start gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-left transition-all hover:bg-amber-500/10 hover:border-amber-500/40 disabled:opacity-60 disabled:hover:bg-amber-500/5"
      >
        <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="flex-1 text-[9px] font-black uppercase tracking-widest text-amber-500/90 leading-relaxed">
          Business verification required to {reason}.
          {venueId && <span className="block mt-1 text-amber-500">Tap to verify</span>}
        </p>
        {venueId && <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
      </button>

      {venueId && (
        <BusinessVerificationModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          venueId={venueId}
          reason={reason}
          onSubmitted={() => setSubmitted(true)}
        />
      )}
    </>
  );
};
