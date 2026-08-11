# Manolo AI — Project Memory

Read this before touching anything. It holds decisions and traps that aren't derivable from the code itself. Structure (what a table looks like, what a component does) you can read directly, don't duplicate it here.

## What this actually is

Surface: a nightlife app for guests, talent, and venue managers, launching in Tampa and Atlanta.
Underneath: a venue-operations company. Discovery, feeds, talent profiles are the trojan horse that gets venues onto the platform without selling them cold enterprise software (the OpenTable/SevenRooms fight). Every consumer feature is quietly also data capture for the CRM layer that funds a talent marketplace later. Build order should serve that sequencing, not just feel-good UX.

Launch is intentionally small and hand-gatekept: two cities the owner has real relationships in, talent approved manually, venues seeded from known contacts. Don't automate approval flows prematurely, that's a later phase, not a launch requirement.

## Role model — single source of truth

Three roles only: `guest`, `talent`, `manager`. `role_type` (enum `app_role`) is authoritative.

Live enum currently has 6 values: `manager`, `staff`, `user`, `venue_manager`, `talent`, `guest`. `staff`/`user`/`venue_manager` are cruft. **Full type collapse is deferred, not scheduled**, confirmed live counts (2026-08-02): zero rows hold `staff` or `user`, one row holds `venue_manager`. Recreating the `app_role` type to physically remove unused values would require dropping/recreating `has_role(uuid, app_role)` and `idx_profiles_active_talent` (both depend on the type directly), disproportionate risk on a no-rollback production DB for a purely cosmetic cleanup. Instead: the single `venue_manager` row gets remapped to `manager` (`supabase/migrations/20260802_remap_venue_manager_role.sql`, full rationale in its header comment), the type itself keeps all 6 values, dormant but present. Revisit the full collapse only if a real reason to touch `app_role`'s shape comes up on its own.

`src/contexts/UserModeContext.tsx` hard-codes `role === "manager" || role === "venue_manager"` as its manager check, this is a confirmed, concrete file the enum collapse touches, not theoretical.

The frontend "mode" a user is in (`useUserMode()`) hydrates instantly from `localStorage.getItem("userMode")` on mount for a fast paint, then `syncProfileAndVenues()` overwrites it with the real `profiles.role_type` from the DB moments later. It self-corrects, it's not trusting stale client state long-term. But that brief window before reconciliation is the same loading-race shape as the bugs already fixed in `CEORoute`, `Gigs.tsx`, `TalentGuard.tsx`, `useVenueStatus.ts`, `Dashboard.tsx` (2026-08-02, see Manager onboarding below). This file wasn't part of that pass, put it on the same list as `BottomNav.tsx:16`. `useWorkerPermissions.ts` independently reads the same `localStorage.getItem("userMode")` key for its own separate instant hydration, confirmed via direct file review, same race window, different file, add it to this list too.

**Minor, cosmetic, not a bug:** `CEORoute`/`RequireAuth`/`BouncerRoute` (all in `App.tsx`) and `Dashboard.tsx` share the same loading branch, `<LoadingState fullPage />` from `components/ui/LoadingState.tsx`. `TalentGuard.tsx` hand-rolls its own spinner div instead of using that shared component. Confirmed by direct file comparison, not assumed. Worth conforming next time that file's touched, not worth a detour on its own.

**Back-arrow convention, and two pages still missing one (2026-08-09).** Two conventions coexist deliberately: `navigate(-1)` on detail pages reachable from several entry points (`TalentProfile`, `GuestProfile`, `Gigs`, `Notifications`, now `Venue`), and a hardcoded target where there is exactly one sensible parent (`TalentDirectory` to `/discovery`, `Bouncer` to `/dashboard`). `Venue.tsx` had **no back affordance at all** until it was added; it takes `navigate(-1)` because it is reachable from Discovery, the Index feed's venue tag, and VenueManage's "View Public Profile". **Still open:** `Wallet.tsx` and `Messages.tsx` have the same total absence, not investigated with the same rigor, not fixed. Note `BottomNav` renders on all of these and has a `/discovery` tab, so a missing arrow is a UX gap, not a dead end. Also minor: `TalentManage.tsx` imports `ArrowLeft` and never renders it, dead import, separate cleanup.

- Talent and manager are **mutually exclusive**. A user is never both.
- **Staff is not a role.** It's a relationship, a `venue_staff` row linking a person to a venue. Don't gate features on `role_type = 'staff'`.
- Manager status comes from venue **ownership** (`venues.owner_id`), not a separate flag.

## Two layers of identity, do not conflate

