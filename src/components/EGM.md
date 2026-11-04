# components

## Overview

Feature components for the Manolo app, plus five subdirectories of narrower
pieces. The files here hold most of the client-side writes for onboarding
(talent applications, venue claims, business verification), the talent and
venue relationship (`venue_staff` requests, invites, approvals, exits, tap-in),
posting and portfolio media, and the manager and talent dashboards. Role, mode,
session and active venue come from `useUserMode()`
(`src/contexts/UserModeContext.tsx`). Shared gates come from `@/hooks`
(`useVenueVerified`, `useVenueStatus`, `useFollow`), `@/lib/roleClaims`,
`@/lib/presence` and `@/config/positions`.

## Interface

Subdirectories:

- [chat](./chat/EGM.md): `ChatWindow`, a presentational thread view that branches on `thread.kind`. No I/O.
- [dashboard](./dashboard/EGM.md): `PayoutsPanel`, `StaffCommissionEditor`, and `Tier2Notice` (the shared Tier 2 banner that owns `BusinessVerificationModal`).
- [home](./home/EGM.md): `EmptyFeedState`.
- [ui](./ui/EGM.md): shadcn/ui primitives, `LoadingState`, and the two toast systems.
- [venue](./venue/EGM.md): `VenuePriceEditor` (`entry_price` and `vip_price`, with a rows-affected check).

Onboarding and verification:

- `[BecomeTalentModal.tsx:BecomeTalentModal]` named, `{ isOpen: boolean; onClose: () => void; onSubmitted?: () => void }`
- `[ClaimVenueModal.tsx:ClaimVenueModal]` named, `{ isOpen: boolean; onClose: () => void; onSubmitted?: () => void }`
- `[ClaimSectorModal.tsx:ClaimSectorModal]` named, `{ venueId: string; venueName: string; isOpen: boolean; onClose: () => void }`
- `[BusinessVerificationModal.tsx:BusinessVerificationModal]` named, `{ isOpen: boolean; onClose: () => void; venueId: string; reason?: string; onSubmitted?: () => void }`

Talent and venue relationship:

- `[RequestToWorkModal.tsx:RequestToWorkModal]` named, `{ venueId: string; venueName: string; isOpen: boolean; onClose: () => void; onSubmitted?: () => void }`
- `[InviteTalentModal.tsx:InviteTalentModal]` named, `{ talent: { id: string; display_name?: string | null; username?: string | null } | null; isOpen: boolean; onClose: () => void }`
- `[ManagerApprovalPanel.tsx:ManagerApprovalPanel]` default, no props. Uses `activeVenueId` from context.
- `[TalentDashboard.tsx:TalentDashboard]` default, `{ userId: string; avatarUrl?: string; displayName?: string }`. Only `userId` is used.

Dashboards and guards:

- `[ManagerDashboard.tsx:ManagerDashboard]` default, `{ userId: string }`. `userId` is unused, and the venue comes from `activeVenueId` in `useUserMode()`. It renders `VenueSwitcher`, a "Command Hub" dialog with tabs `requests` (`ManagerApprovalPanel`), `payouts` (`PayoutsPanel`) and `tools`, plus `Tier2Notice`, `VenuePriceEditor` and `StaffCommissionEditor`.
- `[DashboardGuard.tsx:DashboardGuard]` named, `{ venueId: string; children: React.ReactNode }`
- `[TalentGuard.tsx:TalentGuard]` named, `{ children: React.ReactNode }`
- `[VenueSwitcher.tsx:VenueSwitcher]` named, no props.

Content and media:

- `[CreatePostDialog.tsx:CreatePostDialog]` named, `{ open?: boolean; onOpenChange?: (open: boolean) => void; onPostCreated?: () => void }`
- `[PortfolioUpload.tsx:PortfolioUpload]` named, `{ userId: string; onUploadComplete?: () => void }`
- `[PortfolioGallery.tsx:PortfolioGallery]` named, `{ userId: string; isEditable?: boolean }`
- `[InteractiveHeroReel.tsx:InteractiveHeroReel]` named, `{ entityId: string; entityType: "venue" | "talent"; currentReelUrl?: string | null; fallbackImageUrl?: string | null; isOwner: boolean; onUploadComplete?: (url: string) => void }`
- `[HeroReel.tsx:HeroReel]` named, `{ videoUrl?: string | null; fallbackImageUrl?: string | null; alt?: string; className?: string; autoplay?: boolean }`

Navigation, social and commerce:

