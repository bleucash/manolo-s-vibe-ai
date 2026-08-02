# Manolo AI — Project Memory

Read this before touching anything. It holds decisions and traps that aren't derivable from the code itself. Structure (what a table looks like, what a component does) you can read directly, don't duplicate it here.

## What this actually is

Surface: a nightlife app for guests, talent, and venue managers, launching in Tampa and Atlanta.
Underneath: a venue-operations company. Discovery, feeds, talent profiles are the trojan horse that gets venues onto the platform without selling them cold enterprise software (the OpenTable/SevenRooms fight). Every consumer feature is quietly also data capture for the CRM layer that funds a talent marketplace later. Build order should serve that sequencing, not just feel-good UX.

Launch is intentionally small and hand-gatekept: two cities the owner has real relationships in, talent approved manually, venues seeded from known contacts. Don't automate approval flows prematurely, that's a later phase, not a launch requirement.

## Role model — single source of truth

Three roles only: `guest`, `talent`, `manager`. `role_type` (enum `app_role`) is authoritative.

Live enum currently has 6 values: `manager`, `staff`, `user`, `venue_manager`, `talent`, `guest`. `staff`/`user`/`venue_manager` are cruft, collapse to the three real values and migrate existing rows. Do not add new enum values without updating this file.

`src/contexts/UserModeContext.tsx` hard-codes `role === "manager" || role === "venue_manager"` as its manager check, this is a confirmed, concrete file the enum collapse touches, not theoretical.

The frontend "mode" a user is in (`useUserMode()`) hydrates instantly from `localStorage.getItem("userMode")` on mount for a fast paint, then `syncProfileAndVenues()` overwrites it with the real `profiles.role_type` from the DB moments later. It self-corrects, it's not trusting stale client state long-term. But that brief window before reconciliation is the same loading-race shape as the bugs already fixed in `CEORoute`, `Gigs.tsx`, `TalentGuard.tsx`, `useVenueStatus.ts`. This file wasn't part of that pass, put it on the same list as `BottomNav.tsx:16`.

- Talent and manager are **mutually exclusive**. A user is never both.
- **Staff is not a role.** It's a relationship, a `venue_staff` row linking a person to a venue. Don't gate features on `role_type = 'staff'`.
- Manager status comes from venue **ownership** (`venues.owner_id`), not a separate flag.

## Two layers of identity, do not conflate

- **What you are** (public, follows the person): `profiles.sub_role`, free text by design, not a rigid enum. Values in use: dancer, DJ, host, promoter. Expect more (bartender, event host, musician) — don't lock this down.
- **What you do at one venue** (operational, tied to the relationship): `venue_staff.staff_role`. This column already exists, don't add a duplicate.
- **Known collision:** `useWorkerPermissions` currently reads `sub_role` to grant permissions. `sub_role` is a discovery label, not a permission source. Permissions belong on the `venue_staff` row. Fix this before building more on top of the hook.
- Bouncer/door access is a link-based invite (intentional, lets venues staff up without app friction). Eventually needs to be venue-scoped, revocable, and expiring. Not urgent, but don't harden it into something permanent-by-default.

## Phantom columns — never re-add without a real migration

These are referenced in old code/docs but do not exist in the live DB: `profiles.is_verified_talent`, `profiles.is_verified_manager`, `venues.verified`, `venue_claims.evidence_link`. A verification system was half-built then reverted on the DB side while frontend kept references. If you see these names anywhere, it's leftover, not spec.

`prevent_profile_privilege_escalation` trigger (SECURITY DEFINER, live) still references `is_verified_talent`/`is_verified_manager`. It's a landmine: harmless today only because nothing updates `profiles` yet. Will throw at runtime the moment profile self-edit ships. Fix drafted, needs to be run before building profile editing.

## Venue claim / two-tier verification

