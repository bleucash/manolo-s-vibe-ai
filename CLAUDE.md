# Manolo AI — Project Memory

Read this before touching anything. It holds decisions and traps that aren't derivable from the code itself. Structure (what a table looks like, what a component does) you can read directly, don't duplicate it here.

## What this actually is

Surface: a nightlife app for guests, talent, and venue managers, launching in Tampa and Atlanta.
Underneath: a venue-operations company. Discovery, feeds, talent profiles are the trojan horse that gets venues onto the platform without selling them cold enterprise software (the OpenTable/SevenRooms fight). Every consumer feature is quietly also data capture for the CRM layer that funds a talent marketplace later. Build order should serve that sequencing, not just feel-good UX.

Launch is intentionally small and hand-gatekept: two cities the owner has real relationships in, talent approved manually, venues seeded from known contacts. Don't automate approval flows prematurely, that's a later phase, not a launch requirement.

## Role model — single source of truth

Three roles only: `guest`, `talent`, `manager`. `role_type` (enum `app_role`) is authoritative.

Live enum has 6 values; `staff`/`user`/`venue_manager` are cruft. **Full type collapse is deferred, not scheduled:** removing values means dropping/recreating `has_role(uuid, app_role)` and `idx_profiles_active_talent`, disproportionate risk on a no-rollback production DB for a cosmetic cleanup. The one `venue_manager` row was remapped to `manager` (`20260802203411_remap_venue_manager_role.sql`). `UserModeContext.tsx` hard-codes `role === "manager" || role === "venue_manager"`, a concrete file any future collapse touches.

- **Decided (owner, 2026-08-12): one account holds exactly one role, permanently.** Guest, talent, or manager. A talent account never becomes a manager and vice versa. Intentional and settled, **not a limitation to be "fixed" later**. Do not confuse this with `venue_staff`, which correctly lets one manager span multiple venues and one talent be staff at several; that is a relationship table and unrelated to role.
- **Staff is not a role.** It's a relationship, a `venue_staff` row. Don't gate features on `role_type = 'staff'`.
- Manager status comes from venue **ownership** (`venues.owner_id`), not a separate flag.
- `mode` (`useUserMode()`) hydrates instantly from `localStorage.userMode`, then `syncProfileAndVenues()` overwrites it from `profiles.role_type`. It self-corrects, but that window is a loading race. **Do not gate access on `mode`**, gate on `role_type`. Since 2026-08-17 `Auth.tsx` writes `userMode` at login from the role it already queried, so the value is correct before the redirect rather than racing the auth listener.

## Two layers of identity, do not conflate

- **What you are** (public, follows the person): `profiles.sub_role`, self-declared. **Not free text (2026-08-17):** constrained to nine positions by `profiles_sub_role_allowed`. The list, labels and `guestFacing` flag live in `src/config/positions.ts`, which derives the TS union from its own keys; the value list is duplicated in the CHECK constraint and both must change together. Guest-facing: host, entertainer, dj, bartender, bottle_girl, promoter, media. Operational (never rendered on Discovery, the directory or public profiles): security, event_staff. text + CHECK not a Postgres enum, because `app_role` already proves how expensive a wrong enum value is to remove.
- **What you do at one venue** (operational, tied to the relationship): `venue_staff.staff_role`, same nine values via `venue_staff_staff_role_allowed`. Don't add a duplicate column. Its `'promoter'` default was dropped 2026-08-17; it was silently making every staff assignment guest-facing.
- **INVARIANT: `sub_role` is a label, never a permission.** Talent set it themselves — `prevent_profile_privilege_escalation` was narrowed (2026-08-17) to guard `role_type` only, which is what made the picker possible at all. That is only safe while this holds. If a position ever needs to gate access, the gate belongs on `role_type` (trigger-protected), on `venue_staff` (manager-approved), or on its own column. Wiring capability to `sub_role` makes it self-assignable, and **the failure mode is silent** — nothing looks wrong while it happens.
- Bouncer/door access is a link-based invite (intentional, lets venues staff up without app friction). Eventually needs to be venue-scoped, revocable, and expiring. Don't harden it into something permanent-by-default.

## "Active" means three different things — documented trap

Three unrelated concepts share the word. Read the column, not the label, and use these terms in code and commits:

