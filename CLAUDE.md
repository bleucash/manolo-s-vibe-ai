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

- Talent and manager are **mutually exclusive**. A user is never both.
- **Staff is not a role.** It's a relationship, a `venue_staff` row linking a person to a venue. Don't gate features on `role_type = 'staff'`.
- Manager status comes from venue **ownership** (`venues.owner_id`), not a separate flag.

## Two layers of identity, do not conflate

- **What you are** (public, follows the person): `profiles.sub_role`, free text by design, not a rigid enum. Values in use: dancer, DJ, host, promoter. Expect more (bartender, event host, musician) — don't lock this down.
- **What you do at one venue** (operational, tied to the relationship): `venue_staff.staff_role`. This column already exists, don't add a duplicate.
- **Known collision, confirmed still live via direct file review (2026-08-02):** `useWorkerPermissions` computes `isStaffRole` from `role_type === "manager"` OR `sub_role` matching a hardcoded list that includes `"bouncer"`, the exact thing this file argues against, bouncer isn't talent, it's a venue relationship. Correctly out of scope for the `is_verified_*` purge, a separate problem, just confirming it wasn't accidentally fixed along the way. `sub_role` is a discovery label, not a permission source. Permissions belong on the `venue_staff` row. Fix this before building more on top of the hook.
- Bouncer/door access is a link-based invite (intentional, lets venues staff up without app friction). Eventually needs to be venue-scoped, revocable, and expiring. Not urgent, but don't harden it into something permanent-by-default.

## Phantom columns — never re-add without a real migration

These are referenced in old code/docs but do not exist in the live DB: `profiles.is_verified_talent`, `profiles.is_verified_manager`, `venues.verified`, `venue_claims.evidence_link`. A verification system was half-built then reverted on the DB side while frontend kept references. If you see these names anywhere, it's leftover, not spec.

`prevent_profile_privilege_escalation` trigger (SECURITY DEFINER, live) is **already patched**, it no longer references `is_verified_talent`/`is_verified_manager`, that fix landed on the live DB at some point without a matching migration file, another instance of the drift this file warns about. Current live body only guards `role_type` and `sub_role` changing, and exempts `auth.role() = 'service_role'`.

**Real, general blocker, confirmed:** `auth.role()` reads `request.jwt.claim.role`, a session setting PostgREST populates per API request. Direct connections, `supabase db push`, psql, any migration, never go through PostgREST, so that setting is never set and `auth.role()` returns `NULL`, not `'service_role'`. **Any migration that updates `profiles.role_type` or `profiles.sub_role` will unconditionally trip this trigger and fail** with "Not authorized to change role_type," regardless of what the actual change is. Not a bug in the trigger, it's doing its job, correctly blocking an un-authenticated-looking write, it just can't tell a migration apart from a malicious client. **Required pattern for any such migration:** wrap the write in `ALTER TABLE profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;` before and `ALTER TABLE profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;` after, in the same migration file. Same pattern already proven safe for `venues_prevent_owner_change` during the venue ownership reset.

## Venue claim / two-tier verification

- **Tier 1 (Instagram handshake):** grants presence, profile, hero reel, posting. **Fixed and live (2026-08-02):** `ClaimSectorModal.tsx` now sends `instagram_handle`, real column, no longer the constructed-URL `evidence_link` phantom reference. `CEODashboard.tsx`'s claim card updated to match, `database.ts`'s `VenueClaim` interface now matches the live schema, all 5 real fields, `id` was never the problem. Also discovered and fixed in the same migration: `legal_name` and `business_email` were `NOT NULL` with no default despite belonging to Tier 2, which would have made a Tier-1-only claim structurally impossible even after the column fix, both are nullable now, confirmed via `information_schema` post-migration, not assumed. `business_phone`/`position_title` were already nullable.
- **Tier 2 (business verification):** `legal_name`, `business_email`, `business_phone`, `position_title` already exist on `venue_claims`. Grants operations: the Live/`is_active` toggle, staff approval, commission rates, prices, payouts. **Nothing currently gates access to these behind Tier 2.** Any owner can flip Live right now regardless of verification. Needs enforcement, not a schema change.
- Business verification is **per-venue**, not per-user. Lives on venues/venue_claims. A manager can be verified for one venue and not another.
- Subscription (`subscription_tier`, `ticketing_enabled`, both unused columns) is a separate gate from verification. Don't conflate "allowed to" with "paid for."