- `[BottomNav.tsx:BottomNav]` default, no props.
- `[NavLink.tsx:NavLink]` named, `forwardRef` over react-router `NavLink` that adds `activeClassName` and `pendingClassName`.
- `[ActivitySidebar.tsx:ActivitySidebar]` named, no props. A static placeholder sheet.
- `[FollowButton.tsx:FollowButton]` named, `{ targetId?: string; targetName?: string; userId?: string; className?: string }`. `userId` is an alias for `targetId`, and `targetName` is unused.
- `[TicketPurchaseDialog.tsx:TicketPurchaseDialog]` named, `{ open: boolean; onOpenChange: (open: boolean) => void; venueId: string; venueName: string; price: number; referralId?: string | null }`

## Invariants

Rows-affected discipline. These writes end in `.select("id")` and treat
`!data || data.length === 0` as a refusal; keep them that way:

- `[ManagerApprovalPanel.tsx:handleUpdateStatus]` approve (`update({ status: "active" })`) and reject, cancel or sever (`delete()`). All three of reject, cancel and sever are deletes; `"rejected"` is never written.
- `[InviteTalentModal.tsx:send]` invite insert, and re-invite of an `ignored` row.
- `[TalentDashboard.tsx:handleResponse]` accept or ignore, filtered by `.eq("id").eq("user_id", userId)`.
- `[TalentDashboard.tsx:handleLeave]` exit, a delete by `id`.
- `[TalentDashboard.tsx:handleToggleActive]` tap in and tap out on `profiles`.

These writes check only `error` and would report an RLS-filtered zero-row write
as success:

- `[ManagerDashboard.tsx:handleToggleActive]` (`venues.is_active`, `active_at`). Local state flips anyway.
- `[InteractiveHeroReel.tsx:handleFileUpload]` (`hero_reel_url`)
- `[PortfolioGallery.tsx:handleDelete]` and `[PortfolioUpload.tsx:handleUpload]`
- `[CreatePostDialog.tsx:handleSubmit]` (`posts` insert)
- `[RequestToWorkModal.tsx:handleRequest]`
- `[ClaimVenueModal.tsx:handleClaim]` and `[ClaimSectorModal.tsx:handleClaim]` (`venue_claims` insert)
- `[BusinessVerificationModal.tsx:handleApply]`

`venue_staff` status values written by the client. One row per (venue, user)
(`unique_venue_user_connection`, cited in code comments):

- `[RequestToWorkModal.tsx:handleRequest]` inserts `status: "pending"` with `staff_role` from `GUEST_FACING_POSITIONS`. There is no pre-check; `23505` is shown as "Already Connected".
- `[InviteTalentModal.tsx:useEffect]` pre-checks the existing row before inviting. `pending` sends the manager to `/dashboard` to approve, `pending_talent_action` and `active` show a message only, and `ignored` or no row allows `pending_talent_action`. `23505` is only a race backstop.
- `[TalentDashboard.tsx:handleResponse]` writes `active` or `ignored`. `[ManagerApprovalPanel.tsx:handleUpdateStatus]` writes `active`.

Role, mode and verification gates:

- `[TalentGuard.tsx:checkVerification]` gates on `profiles.role_type === "talent"` read from the DB, not on `mode`. A null result fails closed, though the query `error` is not checked.
- `[DashboardGuard.tsx:DashboardGuard]` gates on venue ownership via `useVenueStatus` (`venues.owner_id === session.user.id`). Order: loading, load failed, pending claim and not owner, owner, else "Access Denied".
- `[BottomNav.tsx:BottomNav]` and `[CreatePostDialog.tsx:useEffect]` branch on `mode` from `useUserMode()`. That is routing and venue-tag selection, not access control. `BottomNav` returns `null` on `/auth`.
- `[ClaimSectorModal.tsx:ClaimSectorModal]` `isManager` (`role_type === "manager"` in context) changes copy only and does not gate the insert.
- `[BecomeTalentModal.tsx:handleApply]` checks `checkOtherTrackConflict(userId, "talent")`, and `[ClaimVenueModal.tsx:handleClaim]` and `[ClaimSectorModal.tsx:handleClaim]` check `checkOtherTrackConflict(..., "manager")`, all from `@/lib/roleClaims`. Each rejects a user already on the other role track.
- Tier 2: `[ManagerDashboard.tsx:ManagerDashboard]` and `[ManagerApprovalPanel.tsx:ManagerApprovalPanel]` compute `tier2Blocked = !verificationLoading && !isVerified` from `useVenueVerified(activeVenueId)` and disable their controls. `[InviteTalentModal.tsx:InviteTalentModal]` has no client Tier 2 check and relies on the server, explaining a zero-row result as "This venue may not be business verified yet". Server side, `[supabase/migrations/20260809114940_tier2_business_verification.sql:venues_require_business_verified]` `RAISE`s on `is_active` or `active_at` changes for unverified venues and never checks `hero_reel_url`.