- **Affiliation** — `venue_staff.status = 'active'`. Approved to work at this venue. Persists for months.
  - *How to read it:* `venue_staff` filtered by `user_id`, selecting `venue_id, status, staff_role`; a person is affiliated where `status = 'active'`. One row per `(venue_id, user_id)` — `unique_venue_user_connection` — so a person has at most one row per venue whatever its state. Note `'confirmed'` is **not** a status: the old `useWorkerPermissions` tested for it and never matched, and the `venue_staff_status_allowed` CHECK permits only `pending`, `pending_talent_action`, `active`, `ignored`.
- **Tapped in** — `profiles.is_active` + `profiles.current_venue_id`. Working right now, at this venue. Talent's own toggle; the verbs are "tap in" / "tap out".
- **Open** — `venues.is_active`. Venue is open for business. Manager-flipped, changes daily.

Affiliation is a prerequisite for tapping in (enforced by `profiles_enforce_check_in`, Build 3) but **never implies it**. Open is independent of both.

**Presence** — what a guest should see — requires all three: tapped in, tapped in *here*, and *here* is open. It lives in one place, `src/lib/presence.ts` (`isPresentAt`), the way `positions.ts` centralises `guestFacing`. Do not re-derive it inline; that is exactly how four surfaces drifted apart. Before 2026-08-20 only `Index.tsx` checked whether the venue was open, so talent tapped in at a closed venue read as present on their profile, on Discovery, and in `CreatePostDialog`, which **wrote** it into a post's venue tag where it outlived the night.

**Tapped-in state is deliberately not cleared when a venue closes.** Open gets flipped routinely and clearing would silently tap out a whole floor on a manager's toggle. Presence is computed at display time, so closing hides it and reopening restores it. Self-cleaning data (a trigger on `venues`) was considered and rejected; it remains a separate deliberate decision, not an oversight.

`TalentDashboard` is the one intentional exception: it is the talent's own view, and "tapped in, venue closed" is more useful there than silently showing nothing.

Discovery's venue-card facepile shows the full **affiliated** roster with a green ring on whoever is **present**. Two facts, two treatments. It is not presence-only on purpose: most venues have nobody tapped in most of the time, so the roster signal would vanish.

**Talent-surface work (profile, gigs dashboard) should push tapping in while working.** The glow, Active Nodes, and presence generally are only worth anything if that toggle actually gets used.

## RLS denial is silent success — check rows affected, always

**An RLS-filtered write does not error. It returns 200 with zero rows.** Any call that only checks `if (error)` will report success while nothing happened, and the user stops looking. This has bitten five times: the manager approve path (said "Neural Link Confirmed" on an unverified venue), Build 2's self-approval test, Build 3's cross-user delete, `TalentDashboard.handleResponse` on a stale invite, and Build 4's accept-twice case.

**Discipline: every write that depends on a policy ends in `.select()` and checks rows affected**, not just absence of error. Report accurately when the count is zero. A trigger that `RAISE`s is the exception, it surfaces as a real error; RLS never does.

This is also why the check-in gate is a trigger rather than a policy: a `WITH CHECK` would have failed silently, and it can key on the transition so unrelated profile edits aren't collateral.

## Migrations: the platform applies them too

**Something other than us runs `db push`.** The hosting platform applies migrations from the repo on sync, confirmed 2026-08-17 when a ledger row appeared carrying stored statements that neither the Management API path nor `migration repair` writes. It picked up one migration and not a later one, matching a sync between two pushes.

**So every migration must survive being run twice.** Use `DROP ... IF EXISTS` before `CREATE`, `CREATE OR REPLACE` for functions, `ADD COLUMN IF NOT EXISTS`. Re-check the ledger after platform syncs, not only after our own work. All 20 migrations are currently paired local/remote with zero mismatches, and filenames are 14-digit timestamps so ordering is unambiguous.

## Phantom columns — never re-add without a real migration

Referenced in old code but absent from the live DB: `profiles.is_verified_talent`, `profiles.is_verified_manager`, `venues.verified`, `venue_claims.evidence_link`. A verification system was half-built then reverted on the DB side while frontend kept references. All frontend `is_verified_*` references were purged 2026-08-02 (commit `415ff0e`).

