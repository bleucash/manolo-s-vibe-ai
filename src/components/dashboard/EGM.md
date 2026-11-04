# dashboard

## Overview

Venue-manager dashboard panels that are gated on Tier 2 business verification.
`PayoutsPanel` lists unpaid promoter commissions and records settlements.
`StaffCommissionEditor` edits `commission_rate` on active staff. `Tier2Notice` is
the shared blocked-state banner; it owns `BusinessVerificationModal`
(`src/components/BusinessVerificationModal.tsx`), so every gated surface that
renders it gets the same "apply for business verification" path. Verification
state comes from `useVenueVerified(venueId)` (`src/hooks/useVenueVerified`).

## Interface

- `[PayoutsPanel.tsx:PayoutsPanel]` default export, props `{ venueId: string }`.
- `[StaffCommissionEditor.tsx:StaffCommissionEditor]` default export, props
  `{ venueId: string }`.
- `[Tier2Notice.tsx:Tier2Notice]` named export, props
  `Tier2NoticeProps = { reason: string; venueId?: string | null }`.
- Subdirectories: None.

## Invariants

- `[PayoutsPanel.tsx:PayoutsPanel]`, `[StaffCommissionEditor.tsx:StaffCommissionEditor]`
  Gate: `tier2Blocked = !verificationLoading && !isVerified`. When it is true,
  `Tier2Notice` renders and the write control is disabled (Settle button in
  `PayoutsPanel`, rate `Input` in `StaffCommissionEditor`). The write handlers
  (`handleProcessPayout`, `handleUpdateCommission`) do not re-check
  `tier2Blocked`; the client guard is the disabled control only, and RLS is the
  real boundary.
- `[PayoutsPanel.tsx:handleProcessPayout]` The `payout_history` insert does NOT
  end in `.select()` and checks only `error`, so an RLS-filtered insert would
  report success.
- `[StaffCommissionEditor.tsx:handleUpdateCommission]` The `venue_staff` update
  does NOT end in `.select()` and checks only `error`; local state is updated
  optimistically. The rate is clamped with `Math.max(0, Math.min(100, newRate))`.
- `[PayoutsPanel.tsx:fetchData]` Pending tab: an RPC error sets `loadFailed`,
  which renders "Payouts could not be loaded" rather than "All accounts
  settled". History tab: only `data` is destructured, so a failed read shows an
  empty list.
- `[StaffCommissionEditor.tsx:fetchActiveStaff]` Lists only
  `status = 'active'` rows. Null `user_id`s are dropped with `id !== null` before
  the `profiles` lookup. Read errors are ignored, and an empty result does not
  reset existing state.
- `[Tier2Notice.tsx:Tier2Notice]` The "under review" state comes from local
  `submitted` state set by `onSubmitted`, not from a query, so it does not
  survive a reload. The apply button is `disabled={!venueId}`, and
  `BusinessVerificationModal` renders only when `venueId` is truthy.

## Side Effects

- `[PayoutsPanel.tsx:fetchData]` `supabase.rpc("get_unpaid_commissions", { venue_id_input: venueId })`.
- `[PayoutsPanel.tsx:fetchData]` `supabase.from("payout_history")` select
  `*, profiles:promoter_id(display_name, username)`, `.eq("venue_id", venueId)`,
  ordered by `processed_at` descending.
- `[PayoutsPanel.tsx:handleProcessPayout]` `supabase.from("payout_history")` insert
  `{ venue_id, promoter_id, amount, ticket_count }`.
- `[StaffCommissionEditor.tsx:fetchActiveStaff]` `supabase.from("venue_staff")` select
  `id, user_id, commission_rate` with `.eq("venue_id")` and `.eq("status", "active")`;
  then `supabase.from("profiles")` select `id, display_name, username` with `.in("id", userIds)`.
- `[StaffCommissionEditor.tsx:handleUpdateCommission]` `supabase.from("venue_staff")`
  update `{ commission_rate }` with `.eq("id", staffId)`.
- `[Tier2Notice.tsx:Tier2Notice]` No direct I/O. It renders
  `BusinessVerificationModal`, which inserts into `venue_business_applications`
  (documented in `../EGM.md`).
- Sonner toasts on success and failure in both panels. `PayoutsPanel` also
  calls `console.error` on failure (`fetchData`, `handleProcessPayout`).
  `StaffCommissionEditor` never logs: `handleUpdateCommission`'s `catch` only
  toasts, and `fetchActiveStaff` has no `catch`.

## Verification

- Run: `npm run typecheck` (`tsc --build`) and `npm run build` (`vite build`).
  `package.json` has no `test` script.