- **What you are** (public, follows the person): `profiles.sub_role`, free text by design, not a rigid enum. Values in use: dancer, DJ, host, promoter. Expect more (bartender, event host, musician) — don't lock this down.
- **What you do at one venue** (operational, tied to the relationship): `venue_staff.staff_role`. This column already exists, don't add a duplicate.
- **Known collision, confirmed still live via direct file review (2026-08-02):** `useWorkerPermissions` computes `isStaffRole` from `role_type === "manager"` OR `sub_role` matching a hardcoded list that includes `"bouncer"`, the exact thing this file argues against, bouncer isn't talent, it's a venue relationship. Correctly out of scope for the `is_verified_*` purge, a separate problem, just confirming it wasn't accidentally fixed along the way. `sub_role` is a discovery label, not a permission source. Permissions belong on the `venue_staff` row. Fix this before building more on top of the hook.
- Bouncer/door access is a link-based invite (intentional, lets venues staff up without app friction). Eventually needs to be venue-scoped, revocable, and expiring. Not urgent, but don't harden it into something permanent-by-default.

## Missing FK constraints — found 2026-08-03, unfixed, logged only

Two columns that look like foreign keys and behave like foreign keys in the code, but have no constraint behind them. Found while verifying the PostgREST embed for the Active Nodes fix, where the FK graph is what the query actually resolves through.

- **`profiles.venue_id` references nothing formally.** `profiles` has both `venue_id` and `current_venue_id`; only `current_venue_id` carries `profiles_current_venue_id_fkey`. `venue_id` has no constraint, so nothing stops it holding a venue id that doesn't exist. It is also invisible to PostgREST, which is the only reason a `venues!inner(...)` embed from `profiles` is unambiguous today. `Index.tsx`'s Active Nodes query names the FK explicitly (`venues!profiles_current_venue_id_fkey!inner`) precisely so that adding an FK to `venue_id` later cannot silently break it.
- **`venues.owner_id` has no FK to `profiles`**, despite ownership being what confers manager status (see role model above). Nothing at the DB level guarantees an owner_id points at a real profile.

Neither is causing a known live bug. Not fixed, deliberately: adding constraints to a production table with existing rows can fail on pre-existing violations, so it needs a data audit first, not a blind `ALTER TABLE`.

## Phantom columns — never re-add without a real migration

These are referenced in old code/docs but do not exist in the live DB: `profiles.is_verified_talent`, `profiles.is_verified_manager`, `venues.verified`, `venue_claims.evidence_link`. A verification system was half-built then reverted on the DB side while frontend kept references. If you see these names anywhere, it's leftover, not spec. All frontend `is_verified_*` references were purged 2026-08-02 (build item 1, commit `415ff0e`) across `TalentGuard.tsx` (the actual gate blocking every talent user from `/gigs`, not just cleanup), `TalentManage.tsx`, `CEODashboard.tsx` (flipped to an honest empty pending-talent state, not a fake populated one), `search-talent.ts`, `get-my-profile.ts`, `database.ts` (correctly left `venues.verified`/`venue_claims.evidence_link` alone), `UserModeContext.tsx`, `useWorkerPermissions.ts`.

`prevent_profile_privilege_escalation` trigger (SECURITY DEFINER, live) is **already patched**, it no longer references `is_verified_talent`/`is_verified_manager`, that fix landed on the live DB at some point without a matching migration file, another instance of the drift this file warns about. Current live body only guards `role_type` and `sub_role` changing, and exempts `auth.role() = 'service_role'`.

**Real, general blocker, confirmed:** `auth.role()` reads `request.jwt.claim.role`, a session setting PostgREST populates per API request. Direct connections, `supabase db push`, psql, any migration, never go through PostgREST, so that setting is never set and `auth.role()` returns `NULL`, not `'service_role'`. **Any migration that updates `profiles.role_type` or `profiles.sub_role` will unconditionally trip this trigger and fail** with "Not authorized to change role_type," regardless of what the actual change is. Not a bug in the trigger, it's doing its job, correctly blocking an un-authenticated-looking write, it just can't tell a migration apart from a malicious client. **Required pattern for any such migration:** wrap the write in `ALTER TABLE profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;` before and `ALTER TABLE profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;` after, in the same migration file. Same pattern already proven safe for `venues_prevent_owner_change` during the venue ownership reset.

**This now applies to `venues` too (2026-08-09).** `venues_require_business_verified` blocks `is_active`, `active_at`, `entry_price`, `vip_price` and `business_verified` unless `auth.role() = 'service_role'`, which a direct migration connection never is. Any future migration touching those five columns needs the same DISABLE/ENABLE wrapper, naming `venues_require_business_verified`.