**Four invented references found so far**, each written at a call site to make code compile and each invisible until something type-checked it: `conversation_summary.unread_count` (never existed, `|| 0` made the badge permanently dark), `posts.updated_at`, `conversations.user1_id`/`user2_id`, and `public.follows` (2026-08-30). **`public.follows` is the one to remember: it lived in a SQL function body, where wiring TypeScript types was never going to catch it.** Postgres does not validate a `plpgsql` body against the schema at `CREATE` time — a function referencing a nonexistent table compiles, deploys, and fails only when that branch first executes. `start_conversation` sat broken for every guest and manager caller from the day it shipped. **SQL function bodies need the same verification discipline as migrations: check every table and column named in them against the live schema, and execute every branch.** A green deploy proves nothing.

**Trigger vs migration trap, general and confirmed:** `auth.role()` reads a session setting PostgREST populates per request. Direct connections (migrations, psql, `db push`) never go through PostgREST, so it returns `NULL`, never `'service_role'`. **Any migration writing a trigger-guarded column trips the guard and fails.** Wrap it: `ALTER TABLE x DISABLE TRIGGER y;` before, `ENABLE` after, same file. Applies to `profiles_prevent_privilege_escalation` (guards `role_type` only since 2026-08-17, no longer `sub_role`) and `venues_require_business_verified` (guards `is_active`, `active_at`, `entry_price`, `vip_price`, `business_verified`).

## Venue claim / two-tier verification

- **Tier 1 (Instagram handshake):** grants presence, profile, hero reel, posting. `ClaimSectorModal` sends `instagram_handle`, a real column. Talent applications additionally issue a DB-generated 6-character `verification_code` the applicant DMs from the handle they claim; the reviewer checks it before approving. Target account is `VERIFICATION_INSTAGRAM_HANDLE` in `src/config/brand.ts`, render-time config that nothing persists.
- **Tier 2 (business verification), built and round-trip verified 2026-08-11.** `venues.business_verified` is the flag; `venue_business_applications` is the queue (one pending per venue). Five gated surfaces share `Tier2Notice`, which owns `BusinessVerificationModal`, so one edit covers all five. `admin-actions` handles `approve_business`/`reject_business`, which take `{ venue_id }` not `{ user_id }`. **UI disabling is not a substitute for the policy; RLS is the boundary** (approve was once refused by the DB while reject succeeded, because only UPDATE was gated). Known rough edge: `Tier2Notice`'s "under review" state is local, so a reload makes it look actionable until the `23505` path corrects it.
- **Only 2 of 17 venues are business-verified** (2001 Odyssey, The Ritz Ybor; both owned by `info@manolomrktng.com`, both currently closed). WTR Pool & Grill is Tier 1 only. So anything gated on `business_verified` is effectively off for most venues, including approvals, invites, and flipping a venue open. Use a Tier 2 venue when testing those paths.
- Business verification is **per-venue**, not per-user. Subscription (`subscription_tier`, `ticketing_enabled`, both unused) is a separate gate. Don't conflate "allowed to" with "paid for."

## Missing FK constraints — found 2026-08-03, unfixed, logged only

- **`profiles.venue_id` references nothing formally.** `profiles` has both `venue_id` and `current_venue_id`; only the latter carries an FK. `Index.tsx` names the FK explicitly (`venues!profiles_current_venue_id_fkey!inner`) precisely so adding an FK to `venue_id` later cannot silently break the embed with an ambiguity error.
- **`venues.owner_id` has no FK to `profiles`**, despite ownership conferring manager status. It points at `auth.users` instead, which is why owner names cannot be embedded from `venues` and are fetched separately.

Not fixed deliberately: adding constraints to production tables can fail on pre-existing violations, so it needs a data audit first, not a blind `ALTER TABLE`.

## Nullable join keys — found 2026-08-22 turning on `strictNullChecks`, unfixed, logged only

Six columns that are meaningless when NULL are nullable anyway: `venue_staff.user_id`, `venue_staff.venue_id`, `venue_claims.user_id`, `venue_claims.venue_id`, `post_likes.post_id`, `post_likes.user_id`.

**Why it matters beyond types.** A `venue_staff` row with a NULL `venue_id` still exists and still counts, but every venue-scoped query filters `.eq("venue_id", …)`, so no venue sees it, no dashboard lists it, and no revoke reaches it — an invisible affiliation, the silent-success shape of an RLS denial arriving through the schema instead. Clients narrow with `.filter((id): id is string => id !== null)`, which drops the orphan rather than asserting it away. **Not a fix.** Tightening to `NOT NULL` needs an audit for existing violations first (see the FK note above) and is its own dispatch.