## Live vs verified — resolved, not a conflict

`venues.is_active` + `active_at` is already the correct "doors open right now" toggle. `ManagerDashboard.tsx` and `TalentDashboard.tsx` both flip these together, this is real, working code, not a gap. Don't add a second "live" column. The actual gap is that Tier 2 verification doesn't yet gate who can touch this toggle.

**Naming collision, not a logic conflict:** `is_active` exists as a column on three separate tables with three separate meanings. `venues.is_active` (venue open tonight, set by manager via `ManagerDashboard.tsx`, paired with `active_at`), `profiles.is_active` (talent personally checked in as live at `current_venue_id`, set by the talent via `TalentDashboard.tsx`, paired with `current_venue_id` + `active_at`), and `posts.is_active` (soft-delete/visibility flag, not written anywhere in `src/` currently, likely vestigial). `mode` (the frontend guest/talent/manager label) is unrelated to all three, never persisted, it just gates access to the toggles.

**Real bug, confirmed:** `venues.is_active` and `profiles.is_active` are independently maintained with no constraint or trigger tying them together, but `Discovery.tsx` renders both through the identical `<ActiveBadge />` as if they're one signal (`venue.is_active && <ActiveBadge />`, `talent.is_active && <ActiveBadge />`). Nothing stops a talent's live badge from showing at a venue that's already closed for the night, or surviving after they've left. Fix direction: either derive talent "live" as `is_active AND current_venue_id's venue is also is_active` at query time, or a trigger that clears a talent's `is_active` when their venue goes inactive. Not yet fixed, not yet scheduled.

## Talent onboarding — doesn't exist, needs building

No path today for a user to request talent status. Design: application with Instagram handle, status field (pending/approved/rejected), manually approved at launch (owner reviews, same pattern as venue claims). Wire it to `admin-actions`'s `approve_talent` action, which already writes `role_type: "talent"` correctly, it just has nothing feeding it. Scale path later: threshold/bio-verification automation, then delegate approval to trusted venues. Don't skip straight to automation at launch.

## Manager onboarding — closed (2026-08-02)

All three legs now land. (1) `ClaimSectorModal.tsx` sends `instagram_handle`, a real column, commit `3fcea79`. (2) `CEODashboard.tsx`'s approval UI was always correctly wired, just starved by (1), untouched. (3) `Dashboard.tsx` no longer stubs a fake page for every owner regardless of anything, it's `DashboardGuard` wrapping a small `ManagerDashboardPanel` that renders `ManagerDashboard.tsx` (previously orphaned, now live), commit `25725bb`.