## Venue claim / two-tier verification

- **Tier 1 (Instagram handshake):** grants presence, profile, hero reel, posting. **Fixed and live (2026-08-02):** `ClaimSectorModal.tsx` now sends `instagram_handle`, real column, no longer the constructed-URL `evidence_link` phantom reference. `CEODashboard.tsx`'s claim card updated to match, `database.ts`'s `VenueClaim` interface now matches the live schema, all 5 real fields, `id` was never the problem. Also discovered and fixed in the same migration: `legal_name` and `business_email` were `NOT NULL` with no default despite belonging to Tier 2, which would have made a Tier-1-only claim structurally impossible even after the column fix, both are nullable now, confirmed via `information_schema` post-migration, not assumed. `business_phone`/`position_title` were already nullable.
- **Tier 2 UI, part (a)+(b) done (2026-08-11), parts (c)+(d) outstanding.** `business_verified` rides along on `UserModeContext`'s existing `userVenues` select (zero new queries) and is read via `useVenueVerified(venueId)`; a querying hook was rejected because all five gated surfaces mount at once for the same venue and would fire the identical lookup five times per dashboard. All five now render a shared `Tier2Notice` and disable their controls when unverified, replacing "fully enabled, then fail at write time". **Every venue is currently unverified (0 of 17), so all five surfaces show blocked right now**, and stay that way until part (c), the filing modal, and part (d), the CEO review tab, ship. Also fixed here: `VenuePriceEditor` was surfacing `err.message` straight to the user, i.e. the raw `venues_require_business_verified` trigger exception. **Approve/reject asymmetry closed (migration `20260811_venue_staff_delete_tier2_gate.sql`):** the Tier 2 pass gated `venue_staff` UPDATE but not DELETE, so on an unverified venue approve was refused by the DB while reject succeeded. Both predicates are now identical. UI disabling is not a substitute for the policy, RLS is the boundary.
- **Tier 2 (business verification) — built and enforced (2026-08-09, migration `20260809_tier2_business_verification.sql`).** The four business columns on `venue_claims` were vestigial: nullable, NULL on every live row, and read/written by nothing. **The earlier note here saying this "needs enforcement, not a schema change" was wrong** and is corrected: there was no Tier 2 state to enforce against, so state had to be built first. Now `venues.business_verified boolean NOT NULL DEFAULT false` is the flag, and `venue_business_applications` (venue_id + user_id NOT NULL, all four business fields NOT NULL, partial unique index one pending per venue, RLS mirroring `talent_applications` plus a venue-ownership requirement on INSERT) is the request queue. `admin-actions`' `approve_business`/`reject_business` set the flag first then close the application, same ordering as `approve_talent`. **No UI exists to file one yet**, the only path to `business_verified = true` today is a direct `admin-actions` call; the collection surface and admin queue tab are a separate piece.
- Business verification is **per-venue**, not per-user. Lives on venues/venue_claims. A manager can be verified for one venue and not another.
- Subscription (`subscription_tier`, `ticketing_enabled`, both unused columns) is a separate gate from verification. Don't conflate "allowed to" with "paid for."

## Live vs verified — resolved, not a conflict

`venues.is_active` + `active_at` is already the correct "doors open right now" toggle. `ManagerDashboard.tsx` and `TalentDashboard.tsx` both flip these together, this is real, working code, not a gap. Don't add a second "live" column. The actual gap is that Tier 2 verification doesn't yet gate who can touch this toggle.

**Naming collision, not a logic conflict:** `is_active` exists as a column on three separate tables with three separate meanings. `venues.is_active` (venue open tonight, set by manager via `ManagerDashboard.tsx`, paired with `active_at`), `profiles.is_active` (talent personally checked in as live at `current_venue_id`, set by the talent via `TalentDashboard.tsx`, paired with `current_venue_id` + `active_at`), and `posts.is_active` (soft-delete/visibility flag, not written anywhere in `src/` currently, likely vestigial). `mode` (the frontend guest/talent/manager label) is unrelated to all three, never persisted, it just gates access to the toggles.

**Real bug, confirmed:** `venues.is_active` and `profiles.is_active` are independently maintained with no constraint or trigger tying them together, but `Discovery.tsx` renders both through the identical `<ActiveBadge />` as if they're one signal (`venue.is_active && <ActiveBadge />`, `talent.is_active && <ActiveBadge />`). Nothing stops a talent's live badge from showing at a venue that's already closed for the night, or surviving after they've left. Fix direction: either derive talent "live" as `is_active AND current_venue_id's venue is also is_active` at query time, or a trigger that clears a talent's `is_active` when their venue goes inactive. Not yet fixed, not yet scheduled.

