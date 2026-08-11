import { Lock } from "lucide-react";

interface Tier2NoticeProps {
  /** Completes the sentence "Business verification required to ___." */
  reason: string;
}

/**
 * Placeholder blocked state for Tier 2 gated surfaces. Deliberately one shared
 * component rather than five inline blocks: part 2 replaces this with the
 * filing-modal trigger, and that should be a single edit, not five.
 *
 * `reason` varies per surface on purpose. "Business verification required"
 * with no object reads as arbitrary at the point of contact; naming the action
 * the user just tried to take is the difference between an explanation and a
 * wall.
 */
export const Tier2Notice = ({ reason }: Tier2NoticeProps) => (
  <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
    <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
    <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/90 leading-relaxed">
      Business verification required to {reason}.
    </p>
  </div>
);