Two things folded into that same fix, both real, neither a bug: `ManagerDashboard.tsx` takes no `venueId` prop, it reads `activeVenueId` from `useUserMode()` context directly, so `/dashboard/:id` (a specific venue) and bare `/dashboard` (whatever's active) needed reconciling. Resolved by syncing the URL's venue id into `activeVenueId`, but only from inside `ManagerDashboardPanel`, which `DashboardGuard` only mounts after ownership already resolved true, a user who doesn't own the venue never causes that sync to fire. Consequence worth knowing: visiting `/dashboard/:id` persists that venue as active everywhere, `VenueSwitcher`, bare `/dashboard`, `localStorage`, not just this route, until the manager switches again. `ManagerDashboard.tsx`'s `userId` prop is still passed in, still unused internally, harmless, not worth a separate fix.

## CEO/admin identity: three disconnected mechanisms, none aware of the others

Confirmed live (2026-08-03), all three verified directly, not inferred:

1. **`CEORoute` (App.tsx):** client-side, gates `/ceo` on `session.user.email === "jbray131@gmail.com"`. Email-based, hardcoded, knows nothing about role_type or the edge function secret.
2. **`admin-actions` edge function:** server-side, the real security boundary, gates on `auth.users.id === ADMIN_USER_ID` (edge function secret). Id-based. Was silently broken until 2026-08-03 because the secret held a value that didn't match the CEO's actual `auth.users.id` (`329ee81b-17a7-45b2-9729-0575d3d7063f`, confirmed twice against `auth.users` before correcting). Every approval attempt ever made through the UI had returned 403 behind a generic "Handshake Error" toast.
3. **`profiles.role_type`:** the CEO account has **no `profiles` row at all** (confirmed: `auth.users` row exists, `profiles` row does not). Every role-based code path treats the CEO as a guest with no profile, which is why the mode toggle on `/profile` shows "Verified Role Required" on the CEO account. Not an onboarding gap, there is literally no row to read.

A change to any one of these does nothing to the other two.

**Decided (2026-08-03, owner):** admin/CEO status does NOT fold into `role_type`. No fourth enum value, no admin flag on `profiles`. It stays as the separate layer it already is: the hardcoded email in `CEORoute` (UI convenience) plus the `ADMIN_USER_ID` secret in `admin-actions` (the real boundary). Reasoning: `role_type` describes what a user is in the product (guest/talent/manager); admin is an operational identity outside the product's role model, and folding it in would make every role-based code path a potential privilege path. **Accepted risk, known and deliberate, not an oversight:** the email and the secret have no automatic sync check between them, nothing verifies they point at the same account, and that exact desync is what silently broke every approval until tonight. Accepted as a known gap for now, revisit only if admin surface grows beyond one person. The CEO account may still get a plain `profiles` row (as a guest, for app usability) - that's separate from admin status and doesn't conflict with this decision.

## Confirmed live bug (2026-08-03): manager mode + zero owned venues = infinite redirect loop

Found live, mid-testing item 3's fix with a real account: a `mode === "manager"` user who owns no venue yet (e.g. between submitting a Tier 1 claim and it being approved) gets stuck bouncing forever between `/profile` and `/venue/manage`, `toast.error("No active venue selected")` firing every cycle. `Profile.tsx`'s redirect effect sends any manager-mode user to `/venue/manage` with no check for whether they actually own one; `VenueManage.tsx` sends them straight back to `/profile` the instant `activeVenueId` is falsy. Neither side has a stable landing state for this specific combination. Not fixed yet. Needs one of the two to recognize "manager, no venue" and land somewhere that isn't a redirect to the other.

## Charge / Heat / Spotlight

- **Live today:** `get_talent_spotlight` RPC (migration `20260331_create_talent_spotlight_rpc.sql`) ranks talent by a raw lifetime `COUNT(*)` of `post_likes`, gated on `is_active = true`. **No decay.** Whoever got hot first stays on top forever, this contradicts the product's own "always feels fresh" premise.
- Two disconnected "charge" pathways exist: Home page's "Charge Node" button writes to `post_likes` (this is what actually feeds the spotlight). Discovery's own charge button writes to a separate `interactions` table that **nothing reads**. It currently does nothing. Either wire it in or remove it, don't leave it as dead UI.
- **Target v2 spec** (recovered from a prior session, not yet built): gravity-decay model, `score = Σ 1/(hours_since_charge + 2)^1.5`, 12-hour contribution cutoff, dedicated `post_charges` table, `charge_count` on posts, `heat_score` on both `venues` and `profiles` (spotlight currently only covers talent, docs describe venue spotlight too, never built), scheduled recalculation via RPC/cron. Full SQL for this exists in project history if asked to implement.
- `posts.expires_at` already exists as a column, likely the intended mechanism for feed-visibility fade (separate concept from heat-score decay, don't merge them, one is UI freshness, one is ranking math).

## Guest posting — deferred, not gated

**Decision:** guests do not post at launch. Full stop, not conditionally. Ticketing (see below) is also not launching, so the presence-based gating ideas (ticket scan-in, geofencing) discussed earlier don't apply yet, there's nothing to gate against.

**Fix needed:** `posts` INSERT RLS currently allows any authenticated user. Tighten to `role_type IN ('talent', 'manager')` only. Flat role check, no venue association, no geofencing, no ticket check. Revisit if/when ticketing ships.

`venues` has no latitude/longitude columns at all. Geofencing is not buildable today regardless of the above, would need new columns plus a geocoding pass on existing addresses.

## Ticketing — infrastructure exists, feature is withheld

Stripe, QR generation, `check_in_guest` (SECURITY DEFINER), `tickets.scanned_at` all exist and work. **Do not surface ticket purchasing in the shipped UI.** Keep the wiring dormant, don't strip it, this flips on later without a rebuild. Don't let "the wiring already exists" become a reason to ship it early, that was an explicit correction from the owner.

## Messaging — decided, not built

Talent and managers message freely into anyone's inbox (business context). Guests can message anyone, but land in a request queue unless the recipient follows them back, Instagram's model, filter lives on the receiving end, not a follow-to-unlock gate (a follow-gate is trivially bypassed by just following first). Currently only conversation membership is checked, none of this exists yet.

## RLS / security state (as of last audit)

**Closed:** open insert on `venue_staff`, unscoped "Managers can scan all tickets" policy, direct venue-claim bypass policy. All three confirmed dropped and verified.

**Still open, drafted but not run:** `venue_followers` status mismatch (`active` vs `approved`, never matches, managers have never seen followers; `useWorkerPermissions.ts` checks a third value, `confirmed`, confirmed via direct review, three inconsistent strings in live use, not two), `posts` missing UPDATE/DELETE (can't delete own posts), duplicate ticket policies (15 policies doing overlapping work), possible recursive RLS on `conversation_participants` SELECT (unverified, needs a SECURITY DEFINER helper if confirmed).

## Hard operating rules

- Schema lives in the live DB, not in migrations (migrations only hold RLS/triggers/RPCs). No rollback, no staging, dev happens against production. Be careful.
- **Never run schema or policy changes without the owner reading the SQL first**, except pre-approved critical security fixes.
- Supabase client has no `Database` generic, everything is untyped, schema drift isn't caught at compile time. Fixing this is recommended, still pending.
- Never fabricate unverified content or claims. If something's unclear, say so.
- No em dashes in any output, ever.
- **Diagnostic calls can be mutations (2026-08-03, learned live):** `admin-actions` authenticates and acts in one request, there is no dry-run mode. During the ADMIN_USER_ID fix, "re-run the same call to confirm the 403 is gone" WAS the real approval write, executed without an explicit go-ahead for that specific write, and that was only noticed from the `{"ok":true}` response. Outcome happened to be the intended one, verified after the fact, but the order was wrong. Rule: before re-running any call for diagnostic purposes, state whether it's read-only or mutating, and if mutating, get the go-ahead for the write itself, not just for "checking." Applies to anything that both authenticates and acts in one request.

## Build order (dependency-driven)

1. **Closed (2026-08-02).** Purge phantom `is_verified_*` references, application code side. Confirmed fixed: `TalentGuard.tsx`, `TalentManage.tsx` (this one was the actual gate blocking every talent user from `/gigs`, not just cleanup). Directly reviewed and confirmed correct: `CEODashboard.tsx` (flipped to showing an honest empty pending-talent state, not a fake populated one), `search-talent.ts`, `get-my-profile.ts`, `database.ts` (correctly left `venues.verified`/`venue_claims.evidence_link` alone, out of scope), `UserModeContext.tsx`. `useWorkerPermissions.ts` also purged of `is_verified_*` correctly, but still carries the separate `sub_role`-as-permissions collision and its own copy of the hydration race, both noted above, neither was this item's job to fix. Full `role_type` enum collapse deferred, see above, only the one `venue_manager` row got remapped, live and verified, commit `415ff0e`.
2. **Closed (2026-08-02).** Claim modal field fix, see Tier 1 note above. Commit `3fcea79`.
3. **Closed (2026-08-02).** `Dashboard.tsx` wired to `ManagerDashboard`, see Manager onboarding above. Commit `25725bb`.
4. Build talent onboarding (application + existing approve path).
5. Lock `posts` INSERT to talent/manager only.
6. Build Tier 2 enforcement around the existing Live toggle.
7. Rebuild spotlight with real decay, extend to venues, resolve the orphaned Discovery charge button.
8. Messaging follow-gate.