## Active Nodes — closed (2026-08-09, verified end to end)

`Index.tsx`'s `fetchActiveNodes` used to query `profiles` where `role_type = 'talent'` limit 6 with no `is_active` filter at all, so the guest-facing row showed six arbitrary talent regardless of whether anyone was active anywhere. Now a talent appears only if `profiles.is_active` is true AND their `current_venue_id` points at a venue that is itself `is_active`. Commit `851a3e2`.

**The venue condition is an inner join, not a JS filter**, so closed-venue rows are excluded by the query. The FK is named explicitly (`venues!profiles_current_venue_id_fkey!inner`) rather than the short `venues!inner`; full reasoning is in the code comment and in Missing FK constraints above, short version: only `current_venue_id` carries an FK today, and that alone is what makes the short form unambiguous.

**Scope limitation, deliberate:** this query only ever touches `profiles` filtered to `role_type = 'talent'`. **Venues can never appear as Active Nodes**, whatever their own `is_active` state. Venue nodes would be a separate query and a separate design decision, not a filter tweak here.

**Verified end to end (2026-08-09), both directions**, using `moneymachine@gmx.com`, who holds active `venue_staff` affiliations at two venues in opposite states. Checked in at **Tangra** (`is_active = true`) the node renders on Home; checked in at **The Ritz Ybor** (`is_active = false`) it does not.