- **Tier 1 (Instagram handshake):** grants presence, profile, hero reel, posting. `ClaimSectorModal.tsx` already collects an Instagram handle from the user but wraps it into a URL and inserts it as `evidence_link`, which doesn't exist. **Fix:** add `instagram_handle` column, send the raw handle, not a constructed URL.
- **Tier 2 (business verification):** `legal_name`, `business_email`, `business_phone`, `position_title` already exist on `venue_claims`. Grants operations: the Live/`is_active` toggle, staff approval, commission rates, prices, payouts. **Nothing currently gates access to these behind Tier 2.** Any owner can flip Live right now regardless of verification. Needs enforcement, not a schema change.
- Business verification is **per-venue**, not per-user. Lives on venues/venue_claims. A manager can be verified for one venue and not another.
- Subscription (`subscription_tier`, `ticketing_enabled`, both unused columns) is a separate gate from verification. Don't conflate "allowed to" with "paid for."

## Live vs verified — resolved, not a conflict

`venues.is_active` + `active_at` is already the correct "doors open right now" toggle. `ManagerDashboard.tsx` and `TalentDashboard.tsx` both flip these together, this is real, working code, not a gap. Don't add a second "live" column. The actual gap is that Tier 2 verification doesn't yet gate who can touch this toggle.

**Naming collision, not a logic conflict:** `is_active` exists as a column on three separate tables with three separate meanings. `venues.is_active` (venue open tonight), `profiles.is_active` (talent on the clock tonight, confirmed, `TalentDashboard.tsx` writes it identically to how `ManagerDashboard.tsx` writes the venue one), and `posts.is_active` (whether a post still shows in feed, likely tied to the fade/decay concept). None of these read or write each other, but the shared name is a real trap when reading code out of context, always confirm which table before assuming which meaning. `mode` (the frontend guest/talent/manager label) is unrelated to all three, it's never persisted to any table, it just gates *access* to the toggles on `venues`/`profiles`, it isn't one of them.

## Talent onboarding — doesn't exist, needs building

No path today for a user to request talent status. Design: application with Instagram handle, status field (pending/approved/rejected), manually approved at launch (owner reviews, same pattern as venue claims). Wire it to `admin-actions`'s `approve_talent` action, which already writes `role_type: "talent"` correctly, it just has nothing feeding it. Scale path later: threshold/bio-verification automation, then delegate approval to trusted venues. Don't skip straight to automation at launch.

## Manager onboarding — three separate fixes, ship together

1. `ClaimSectorModal.tsx` field bug above (applicant side).
2. `CEODashboard.tsx` already has a real, correctly-wired approval UI, queries pending `venue_claims`, calls `approve_venue_claim`/`approve_talent` correctly. It looks broken only because claims never land due to (1). Don't rebuild this, just unblock it.
3. **`Dashboard.tsx` does zero branching on `role_type`.** `ManagerDashboard.tsx` is a complete 380-line component, imported nowhere. An approved manager currently has nowhere to land. This is the real remaining wall, not the approval logic.

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

**Still open, drafted but not run:** `venue_followers` status mismatch (`active` vs `approved`, never matches, managers have never seen followers), `posts` missing UPDATE/DELETE (can't delete own posts), duplicate ticket policies (15 policies doing overlapping work), possible recursive RLS on `conversation_participants` SELECT (unverified, needs a SECURITY DEFINER helper if confirmed).

## Hard operating rules

- Schema lives in the live DB, not in migrations (migrations only hold RLS/triggers/RPCs). No rollback, no staging, dev happens against production. Be careful.
- **Never run schema or policy changes without the owner reading the SQL first**, except pre-approved critical security fixes.
- Supabase client has no `Database` generic, everything is untyped, schema drift isn't caught at compile time. Fixing this is recommended, still pending.
- Never fabricate unverified content or claims. If something's unclear, say so.
- No em dashes in any output, ever.

## Build order (dependency-driven)

1. Purge phantom `is_verified_*` references, collapse `role_type` enum to three values.
2. Fix `ClaimSectorModal` field bug (unblocks venue reclaiming end to end).
3. Wire `Dashboard.tsx` to branch on `role_type` and render `ManagerDashboard`.
4. Build talent onboarding (application + existing approve path).
5. Lock `posts` INSERT to talent/manager only.
6. Build Tier 2 enforcement around the existing Live toggle.
7. Rebuild spotlight with real decay, extend to venues, resolve the orphaned Discovery charge button.
8. Messaging follow-gate.