## Talent ↔ venue relationship (Builds 2-4, closed and verified)

Both directions of `venue_staff` now exist, each proven against real JWTs rather than from the client that wrote it.

- **Talent requests** (`RequestToWorkModal` from the venue page): inserts `status = 'pending'`. Policy requires `auth.uid() = user_id AND status = 'pending' AND has_role_type(talent)`, so the role gate is server-side, not just UI.
- **Manager invites** (`InviteTalentModal` from `TalentDirectory`, reached via the dashboard's Staff tab, not Discovery's guest path): inserts `status = 'pending_talent_action'`. All three policy clauses are load-bearing: the pinned status stops a manager putting someone on staff who never agreed; the owned-and-verified venue check is the security boundary; `has_role_type(user_id, 'talent')` checks the **invitee**, not the caller, so guests can't be conscripted.
- **Talent responds:** `pending_talent_action` → `active` or `ignored`. The UPDATE policy's `USING` deliberately excludes `pending` rows, so talent cannot self-approve their own request.
- **Exits are a DELETE by the talent on their own row**, unrestricted by status: `unique_venue_user_connection` means a stranded row of any status permanently blocks a future relationship with that venue.
- **Collisions are pre-checked, not left to `23505`.** One constraint violation covers five situations; already-requested in particular should send the manager to the approval panel, not show an error.
- **Check-in requires an active affiliation** (`profiles_enforce_check_in`). Losing the affiliation clears the check-in, one trigger covering manager removal, talent leave and withdraw.
- **`revoke_venue_claim` downgrades active affiliations to `pending` rather than deleting them.** Pending confers nothing, so tap-in is removed just as completely, but the relationship survives as a request the next owner sees. Order matters and is deliberate: staff are downgraded **before** `owner_id` is nulled, because the reverse fails into an ownerless venue with active affiliations still attached, which is unmanageable from both sides.
- **Affiliations at an unowned venue are the failure state to avoid.** One legacy row existed (Tangra, predating every policy) and was deleted. Active-at-unowned is now unreachable, since every approval path requires an owner.

## CEO/admin identity: three disconnected mechanisms, none aware of the others

1. **`CEORoute` (App.tsx):** client-side, gates `/ceo` on `session.user.email === "jbray131@gmail.com"`.
2. **`admin-actions` edge function:** server-side, the real boundary, gates on `auth.users.id === ADMIN_USER_ID` (secret). Was silently broken once when the secret held a stale id; every approval returned 403 behind a generic toast.
3. **`is_admin()` in the DB:** RLS can't see the secret, so it keys off the JWT email claim, a third copy.

**Decided (2026-08-03, owner): admin status stays outside `role_type` permanently.** No fourth enum value, no admin flag. `role_type` describes product identity; admin is operational, and folding it in makes every role-based path a privilege path. **Accepted risk:** nothing syncs the email against the secret, and that exact desync is what broke approvals.

**Concrete cost, not just untidiness:** this is what blocks making `revoke_venue_claim` atomic. Its four sequential writes should be one `SECURITY DEFINER` RPC in a transaction, but the edge function authorizes on `ADMIN_USER_ID` while an RPC would have to use `is_admin()`. Converting means picking one mechanism first. Until then the writes are ordered so every partial failure is recoverable.

## Onboarding paths — closed

