# EGM Drift Report, 2026-11-03

Drift check of the 21 `EGM.md` contracts written by the EGM bootstrap on
2026-11-03, compared against the source at `303f0e6` plus those uncommitted
contracts. Each section lists only differences between a contract and the
code; "No drift detected" means the reviewer found none. Read-only reviewers
did the checks, one per group of contracts. Nothing in the code was changed.

## EGM.md

- Missing coverage (ESLint): the contract describes the `**/*.{ts,tsx}` block as "applies to `**/*.{ts,tsx}`, ignores `dist`, turns off `@typescript-eslint/no-unused-vars`, and warns on `react-refresh/only-export-components`". It leaves out several settings in that block. It extends `js.configs.recommended` and `tseslint.configs.recommended` [eslint.config.js:10]. It sets `ecmaVersion: 2020` and `globals.browser` [eslint.config.js:13-14]. It spreads the full `reactHooks.configs.recommended.rules` [eslint.config.js:21]. The react-refresh warning also carries the option `{ allowConstantExport: true }` [eslint.config.js:22].
- Missing coverage (Tailwind): the contract's `[tailwind.config.ts]` bullet lists dark mode, content globs, colour groups, fonts and the plugin. It leaves out several theme settings. The container is centred with `padding: "2rem"` and a `2xl` screen of `1400px` [tailwind.config.ts:8-14]. `borderRadius` is derived from `--radius` [tailwind.config.ts:66-70]. There are custom keyframes and animations: `pulse-neon`, `slide-up`, `pulse-green` and `scan-line`, plus the accordion pair [tailwind.config.ts:71-104]. `prefix` is set to `""` [tailwind.config.ts:6].
- Missing coverage (package.json): the contract only says "`package.json` has no `test` script". That is accurate, but the contract does not list the other scripts: `dev`, `build:dev` (`vite build --mode development`) and `preview` [package.json:7,9,12]. Only `typecheck`, `build` and `lint` appear, under System Verification.

## src/EGM.md

- Wrong detail (child link role): the pages link is described as "[`./pages/EGM.md`](./pages/EGM.md): one component per route." But `src/pages/NotFound.tsx` exists and no route uses it. `App.tsx` imports every other page [src/App.tsx:7-23] but not `NotFound`. The catch-all route redirects instead of rendering a page: `<Route path="*" element={<Navigate to="/discovery" />} />` [src/App.tsx:124].

## src/components/EGM.md

- Wrong detail (ManagerDashboard): the contract says ManagerDashboard does "Select and update `is_active`, `active_at`". The select reads only `is_active` [src/components/ManagerDashboard.tsx:166]. Only the update writes both columns [ManagerDashboard.tsx:185-188].
- Wrong detail (BecomeTalentModal attribution): the contract puts the pending `talent_applications` select inside `handleApply`. That select actually runs in a `useEffect` when the modal opens [src/components/BecomeTalentModal.tsx:32-59]. `handleApply` only does the insert [BecomeTalentModal.tsx:95-103] and, on `23505`, the re-select [BecomeTalentModal.tsx:113-119].
- Wrong detail (TicketPurchaseDialog): the contract says "`[TicketPurchaseDialog.tsx:incrementQuantity]`: quantity is clamped to 1..10." `incrementQuantity` sets only the upper bound, `Math.min(q + 1, 10)` [src/components/TicketPurchaseDialog.tsx:28]. The lower bound of 1 comes from `decrementQuantity`, `Math.max(q - 1, 1)` [TicketPurchaseDialog.tsx:29], which the contract does not mention.
- Missing coverage (guard navigation): the contract's "Route targets" list leaves out two guards:
  - `TalentGuard`: `navigate('/profile')` and `navigate(-1)` [src/components/TalentGuard.tsx:75,83].
  - `DashboardGuard`: `navigate("/discovery")` and `navigate(-1)` [src/components/DashboardGuard.tsx:63,87].