Presence and tap-in:

- `[CreatePostDialog.tsx:useEffect]` In talent mode it tags a post with a venue only when `isTappedIn(profile)` and `isPresentAt(profile, venue)` from `@/lib/presence` both hold, so a closed venue is never tagged. In manager mode it uses the active venue from context.
- `[TalentDashboard.tsx:handleToggleActive]` Tap-in choices are limited to `status === "active"` affiliations, and turning on requires a selected venue. Whether the venue is open is not checked here; a comment defers the affiliation rule to the `profiles_enforce_check_in` trigger, and a trigger `RAISE` is shown as "Check-In Blocked".

Input validation:

- `[BecomeTalentModal.tsx:handleApply]`, `[ClaimVenueModal.tsx:handleClaim]`: the handle is trimmed, has leading `@` removed, and must be at least 3 characters.
- `[ClaimSectorModal.tsx:handleClaim]`: weaker. It passes any input containing `@` (`!instagram.includes("@") && instagram.length < 3`) and strips only the first `@` without trimming.
- `[CreatePostDialog.tsx:handleFileSelect]`, `[PortfolioUpload.tsx:handleFileSelect]`, `[InteractiveHeroReel.tsx:handleFileUpload]`: `image/*` or `video/*` only, 50MB or less. `CreatePostDialog` requires media because `posts.media_url` is NOT NULL.
- `[TicketPurchaseDialog.tsx:incrementQuantity]` caps quantity at 10 and `[TicketPurchaseDialog.tsx:decrementQuantity]` floors it at 1. The client sends no price.

Known code-level mismatch:

- `[PortfolioUpload.tsx:handleUpload]` writes `portfolio_items.media_url`, but `[PortfolioGallery.tsx:PortfolioGallery]` renders `item.image_url`, a column `portfolio_items` does not have in `src/integrations/supabase/types.ts`.

## Side Effects

Supabase tables, by file:

- `talent_applications`: select the open application's `verification_code, instagram_handle` when the modal opens (`[BecomeTalentModal.tsx:useEffect]`). Insert `{ user_id, instagram_handle, status: "pending" }` with `.select("verification_code").single()`, and re-select the pending code on `23505` (`[BecomeTalentModal.tsx:handleApply]`).
- `venue_claims`: insert `{ user_id, venue_id, instagram_handle, status: "pending" }` (`[ClaimVenueModal.tsx:handleClaim]`, `[ClaimSectorModal.tsx:handleClaim]`).
- `venues`: select unowned `id, name, location` with `.is("owner_id", null)` (`[ClaimVenueModal.tsx:useEffect]`). Select `is_active` (`[ManagerDashboard.tsx:fetchVenueActiveStatus]`), and update `is_active`, `active_at` (`[ManagerDashboard.tsx:handleToggleActive]`). Embedded `venues (name, location)` in the `venue_staff` select (`[TalentDashboard.tsx:fetchData]`). Select `id, name, is_active` (`[CreatePostDialog.tsx:useEffect]`). Update `hero_reel_url` (`[InteractiveHeroReel.tsx:handleFileUpload]`).
- `venue_business_applications`: insert `{ venue_id, user_id, legal_name, business_email, business_phone, position_title, status: "pending" }` (`[BusinessVerificationModal.tsx:handleApply]`).
- `venue_staff`: insert (`[RequestToWorkModal.tsx:handleRequest]`, `[InviteTalentModal.tsx:send]`). Select, update and delete (`[ManagerApprovalPanel.tsx:fetchRequests]`, `[ManagerApprovalPanel.tsx:handleUpdateStatus]`, `[TalentDashboard.tsx:fetchData]`, `[TalentDashboard.tsx:handleResponse]`, `[TalentDashboard.tsx:handleLeave]`). Pending count (`[ManagerDashboard.tsx:fetchPendingCount]`).
- `profiles`: select `role_type` (`[TalentGuard.tsx:checkVerification]`). Select `is_active, current_venue_id` (`[CreatePostDialog.tsx:useEffect]`, `[TalentDashboard.tsx:fetchActiveStatus]`). Update `{ is_active, current_venue_id, active_at }` (`[TalentDashboard.tsx:handleToggleActive]`). Update `hero_reel_url` for talent (`[InteractiveHeroReel.tsx:handleFileUpload]`). Select names and avatars (`[ManagerApprovalPanel.tsx:fetchRequests]`). Embedded `profiles:promoter_id (display_name, username)` in the `tickets` select (`[ManagerDashboard.tsx:fetchDashboardData]`).
- `posts`: insert `{ user_id, media_url, media_type, content, venue_id, is_active: true }` (`[CreatePostDialog.tsx:handleSubmit]`).
- `portfolio_items`: select, count, insert and delete (`[PortfolioGallery.tsx:fetchPortfolio]`, `[PortfolioGallery.tsx:handleDelete]`, `[PortfolioUpload.tsx:handleUpload]`).
- `tickets`: select (`[ManagerDashboard.tsx:fetchDashboardData]`, `[TalentDashboard.tsx:fetchData]`).
- Delegated through hooks, with no call in these files: `followers` via `useFollow` (`[FollowButton.tsx:FollowButton]`), `venues` and `venue_claims` via `useVenueStatus` (`[DashboardGuard.tsx:DashboardGuard]`), and `profiles` with `venue_claims` or `talent_applications` via `checkOtherTrackConflict`.