- **Talent onboarding** (2026-08-03, verified end to end 2026-08-07). `talent_applications` via **Become Talent** on `Profile.tsx`, guest-only by construction. `approve_talent` writes `role_type` first then closes the application, deliberately: a failed second write leaves "approved but still pending", not a silently dropped applicant. Duplicates blocked by `talent_applications_one_pending_per_user ON (user_id) WHERE status = 'pending'`, which allows re-application after rejection.
- **Manager onboarding** (2026-08-02). `Dashboard.tsx` renders `DashboardGuard` → `ManagerDashboardPanel` → `ManagerDashboard`. **Consequence:** `ManagerDashboard` has no `venueId` prop, it reads `activeVenueId` from context, and visiting `/dashboard/:id` persists that venue as active everywhere until manually switched.
- **Profiles auto-creation** (2026-08-03). `handle_new_user()` + `on_auth_user_created` insert `id` and `role_type: 'guest'` only. **Deliberately just `id`:** `profiles.username` is `UNIQUE`, so deriving it from email collides across domains, and a unique violation inside an `AFTER INSERT` trigger aborts the whole signup. Richer defaults belong in `Auth.tsx`'s `options.data`, not guessed in SQL. `ON CONFLICT (id) DO NOTHING` keeps it idempotent; no exception handler on purpose, since silent swallowing is how profile-less users accumulated before.
- **Manager mode with zero owned venues** (2026-08-03) used to bounce forever between `/profile` and `/venue/manage`. `VenueManage` now renders a stable screen instead of redirecting; killing the redirect on one side alone breaks the cycle.
- **Post-login routing by role** (2026-08-17): manager → `/venue/manage`, talent → `/talent-manage`, everything else → `/discovery`. An explicit `?next` always wins.

## Accepted risk: a user can hold a pending talent application AND a pending venue claim

Separate tables, no cross-check, so both can be open at once even though the roles are mutually exclusive. **Accepted at launch scale (2026-08-03):** every approval is manually reviewed by one person who would notice. Since 2026-08-17 both submission paths and both approve paths check the other track, so this is mostly closed in practice; the tables still have no constraint spanning them.

**Separate pre-existing bug, unfixed:** `unique_venue_claim UNIQUE (venue_id, status)` permits only one row per (venue, status), so a venue can never have two rejected claims, and a retained terminal row blocks the next approval. This is why `revoke_venue_claim` deletes the approved claim row rather than marking it. `talent_applications` deliberately does not copy this shape.

## Following — built for talent and venues

`useFollow.ts` + `FollowButton.tsx` write to `followers` (talent) and `venue_followers` (venues), parameterized by `FollowTarget`. `useFollow` also exports `writeFollow()`, the raw insert/delete, because Discovery loads every follow in **one batched query** and mounting a hook per card would turn that into one query per card.

**The wiring bug worth remembering:** both Discovery cards were `<div onClick={onFollow}><FollowButton onClick={e => e.stopPropagation()} /></div>`. The button's `stopPropagation` fires before the event reaches the wrapper, so `onFollow` could never run, and passing the missing prop would have produced a button that still did nothing.

**Naming collision, unresolved:** `Discovery.tsx` defines its own local `FollowButton`, a different component from `@/components/FollowButton`. Worth renaming when that file is next opened.

## Charge / Heat / Spotlight

- **Live RPC logic:** `get_talent_spotlight(limit_count)` sums `interactions.action_value * EXP(-0.05 * hours_since_created)` over `target_type = 'talent'` rows from the last 24 hours, joined to `profiles` on `role_type = 'talent'`. Its migration file does **not** match the live body; the live one drifted, same pattern as `prevent_profile_privilege_escalation`. Documentation here was once the inverse of reality on four counts, so read `pg_get_functiondef` before designing against it.
- **`interactions` is not dead code, it is Spotlight's live input.** `Discovery.tsx`'s `handleCardClick` writes a row on every card tap. It is misnamed as a "charge": it is a click-through tracker, which is why ranking talent on it is a bug the eventual cutover fixes. Inflation gap closed 2026-08-11 with `UNIQUE (user_id, target_id, target_type, interaction_type)`. **That shape is right for charges and wrong for views:** repeat views over time are meaningful signal, so venue view-tracking must revisit it rather than inherit it.
- **Talent heat score built 2026-08-11, deliberately NOT wired to Spotlight yet.** `profiles.heat_score` + `heat_updated_at`, maintained by an `AFTER INSERT` trigger on `post_likes` that decays at **half-life 3 hours** then adds 1. A trigger rather than app code because `post_likes` gains more writers and the decay must not be duplicated. **Charge/uncharge pump closed in the same pass:** `post_likes` soft-deletes via `is_active` and the client upserts with `ON CONFLICT DO UPDATE`, so AFTER INSERT fires only on the genuine first charge. **Three pieces are jointly load-bearing, do not remove any in isolation:** `is_active`, `UNIQUE (post_id, user_id)`, and the absent DELETE policy. Uncharging deliberately does not subtract; decay handles fading. Cutting Spotlight over now would empty it, since `post_likes` has few rows and only Home writes it.
- **Spotlight charge surfaces:** Home feed (live). Discovery cards and talent profile pages are **not built**; those buttons are the prerequisite for the cutover, along with the 0.5 trending threshold and a most-recent-charge fallback.
- **Venue heat is a separate concept and not a number shown to users.** Four tiers: Open, Heating Up, Lit, Hot Spot. No badge while the venue is closed. Tiers **reset rather than persist**. "Open" is the floor, tied to `is_active`, explicitly not an achievement. Purpose is ranking venues on Discovery, not decoration. Inputs (charges on venue UGC, presence, profile views) are **not weighted or formalized**; don't guess at cutoffs.
- **Target v2 spec** (recovered, not built, still the decay baseline): `score = Σ 1/(hours_since_charge + 2)^1.5`, 12-hour cutoff, dedicated `post_charges` table, scheduled recalculation. **Tabled:** geo-fencing as a heat or verification signal, tied to tap-in; its own session, own privacy considerations.
- `posts.expires_at` already exists, likely the feed-visibility fade mechanism. Separate concept from heat decay: one is UI freshness, one is ranking math.