**Scope correction:** this closes the badge-desync failure mode for Home's Active Nodes row only. `Discovery.tsx`'s two talent badges (`talent.is_active && <ActiveBadge />` at lines 70 and 111) are a separate, untouched surface, both render straight off a query that selects `current_venue_id` but never joins `venues` or filters on venue state, so a talent can still show active on Discovery after their venue closes. See "Live vs verified" above, that bug is still open. (`venue.is_active && <ActiveBadge />` at line 92 is the venue's own badge, self-referential, not part of this failure mode.)

**"Live" is being renamed to "Active" everywhere, deliberately, for extensibility.** Decided in an earlier session per the owner. **Sequenced before build item 6**, which touches the Live toggle surface directly, so renaming afterward would mean touching it twice.

**Still open, deliberately out of scope for this fix:** styling and timing Active Nodes like Instagram Stories, meaning time-boxed with an expiry rather than a static list. Duration undecided, needs its own discussion. `active_at` already exists on both `profiles` and `venues`, set by `TalentDashboard.tsx`/`ManagerDashboard.tsx` when the toggle flips, that's the groundwork an expiry window computes against, no new column needed.

**Open idea, guest-facing batch:** blank space instead of skeleton loaders while the node row resolves, so an empty result reads as "nothing happening tonight" rather than "still loading."

## Accepted risk: nothing prevents a user holding a pending talent application AND a pending venue claim

`talent_applications` and `venue_claims` are separate tables with no cross-check, so one user can have an open row in both at once even though talent and manager are mutually exclusive. If both were approved, the second approval silently overwrites the first's `role_type`. **Accepted at launch scale (2026-08-03):** every approval is manually reviewed by one person who would notice. Not fixed. Revisit when approval is delegated or automated, which is exactly when nobody is eyeballing both queues anymore. Fix direction if needed: have each approve path reject the competing pending row, or a constraint spanning both.

**Separate pre-existing bug found while mirroring (`venue_claims` only, unfixed):** `unique_venue_claim UNIQUE (venue_id, status)` permits only one row per (venue, status) pair, so a venue can never have two rejected claims. Once one applicant is rejected for a venue, a second applicant's rejection fails. `talent_applications` deliberately does NOT copy this shape, it uses a partial unique index on `(user_id) WHERE status = 'pending'` instead, which allows re-application after rejection.

## Talent onboarding — closed (2026-08-03, verified end to end 2026-08-07)

Request-and-approve, manually reviewed at launch. `talent_applications` (migration `20260803_talent_applications.sql`: `user_id`, `instagram_handle`, `status`) via **Become Talent** in `Profile.tsx`'s "Neural Link Management" card, guest-only by construction since talent/manager modes redirect away from that page. `BecomeTalentModal.tsx` inserts; `CEODashboard.tsx` approves via `admin-actions`'s `approve_talent`/`reject_talent`, which write `role_type` first, then close the application row, deliberately in that order, a failed second write leaves "approved but still shows pending," not a silently dropped applicant. Commit `78dfaa9`.

**Duplicates blocked mainly at the UI:** the button disables to "pending" once one is open. Backing index is `talent_applications_one_pending_per_user ON (user_id) WHERE status = 'pending'`, allows re-application after rejection, deliberately unlike `venue_claims` (see Accepted risk above). Modal's `23505` handler is a race backstop only. **Verified against production (2026-08-07):** real signup → apply → CEO approves → both writes land (`role_type` + `status`), test rows deleted cleanly, both cascade hops reconfirmed (`profiles`→`auth.users`, `talent_applications`→`profiles`). Scale path later: threshold/bio-verification automation, then delegate approval to trusted venues, don't skip straight to automation at launch.

**Still open:** `instagram_handle` correctly stores a bare handle here, but `ClaimSectorModal.tsx`'s validation (`!instagram.includes("@") && instagram.length < 3`) wrongly lets a bare `"@"` pass.

## Manager onboarding — closed (2026-08-02)

All three legs land: `ClaimSectorModal.tsx` sends `instagram_handle`, a real column (commit `3fcea79`); `CEODashboard.tsx`'s approval UI was always correctly wired, just starved by that; `Dashboard.tsx` now renders `DashboardGuard` → `ManagerDashboardPanel` → `ManagerDashboard.tsx` instead of a fake stub for every owner (commit `25725bb`). **Consequence worth knowing:** `ManagerDashboard.tsx` has no `venueId` prop, it reads `activeVenueId` from `useUserMode()`. `ManagerDashboardPanel` syncs the URL's venue id into that context on mount, only after `DashboardGuard` confirms ownership, so visiting `/dashboard/:id` persists that venue as active everywhere (`VenueSwitcher`, bare `/dashboard`, `localStorage`) until manually switched. `userId` prop on `ManagerDashboard.tsx` is unused, harmless.

## CEO/admin identity: three disconnected mechanisms, none aware of the others

Confirmed live (2026-08-03):

1. **`CEORoute` (App.tsx):** client-side, gates `/ceo` on `session.user.email === "jbray131@gmail.com"`. Hardcoded, knows nothing about `role_type` or the edge function secret.
2. **`admin-actions` edge function:** server-side, the real boundary, gates on `auth.users.id === ADMIN_USER_ID` (secret). Was silently broken until 2026-08-03, the secret held a stale id that didn't match the CEO's real `auth.users.id` (`329ee81b-17a7-45b2-9729-0575d3d7063f`). Every approval attempt had been returning 403 behind a generic "Handshake Error" toast.
3. **`profiles.role_type`:** the CEO account has **no `profiles` row at all**, so every role-based path treats it as a guest with no profile, hence "Verified Role Required" on `/profile`. Not a gap, there's literally no row.

A change to any one does nothing to the other two. **Decided (2026-08-03, owner): admin status stays outside `role_type` permanently.** No fourth enum value, no admin flag on `profiles`. `role_type` describes product identity (guest/talent/manager); admin is operational, folding it in would make every role-based path a potential privilege path. **Accepted risk:** no automatic sync check between the email and the secret, that exact desync is what silently broke approvals. Revisit only if the admin surface grows beyond one person. CEO may still get a plain `profiles` row as a guest for app usability, unrelated to admin status.

## Manager mode + zero owned venues — fixed (2026-08-03)

A `mode === "manager"` user owning no venue (between submitting a Tier 1 claim and approval) used to bounce forever between `/profile` and `/venue/manage`, `toast.error` firing every cycle. Pre-existing, not introduced by items 1-3 (confirmed via `git log`), just never reachable before a manager account worked end to end. Fixed in `VenueManage.tsx` only (`Profile.tsx` untouched): that branch renders one of two stable screens instead of redirecting, a self-scoped query for the user's most recent pending claim shows either "claim under review" naming the venue, or "no sector claimed" routing into Discovery. Killing the redirect on this side alone breaks the cycle, `Profile.tsx` has nothing left to ping-pong against.

## Profiles auto-creation — closed (2026-08-03)

Every signup used to land profile-less, zero triggers on `auth.users`, `Auth.tsx` calls only `signUp()`. The CEO's missing row was a symptom, not a special case. Fixed by `handle_new_user()` + `on_auth_user_created` trigger, migration `20260803_handle_new_user_trigger.sql`, commit `4e13ba4`. Verified via real signup, not just trigger existence, row created with `role_type: guest` and schema defaults, cascade confirmed on cleanup (`profiles_id_fkey ON DELETE CASCADE`).

**Inserts only `id`, deliberately.** `Auth.tsx` sends no `options.data`. Deriving a username from email is unsafe here, `profiles.username` is `UNIQUE`, so `info@a.com` vs `info@b.com` collide, and a unique violation inside an `AFTER INSERT` trigger aborts the signup transaction entirely. Also `profiles` SELECT is `USING (true)`, so an email-derived username would leak part of every email. **Richer defaults belong in `Auth.tsx`'s `options.data`, not guessed in SQL.** `ON CONFLICT (id) DO NOTHING` keeps it idempotent (a signup for an already-patched id, like the CEO's, would otherwise PK-violate and block that signup). No exception handler on purpose, silent swallowing is how profile-less users accumulated unnoticed before, this fails loudly instead.