- Missing coverage (external link): the "Browser and navigation" section has no entry for the Instagram link in `BecomeTalentModal`. It points to `https://instagram.com/${VERIFICATION_INSTAGRAM_HANDLE}` and opens with `target="_blank"` [BecomeTalentModal.tsx:207-211].
- Missing coverage (embedded reads): two embedded selects are missing:
  - The `venues` bullet leaves out the `venues (name, location)` embed in the `venue_staff` select in `TalentDashboard.fetchData` [src/components/TalentDashboard.tsx:80].
  - The `profiles` bullet leaves out the `profiles:promoter_id (display_name, username)` embed in the `tickets` select in `ManagerDashboard.fetchDashboardData` [ManagerDashboard.tsx:70].

## src/components/chat/EGM.md

No drift detected

## src/components/dashboard/EGM.md

- Wrong detail (logging): the contract says "Sonner toasts and `console.error` on success and failure in both panels." `StaffCommissionEditor` never calls `console.error`. The catch block in `handleUpdateCommission` only calls `toast.error("Calibration Error")` [src/components/dashboard/StaffCommissionEditor.tsx:55-56]. `fetchActiveStaff` uses `try/finally` and logs nothing [StaffCommissionEditor.tsx:20-42]. `PayoutsPanel` calls `console.error` only on failure, never on success [PayoutsPanel.tsx:48,87].

## src/components/home/EGM.md

No drift detected

## src/components/venue/EGM.md

No drift detected

## src/components/ui/EGM.md

- Wrong detail (chart tooltip): the contract says "`[chart.tsx:ChartTooltipContent]` skips falsy values, so a value of `0` is not shown." The guard is `{item.value && (<span ...>...)}` [src/components/ui/chart.tsx:210-214]. When the value is `0`, that expression evaluates to `0`, which React renders as a plain "0" text node. So zero still shows, just without the styled span. Passing a `formatter` also bypasses the guard entirely, because that branch renders `formatter(...)` instead [chart.tsx:176-177].
- Missing coverage (sidebar): the side effects listed for `SidebarProvider` include the cookie and the `keydown` listener. They leave out the `matchMedia` listener it gets indirectly: `SidebarProvider` calls `useIsMobile()` [sidebar.tsx:6,51], which adds a `window.matchMedia(...)` `change` listener and removes it on cleanup [src/hooks/use-mobile.tsx:9-15]. Other indirect hook effects are listed elsewhere in the contract, for example the toast timers in `@/hooks/use-toast`.

## src/pages/EGM.md