Storage:

- Bucket `profile-media`: `posts/<uid>/...` (`[CreatePostDialog.tsx:handleSubmit]`) and `portfolio/<uid>/...` (`[PortfolioUpload.tsx:handleUpload]`).
- Bucket `media`: `hero-reels/<type>-<id>-...` (`[InteractiveHeroReel.tsx:handleFileUpload]`).

Realtime (none of these filter by venue; each refetches and is removed on cleanup):

- `"venue_staff_changes"` on `venue_staff` (`[ManagerApprovalPanel.tsx:useEffect]`)
- `"dashboard-refresh"` on `tickets` (`[ManagerDashboard.tsx:useEffect]`)
- `"staff-refresh"` on `venue_staff` (`[ManagerDashboard.tsx:useEffect]`)
- `` `talent-metrics-${userId}` `` on `tickets`, filtered `promoter_id=eq.<userId>` (`[TalentDashboard.tsx:useEffect]`)

Edge function and payments:

- `[TicketPurchaseDialog.tsx:handleConfirmPurchase]` calls `supabase.auth.getSession()`, then a raw `fetch` POST to a hardcoded `https://zfghkkhsdqsrjkbpkujn.supabase.co/functions/v1/create-checkout-session` with a Bearer token and `{ venue_id, price_type: "entry", quantity, referral_id }`, then sets `window.location.href = data.url`. It does not use `supabase.functions.invoke`.

Browser and navigation:

- Clipboard: `[BecomeTalentModal.tsx:handleCopy]` (verification code), `[ManagerDashboard.tsx:handleCopyStaffLink]` (`/venue/<id>/join`), `[TalentDashboard.tsx:handleCopyLink]` (`/auth?ref=<userId>`).
- `window.location.reload()`: `[InteractiveHeroReel.tsx:handleFileUpload]`, `[DashboardGuard.tsx:DashboardGuard]`.
- `localStorage` `activeVenueId` is written indirectly through `setActiveVenueId` (`[VenueSwitcher.tsx:VenueSwitcher]`); the write happens in `UserModeContext`, not here.
- `navigator.vibrate(50)` on long-press (`[InteractiveHeroReel.tsx:handleLongPressStart]`).
- `URL.createObjectURL` previews that are never revoked (`[CreatePostDialog.tsx:handleFileSelect]`, `[PortfolioUpload.tsx:handleFileSelect]`).
- Route targets: `/`, `/discovery`, `/messages`, `/wallet`, `/gigs`, `/dashboard`, `/auth`, `/talent-manage`, `/venue/manage`, `/profile` (`[BottomNav.tsx:BottomNav]`); `/talent-directory`, `/bouncer`, `/notifications` (`[ManagerDashboard.tsx:ManagerDashboard]`); `/dashboard` (`[InviteTalentModal.tsx:renderBody]`); `/profile` and back (`navigate(-1)`) (`[TalentGuard.tsx:TalentGuard]`); `/discovery` and back (`[DashboardGuard.tsx:DashboardGuard]`).
- External link: `https://instagram.com/<VERIFICATION_INSTAGRAM_HANDLE>` in a new tab (`[BecomeTalentModal.tsx:BecomeTalentModal]`).
- Sonner toasts throughout.

## Verification

- Run: `npm run typecheck` (`tsc --build`) and `npm run build` (`vite build`).
  `package.json` has no `test` script.