## Guest posting — deferred, not gated

**Guests do not post at launch. Full stop, not conditionally.** Enforced at the DB (`20260805000142_posts_insert_talent_manager_only.sql`): `posts` INSERT requires `auth.uid() = user_id AND (has_role_type(talent) OR has_role_type(manager))`. It replaced a policy that was self-scoped but had no role check at all. The role check goes through the SECURITY DEFINER helper rather than a subquery on `profiles`, because `profiles` SELECT is `USING (true)` today and a subquery would silently deny every insert if that were ever tightened.

`venues` has no latitude/longitude columns, so geofencing is not buildable today regardless.

## Events — live table, no reader, no writer

`events` holds real rows (2, created by the manager account) but **nothing in the codebase reads or writes it**. The `/events` page was deleted 2026-08-22: platform-generated in a single bot commit, never touched, reachable only by typing the URL, and its `profiles:created_by` embed had never resolved, so it 400'd from the day it was written and always rendered blank. Recoverable from git if the layout is wanted.

**Event-first browsing is a real gap, deliberately deferred.** Discovery is venue-first and talent-first; nothing answers "what is on this week". Build it when ticketing turns on, together with an event-creation path (none exists) and a nav entry.

**`events.created_by` references `auth.users`, not `profiles`** — same shape as `venues.owner_id`. PostgREST cannot embed `profiles` through it, so any future query must fetch creators in a second call keyed on `created_by`, as `CEODashboard` does for venue owners.

## Ticketing — infrastructure exists, feature is withheld

Stripe, QR generation, `check_in_guest`, `tickets.scanned_at` all exist and work. **Do not surface ticket purchasing in the shipped UI.** Keep the wiring dormant, don't strip it. "The wiring already exists" is not a reason to ship it early; that was an explicit owner correction.

## Messaging — decided, not built

**Intended design:** talent and managers message freely into anyone's inbox; guests can message anyone but land in a request queue unless the recipient follows them back (Instagram's model; the filter lives on the receiving end, since a follow-gate is trivially bypassed by following first). **Refinement (owner, 2026-08-07):** managers are exempt from that friction, businesses don't want it turning away customers.

**The request queue is NOT built. Current behaviour is a hard reject** — a guest messaging someone who does not follow them back gets a `42501` exception from `start_conversation`, not a queued request. Deliberate as of 2026-08-30: the queue is its own feature and was kept out of a repair. Until it exists, the documented design above describes intent, not behaviour.

**`start_conversation(target_user_id)` is the only correct way to open a thread** (repaired `20260830120000`, all branches executed against a fixture). It is idempotent — an existing two-person thread is returned rather than a second one created — and takes a transaction-scoped advisory lock on the ordered pair, so a double-pressed button cannot race two threads into existence. It returns an existing thread **before** applying the velvet rope, so withdrawing a follow does not lock someone out of a conversation both people can already see. Do not hand-roll insert-then-participants: that is two writes with a window that leaves a conversation with no participants, invisible to every query but still a row.