**Closed (2026-08-09, migration `20260809_set_search_path_on_role_helpers.sql`):** `has_role()`/`has_role_type()` were SECURITY DEFINER with no `search_path`, the last two outliers. `has_role_type` was the real surface, its body selects `from profiles` unqualified, so with no path pinned it resolved against the caller's `search_path` while gating `posts` INSERT. `has_role` selects `from public.profiles`, qualified, so it was only exposed via operator/cast resolution. Both now carry `{search_path=public}`, confirmed via `pg_proc.proconfig`. Applied with `ALTER FUNCTION ... SET` rather than `CREATE OR REPLACE`, so neither body was restated, verified unchanged afterward. Neither function has a `CREATE FUNCTION` in this folder, both were made directly against the live DB, same drift as `prevent_profile_privilege_escalation`.

## Following — built for talent, not for venues

Confirmed live: `useFollow.ts` + `FollowButton.tsx`, renders on `Discovery.tsx`, `GuestProfile.tsx`, `TalentProfile.tsx`, writes to `followers`. `Index.tsx`'s Home feed already builds on top of it via `fetchFollowerFeed`. This was previously misdescribed in a chat session as dead code, it is not, that was a bad grep pattern searching for a table literally named `follows` instead of the real name.

**Venue follow — write path built (2026-08-09).** `venue_followers` was read-only: Discovery read it into `followedVenues`, nothing ever wrote. Schema, constraints, indexes and all six RLS policies were already correct and complete, so this was a wiring job, not a schema one. `useFollow.ts` is now parameterized by `FollowTarget` (`"talent"` → `followers`/`following_id`, `"venue"` → `venue_followers`/`venue_id`), defaulting to `"talent"` so the three existing callers are untouched. It also exports `writeFollow()`, the raw insert/delete, because Discovery loads every follow in **one batched query** and mounting a hook per card would turn that into one query per card.

**The wiring bug that mattered, and would have passed review:** both Discovery cards were `<div onClick={onFollow}><FollowButton onClick={e => e.stopPropagation()} /></div>`. The button's `stopPropagation` fires before the event reaches the wrapper, so `onFollow` could never run. Simply passing the missing prop at the call sites would have produced a button that still did nothing. `stopPropagation` now lives on the wrapper (still blocking the card's `onNavigate`) and the button calls `onFollow` directly.

**Naming collision, unresolved, flagged only:** `Discovery.tsx` defines its own local `FollowButton` (an icon-only `+`/`−` toggle) that is a completely different component from `@/components/FollowButton` (the labelled Follow/Following button used on profile pages). Same name, same repo, different props and behaviour. Not touched in this pass. Worth renaming the local one when that file is next opened.

## Charge / Heat / Spotlight