- Wrong detail (scope): `landingPathForRole` appears under "Other top-level symbols. None of them are exported." It is actually a `const` declared inside the `Auth` component body, not at module scope [src/pages/Auth.tsx:9,28-32]. The role-to-path mapping the contract describes is correct.
- Wrong detail (CEODashboard gate): the contract says CEODashboard "disables Approve until the reviewer ticks the per-application `dmConfirmed` box". That holds for venue claims [CEODashboard.tsx:321-324] and talent applications [CEODashboard.tsx:448-451] only. The business-verification "Verify" button calls `handleBusinessApproval(app.venue_id, true)` with no `disabled` prop, and the business card has no `dmConfirmed` checkbox, so it is never gated [CEODashboard.tsx:517-522].
- Wrong detail (Wallet channel cleanup): the contract says "Both remove their channel on unmount." Wallet assigns `channel` only after two awaits, `getSession` and the `tickets` select [Wallet.tsx:31-33,43-48,57]. Its cleanup runs `if (channel) supabase.removeChannel(channel)` [Wallet.tsx:96-99]. So if Wallet unmounts before setup finishes, cleanup finds no channel, and the `"wallet-tickets"` subscription created afterwards is never removed. Notifications does remove its channel every time [Notifications.tsx:25-27].
- Wrong detail (Overview contradicts the contract): the Overview says "Each file default-exports one component that `src/App.tsx` mounts on a route." `NotFound.tsx` default-exports `NotFound` [NotFound.tsx:24], but `App.tsx` never imports it [src/App.tsx:7-23]. The contract notes this exception itself further down, so the Overview sentence conflicts with it.
- Missing coverage (`?next` on sign-up): the contract describes `?next` for login only. The sign-up branch also sends the validated `redirectTo` to Supabase as `options.emailRedirectTo` [Auth.tsx:18,87-91].
- Missing coverage (page navigations): beyond the redirects it already lists, the contract leaves out the in-page navigations:
  - Discovery: `/talent/:id`, `/venue/:id` (via `handleCardClick`) and `/talent-directory` [Discovery.tsx:231,318,321,326-328].
  - Index: `/talent/:id`, `/users/:id` and `/venue/:id` [Index.tsx:168,198,238].
  - Venue: `/dashboard` (the owner's "Operation Control" button), `/discovery` and `/talent/:id` [Venue.tsx:125,160,273].
  - VenueManage: `/discovery` and `/venue/:id` [VenueManage.tsx:175,204,353].
  - TalentProfile: `/venue/:id` [TalentProfile.tsx:168].
  - TalentDirectory: `/discovery` and `/talent/:id` [TalentDirectory.tsx:278,312].
  - Messages: `/` [Messages.tsx:158].
  - Wallet: `/discovery` [Wallet.tsx:140].
  - Bouncer: "Disconnect" goes to `/dashboard` [Bouncer.tsx:177].
  - Mode toggles: Profile's `toggleUserMode` goes to `/talent-manage`, `/venue/manage` or `/profile` [Profile.tsx:104,108,121]. The TalentManage and VenueManage toggles go to `/profile` [TalentManage.tsx:114], [VenueManage.tsx:138].
  - Sign-out: every `signOut` handler navigates to `/auth` [Profile.tsx:127], [TalentManage.tsx:122], [VenueManage.tsx:119].

## src/integrations/EGM.md

No drift detected

## src/integrations/supabase/EGM.md

No drift detected

## src/hooks/EGM.md

No drift detected

## src/contexts/EGM.md

No drift detected

## src/lib/EGM.md

No drift detected

## src/config/EGM.md

No drift detected

## src/types/EGM.md

No drift detected

## supabase/EGM.md

- Wrong detail (venue owner guard): the contract says "Only `service_role` may move an owner to or from NULL `[20261019120000_a46_venue_owner_change_through_null.sql]`". The function enforces that only for a change to NULL. For other callers, its second check fires only when `OLD.owner_id IS NOT NULL`, so a change from NULL to an owner gets through. The code comment says so: "Allow initial claim (NULL -> self) via existing RLS policy" [supabase/migrations/20261019120000_a46_venue_owner_change_through_null.sql:43-46]. The reconciler file agrees [20260901160000_venue_thread_reconciler.sql:163-165]. What stops an ordinary user claiming an unowned venue is the UPDATE policy `USING (auth.uid() = owner_id)` [20260809114940_tier2_business_verification.sql:106], not this trigger. A direct connection is stopped by neither.
- Wrong detail (re-apply guards): the contract says "The files use `IF EXISTS` and `IF NOT EXISTS` guards". Three statements have no guard and would fail if applied a second time:
  - `CREATE POLICY "Talent and managers can post"` has no matching `DROP POLICY IF EXISTS` [20260805000142_posts_insert_talent_manager_only.sql:27-29].
  - `ADD CONSTRAINT interactions_unique_user_target_type` has no prior drop [20260811205552_interactions_dedupe_and_unique.sql:33-35].
  - `ADD COLUMN instagram_handle text` has no `IF NOT EXISTS` [20260802212814_add_instagram_handle_relax_tier2_fields.sql:34].
- Missing coverage (grant list): the "Grant and revoke changes" list leaves out `20260920120000_a1_phase1_venue_read_policies.sql`. That file revokes EXECUTE on `is_active_venue_staff(uuid)` from `PUBLIC` and `anon`, and grants it to `authenticated` and `service_role` [20260920120000_a1_phase1_venue_read_policies.sql:94-96].
- Missing coverage (data-changing list): the list includes the `_diag` drop but not `ALTER TABLE public.messages DROP COLUMN IF EXISTS is_read` [20260902120000_drop_messages_is_read.sql:39], which also destroys data. That drop appears only under Messaging.
- Missing coverage (objects not described): the contract never mentions these:
  - The table `venue_business_applications`, with unique index `venue_business_applications_one_pending_per_venue` and policies "Applicants read own business applications" and "Owners create own pending business applications" [20260809114940_tier2_business_verification.sql:41-81].
  - The policy "Managers insert payouts for verified venues" on `payout_history` [20260809114940_tier2_business_verification.sql:188-195].
  - The policy "Venue managers can view venue followers" on `venue_followers` [20260809171733_fix_venue_followers_manager_policy.sql:27-29].
  - The policy "Users can update their own likes" on `post_likes`, which is the UPDATE path the soft delete depends on [20260811202026_post_likes_soft_delete.sql:35-41].
  - The drop of both overloads of the RPC `update_user_profile` [20260907120000_drop_dead_update_user_profile.sql:50-51].
  - The `venue_claims` schema change: `instagram_handle` added, and `legal_name` and `business_email` made nullable [20260802212814_add_instagram_handle_relax_tier2_fields.sql:34-37].

## supabase/functions/EGM.md

No drift detected

## supabase/functions/admin-actions/EGM.md

- Wrong detail (check order): the contract says "`[index.ts:Deno.serve]` checks `ADMIN_USER_ID`, then the bearer token, then the admin id". The code checks the `Bearer` header first [supabase/functions/admin-actions/index.ts:126-129], then `ADMIN_USER_ID` [index.ts:134-138], then `getUser` [index.ts:140-144].
- Wrong detail (consequence of that order): the contract says "The `ADMIN_USER_ID` check runs before authentication. An unset secret returns `500 "Server misconfigured"` to every caller, authenticated or not." A caller with no `Bearer` header gets `401 Unauthorized` before the secret is read [index.ts:127-128]. The secret check does run before the token is validated with `getUser` [index.ts:136-141].
- Wrong detail (404 list): the contract says "`404` when a claim or venue is not found (`approve_venue_claim`, `revoke_venue_claim`)". In `revoke_venue_claim`, a missing approved claim returns `409` "No approved claim for this venue and account. Nothing was changed." [index.ts:305-307]. Only a missing venue returns 404 there [index.ts:314]. The claim-not-found 404 is only in `approve_venue_claim` [index.ts:171].
- Wrong detail (409 and 500 lists): the contract's 409 list includes "a race that matched zero rows" and says "other `500`s carry the database error message". Several zero-row results instead return `500` with fixed text:
  - the role write in `approve_venue_claim`: "Venue assigned, but no profile matched the claimant. Approve again to finish." [index.ts:246-248];
  - the venue release in revoke: "Any active staff were moved to pending, but the venue was not released..." [index.ts:367-369];
  - the claim mark in revoke: "Venue released, but the claim was not marked revoked..." [index.ts:403-405].

  Other 500s add a prefix to the database message, such as "Claim lookup failed: ", "Role check failed: ", "Venue lookup failed: " and "Claim check failed: " [index.ts:170,183,196,211,304,313].
- Wrong detail (rows-affected invariant): the contract says "the `venue_claims` and `venues` writes in `reject_venue_claim` and `revoke_venue_claim`, end in `.select("id")` and check the count". `reject_venue_claim` writes only `venue_claims` and has no `venues` write [index.ts:272-281]. The `venue_staff` write in `revoke_venue_claim` also ends in `.select("id")`, but its count is never checked; it only feeds `downgraded` [index.ts:351-358]. The contract does not list that write in either group.

## supabase/functions/create-checkout-session/EGM.md

No drift detected

## supabase/functions/stripe-webhook/EGM.md

- Missing coverage (tickets trigger): the contract says "Any triggers on `tickets` are not visible in this file". It also says commission "is `0` when there is no promoter, no matching row, a NULL or zero rate". But `supabase/migrations/20261014120000_a31_venues_column_grants.sql:23-36` describes `calculate_ticket_commission` as "the BEFORE INSERT trigger on tickets". That trigger reads `venues.standard_commission` and sets `commission_earned` to price_paid times `standard_commission` when there is no promoter rate. So the stored `commission_earned` may not be the `0` this function computes [supabase/functions/stripe-webhook/index.ts:80,109]. No repo migration contains the trigger's body; only a31 names and describes it.
- Wrong detail (error-path order): the contract lists "`400 { error: "No signature" }` when the header is missing" and says "The signature is verified before anything else is read". The environment-variable check runs before the signature header is read [index.ts:16-24, 31-34]. With configuration missing, a request with no signature gets `200 { error: "Missing environment configuration" }` from the outer `catch` [index.ts:132-135], not `400`.
- Wrong detail (logging): the contract says the function logs "the promoter id and commission amount on success". That line is logged only when it finds a `venue_staff` row with a truthy `commission_rate` [index.ts:94-98]. The success log written for every ticket contains only the ticket id [index.ts:125].