**Group chat is intended, not hypothetical** — primarily venue-to-staff coordination. `conversation_summary` therefore returns **NULL `display_name` and `avatar_url` whenever there is more than one other participant**, so the client can branch on it. Picking a participant deterministically was rejected: it renders one confidently wrong name on a three-way thread, the same failure shape as the inverted badge. NULL is honest, and this is the foundation rather than a placeholder. **Design pass still open:** thread naming, who may add and remove participants, whether venue threads follow `venue_staff` affiliation so leaving the venue removes you, and how roles surface in a multi-party thread.

## RLS / security state

**Closed:** open insert on `venue_staff`, unscoped ticket-scan policy, direct venue-claim bypass, `venue_claims` having no row security at all (`20260804232027_venue_claims_rls.sql`; the INSERT status predicate is load-bearing, without it a claimant inserts pre-approved). `venue_claims` has **no UPDATE/DELETE policy deliberately**, since approve/reject runs through `admin-actions` on the service key.

**The general trap:** permissive policies OR together, so a stricter sibling never saves you, the loosest one wins. Two policies with `USING` but no `WITH CHECK` once let a caller rewrite a row to anything, including moving `venue_id` to a venue they don't own.

**Messaging RLS and the summary view — closed 2026-08-22, three defects from one line.** `useChat`'s `.neq("participant_id", currentUserId)` caused all of them: no scoping (every conversation in the database came back with `last_message_content` on the wire, proven at the API with a session token; the UI happened not to paint it), and an inverted badge (it read the *other* party's row, so `unread_count` was theirs, lighting when someone had not read *your* message). Underneath, `conversation_participants` had an **infinitely recursive SELECT policy** (`42P17`) that its own `EXISTS` triggered, which also broke `conversations` and `messages`, since their policies query it. **All three messaging tables were unreadable by any authenticated user**; the feature worked only because the view was `security_invoker = false` and bypassed RLS entirely. That is why invoker rights were never a one-line fix.

Fixed by `is_conversation_participant()` (SECURITY DEFINER, pinned `search_path`, same pattern as `has_role_type`) in all four policies, then scoping the view with `cp.user_id = auth.uid()` and lateral-joining the counterparty's profile, then `security_invoker = true`. **The fix lives in the view, not the client, deliberately: client discipline is exactly what failed.** Note the view now returns zero rows to any non-PostgREST caller, because `auth.uid()` is NULL there — service-role reads look empty and that is correct, not broken.

**Still open:** `venues` and `venue_staff` both carry a `qual: true` SELECT that makes every narrower SELECT beside it inert and every row world-readable. `venue_followers` carries a redundant `FOR ALL` policy overlapping its INSERT/DELETE/SELECT ones, plus its own `qual: true` SELECT. `posts` has no UPDATE/DELETE, so nobody can delete their own post. 15 duplicate/overlapping ticket policies. Possible recursive RLS on `conversation_participants` SELECT, unverified.

## Hard operating rules

- Schema lives in the live DB, not in migrations (migrations only hold RLS/triggers/RPCs). No rollback, no staging, dev happens against production. Be careful.
- **Never run schema or policy changes without the owner reading the SQL first**, except pre-approved critical security fixes.
- Supabase client has no `Database` generic, everything is untyped, schema drift isn't caught at compile time. This is also why `text` + CHECK was chosen over Postgres enums: the generated types aren't wired, so an enum buys no safety today.
- Never fabricate unverified content or claims. If something's unclear, say so. **Do not attach a name to a number you measured separately** (a venue name once came from an unrelated test fixture and was reported as fact for days).
- No em dashes in any output, ever.
- **Diagnostic calls can be mutations:** `admin-actions` authenticates and acts in one request, there is no dry-run. "Re-run to confirm the 403 is gone" WAS the real approval write. Before re-running any call diagnostically, state whether it's read-only or mutating, and get the go-ahead for the write itself, not just for "checking."

## Build order

Items 1-6 closed 2026-08-02 to 2026-08-11: phantom purge, claim modal fix, `Dashboard` wiring, talent onboarding, `posts` INSERT lock, Tier 2 verification. Builds 1-4 closed 2026-08-17 to 2026-08-21: position enum + config, talent-requests-venue, check-in constraint + talent exits, manager-invites-talent.

7. Rebuild Spotlight with real decay, extend to venues, resolve the orphaned Discovery charge button. **Blocked on** the explicit charge buttons existing on Discovery cards and talent profile pages.
8. Messaging follow-gate.
9. Unify the three admin identity mechanisms, which unblocks making `revoke_venue_claim` atomic.