- **Live today:** `get_talent_spotlight` RPC (migration `20260331_create_talent_spotlight_rpc.sql`) ranks talent by a raw lifetime `COUNT(*)` of `post_likes`, gated on `is_active = true`. **No decay.** Whoever got hot first stays on top forever, this contradicts the product's own "always feels fresh" premise.
- Two disconnected "charge" pathways exist: Home page's "Charge Node" button writes to `post_likes` (this is what actually feeds the spotlight). Discovery's own charge button writes to a separate `interactions` table that **nothing reads**. It currently does nothing. Either wire it in or remove it, don't leave it as dead UI.
- **Target v2 spec** (recovered from a prior session, not yet built): gravity-decay model, `score = Σ 1/(hours_since_charge + 2)^1.5`, 12-hour contribution cutoff, dedicated `post_charges` table, `charge_count` on posts, `heat_score` on both `venues` and `profiles` (spotlight currently only covers talent, docs describe venue spotlight too, never built), scheduled recalculation via RPC/cron. Full SQL for this exists in project history if asked to implement.
- `posts.expires_at` already exists as a column, likely the intended mechanism for feed-visibility fade (separate concept from heat-score decay, don't merge them, one is UI freshness, one is ranking math).
- **Two charge touchpoints are intentional, not redundant (owner, 2026-08-07):** Home feed charging a post feeds Talent Spotlight, the live path above. Discovery charging a venue/talent card directly, without requiring a follow, is meant to feed a separate score, most likely venue `heat_score`. Exact formula and the split between the two is undecided, owner has flagged this needs its own dedicated session, don't guess at it.
- **Heat score's purpose (owner, 2026-08-07):** highlight venues actively posting engaging content, more engagement drives more heat, higher heat surfaces a venue first on Discovery. Confirms the `heat_score` intent already described in the v2 spec above, still not built.

## Guest posting — deferred, not gated

**Decision:** guests do not post at launch. Full stop, not conditionally. Ticketing (see below) is also not launching, so the presence-based gating ideas (ticket scan-in, geofencing) discussed earlier don't apply yet, there's nothing to gate against.

**Enforced at the DB (2026-08-03, migration `20260803_posts_insert_talent_manager_only.sql`).** `posts` INSERT is now `auth.uid() = user_id AND (has_role_type(auth.uid(),'talent') OR has_role_type(auth.uid(),'manager'))`. It replaced "Authenticated users can post", which was self-scoped but had no role check at all, so any guest could post. RLS was already enabled on `posts` (unlike `venue_claims`), so this swapped a policy rather than turning security on. Preemptive: nothing in the repo inserts into `posts` yet (`CreatePostDialog.tsx` is still a `setTimeout` stub), so nothing changed behaviorally. Role check goes through the SECURITY DEFINER `has_role_type()` helper, not a subquery on `profiles`: `profiles` SELECT is `USING (true)` today so a subquery would work, but it would silently deny every insert if anyone ever tightened that. Verified post-run via `pg_policies` + `relrowsecurity`.

`venues` has no latitude/longitude columns at all. Geofencing is not buildable today regardless of the above, would need new columns plus a geocoding pass on existing addresses.

## Ticketing — infrastructure exists, feature is withheld

Stripe, QR generation, `check_in_guest` (SECURITY DEFINER), `tickets.scanned_at` all exist and work. **Do not surface ticket purchasing in the shipped UI.** Keep the wiring dormant, don't strip it, this flips on later without a rebuild. Don't let "the wiring already exists" become a reason to ship it early, that was an explicit correction from the owner.

## Messaging — decided, not built

Talent and managers message freely into anyone's inbox (business context). Guests can message anyone, but land in a request queue unless the recipient follows them back, Instagram's model, filter lives on the receiving end, not a follow-to-unlock gate (a follow-gate is trivially bypassed by just following first). Currently only conversation membership is checked, none of this exists yet.

**Refinement (owner, 2026-08-07):** managers should be exempt from the follow-required friction on the receiving end. A guest messaging a manager should reach them directly, businesses don't want friction turning away potential customers. Talent likely still wants the filter. Not built either way yet.

## RLS / security state (as of last audit)

**Closed, confirmed dropped and verified:** open insert on `venue_staff`, unscoped "Managers can scan all tickets" policy, direct venue-claim bypass policy.

**`venue_claims` RLS — closed (2026-08-03).** Had no row security at all (`relrowsecurity` false, zero policies), any authenticated user could read every claim's Tier 2 PII, or self-approve by flipping `status`. Now: RLS enabled, SELECT `user_id = auth.uid() OR is_admin()`, INSERT `user_id = auth.uid() AND status = 'pending'` (status predicate is load-bearing, without it a claimant inserts pre-approved). **No UPDATE/DELETE policy, deliberately** — approve/reject runs through `admin-actions` on the service role key, bypassing RLS, so no matching policy means every client write denies by default. Migration `20260803_venue_claims_rls.sql`.

**`is_admin()` is a third copy of the admin identity.** RLS can't see the `ADMIN_USER_ID` secret and admin isn't in `role_type`, so the JWT email claim (same mechanism as `CEORoute`) is the only in-DB signal, this helper just keeps that email in one place instead of inline per policy. Widens the accepted email/secret desync risk to three copies. Deliberate, logged.

**Pulled live from `pg_policies` 2026-08-09, three findings. 1 and 2 fixed by `20260809_tier2_business_verification.sql`, 3 partially.** Read live policies before designing against these tables, local migration files do not reflect current state.

1. **Fixed.** `payout_history` had exactly one policy, SELECT, and no INSERT policy, so `PayoutsPanel`'s `.insert()` was denied by RLS and failing silently (the code never checks the returned error, so the button lied). Now has an owner-scoped INSERT policy additionally gated on `business_verified`. That write works for the first time as of this migration.
2. **Fixed.** `venues`' "Managers can update their own venue" and `venue_staff`'s "Managers update venue staff" both had `USING` with no `WITH CHECK`, letting a caller who passed the check rewrite the row to anything, including moving `venue_id` to a venue they don't own. Both now carry matching `WITH CHECK`. **The general trap, still worth remembering:** permissive policies OR together, so a stricter sibling policy never saves you, the loosest one wins.
3. **Partially fixed.** `venue_staff`'s two duplicate manager UPDATE policies are now one gated policy (gating only one would have been theatre, the other stayed open). **Still open:** both tables carry a `qual: true` SELECT that makes every narrower SELECT beside it inert and every row world-readable, and `venue_staff` still has two exact-duplicate talent-self UPDATE policies. `venue_followers` belongs in this bucket too: it carries a redundant `FOR ALL` policy ("Users can manage their venue follows") overlapping its separate INSERT/DELETE/SELECT policies, plus its own `qual: true` SELECT. Deliberately left alone 2026-08-09. Same class as the ticket-policy duplication below.

**Related, explains a live dead end:** the "open insert on `venue_staff`" dropped above was never replaced, so there is no INSERT policy on `venue_staff` at all. Combined with `/venue/:id/join` not existing as a route in `App.tsx` (though `ManagerDashboard` generates invite links pointing at it), there is currently **no working path to create a `venue_staff` row**. Existing rows predate the fix.

**`venue_followers` manager-view policy — fixed (2026-08-09, migration `20260809_fix_venue_followers_manager_policy.sql`).** The earlier note here described a "`venue_followers` status mismatch, three inconsistent values in live use"; **that was wrong. `venue_followers` has no status column at all.** The real mechanism: its "Venue managers can view venue followers" policy depended on `venue_staff.status = 'approved'`, a value nothing writes (live data holds only `'active'`; ManagerApprovalPanel writes `'active'`, TalentDashboard writes `'active'`/`'ignored'`). It also keyed off `venue_staff` membership rather than `venues.owner_id` like every other manager policy, so an owner without a staff row of their own saw nothing regardless. Both defects fixed at once, now `venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid())`. The conclusion in the old note (managers had never seen followers) was correct; only the stated cause was wrong.

**Still open, drafted but not run:** `posts` missing UPDATE/DELETE (can't delete own posts), 15 duplicate/overlapping ticket policies, possible recursive RLS on `conversation_participants` SELECT (unverified).

## Hard operating rules

- Schema lives in the live DB, not in migrations (migrations only hold RLS/triggers/RPCs). No rollback, no staging, dev happens against production. Be careful.
- **Never run schema or policy changes without the owner reading the SQL first**, except pre-approved critical security fixes.
- Supabase client has no `Database` generic, everything is untyped, schema drift isn't caught at compile time. Fixing this is recommended, still pending.
- Never fabricate unverified content or claims. If something's unclear, say so.
- No em dashes in any output, ever.
- **Diagnostic calls can be mutations (2026-08-03, learned live):** `admin-actions` authenticates and acts in one request, there is no dry-run mode. During the ADMIN_USER_ID fix, "re-run the same call to confirm the 403 is gone" WAS the real approval write, executed without an explicit go-ahead for that specific write, and that was only noticed from the `{"ok":true}` response. Outcome happened to be the intended one, verified after the fact, but the order was wrong. Rule: before re-running any call for diagnostic purposes, state whether it's read-only or mutating, and if mutating, get the go-ahead for the write itself, not just for "checking." Applies to anything that both authenticates and acts in one request.

## Build order (dependency-driven)

1. **Closed (2026-08-02).** Purge phantom `is_verified_*` references, app-code side (file list in Phantom columns above); enum collapse deferred, only the one `venue_manager` row remapped (Role model above). `useWorkerPermissions.ts` still carries its separate `sub_role`-as-permissions collision and hydration race, never this item's job. Commit `415ff0e`.
2. **Closed (2026-08-02).** Claim modal field fix, see Tier 1 note above. Commit `3fcea79`.
3. **Closed (2026-08-02).** `Dashboard.tsx` wired to `ManagerDashboard`, see Manager onboarding above. Commit `25725bb`.
4. **Closed (2026-08-03, verified end to end 2026-08-07).** Talent onboarding, application + approve path, see Talent onboarding above. Commit `78dfaa9`.
5. **Closed (2026-08-03).** `posts` INSERT locked to talent/manager, see Guest posting above. Commit `ec81999`.
6. **Closed (2026-08-09).** Tier 2 business verification, state plus enforcement, see Tier 2 above. Gated via trigger on `venues` (column granularity, RLS is row-level and would have broken Tier 1 hero reel) and via policy on `venue_staff`/`payout_history`. Migration `20260809_tier2_business_verification.sql`. **UI to file an application is not built**, that surface is still outstanding.
7. Rebuild spotlight with real decay, extend to venues, resolve the orphaned Discovery charge button.
8. Messaging follow-gate.
