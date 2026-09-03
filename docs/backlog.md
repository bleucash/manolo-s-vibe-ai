# Manolo AI — Backlog

**Source:** reconciled against the live database and repo at `fd48933` (2026-09-01). Every item was checked against `pg_policy`, `pg_constraint`, `pg_indexes`, `pg_proc` or the working tree — nothing is carried forward on trust.

**Why this file is in the repo.** It previously lived only in the owner's project knowledge, which is why a Claude Code session could not find it and why it went stale against `b7e11e6`. Here it sits next to `CLAUDE.md`, gets updated by whoever is working, and stops being a document only one party can see.

**Organized by kind, not urgency.** Urgency is annotated inline. The previous Tier 1-4 sort was useful for picking what to do next but hid that several unrelated-looking entries are one underlying problem — see *What the grouping reveals* at the end.

**How to use this:** pick one item, write the spec (template at the bottom) before opening a session, hand the spec to Claude Code. You decide what gets built; the session executes a plan rather than improvising one.

---

## A. Coherence problems

*Places the system holds two ideas about itself. These produce silent wrongness rather than errors, which is what makes them expensive.*

### A1. Permissive policies that make their stricter siblings inert — live exposure

Verified against `pg_policy`, and worse than previously recorded:

| Table | SELECT policies | Problem |
|---|---|---|
| `venues` | 4 | **Two** are `USING true`. Both narrower ones (`is_active = true`) are dead. |
| `venue_staff` | 4 | One `USING true` ("Enable read access for all users"). Three narrower ones dead. |
| `venue_followers` | 3 + a redundant `FOR ALL` | One `USING true`. Manager-scoped and self-scoped both dead. |
| `tickets` | 15 total | Confirmed exactly 15. Dormant in the UI; same shape. |

Permissive policies OR together — the loosest wins, and Postgres logs nothing. Every row in `venues` and `venue_staff` is world-readable regardless of the four policies that appear to restrict it.

**Pull a fresh `pg_policy` dump before fixing.** This schema has recorded cases of migration files disagreeing with live bodies.

### A2. `get_talent_spotlight` migration files disagree with the live body

**Do this before C3, not as filler.** The Spotlight rebuild is currently planned against a function whose migration files do not match what is running: the live body is 1077 bytes, three migration files mention it, none matches. `CLAUDE.md` records that this function's documentation "was once the inverse of reality on four counts."

This schema has already produced **five invented references** from exactly this condition — one of them, `public.follows`, lived in a SQL function body and shipped broken for every guest and manager caller from the day it was written. Designing C3 off the migration files repeats that setup precisely.

Previously filed as Tier 4 cleanup. It is not cleanup.

### A3. FKs pointing where the code doesn't want them

- `venues.owner_id` → `auth.users`. Owner names cannot be embedded; fetched separately.
- `events.created_by` → `auth.users`. Same.
- `profiles.venue_id` → **nothing at all.** Verified: `profiles` carries exactly two FKs, on `current_venue_id` and `id`.

Deliberately unfixed pending a data audit — adding a constraint to a production table fails on pre-existing violations.

### A4. Six nullable join keys the code treats as guaranteed

`venue_staff.user_id`, `venue_staff.venue_id`, `venue_claims.user_id`, `venue_claims.venue_id`, `post_likes.post_id`, `post_likes.user_id`.

A `venue_staff` row with a NULL `venue_id` exists and counts, but every venue-scoped query filters `.eq("venue_id", …)` — so no venue sees it, no dashboard lists it, and no revoke reaches it. Same audit prerequisite as A3.

### A5. `app_role` has six values; the product has three

Verified live: `manager, staff, user, venue_manager, talent, guest`. Three are cruft.

Previously filed as cosmetic cleanup. It is not cosmetic: `UserModeContext.tsx` hard-codes `role === "manager" || role === "venue_manager"` to paper over it, so every role check in the codebase must know about values the product denies. The collapse stays deferred (dropping values means recreating `has_role()` and an index on a no-rollback database) but the ongoing cost belongs here rather than in a tidy-up list.

### A6. Three admin identity mechanisms — a blocker, not a preference

`CEORoute` (client-side, email string), `admin-actions` (server-side, `ADMIN_USER_ID` secret), `is_admin()` (DB, JWT email claim). All three confirmed present.

Nothing syncs them, and that desync silently broke every approval once. **This is what blocks making `revoke_venue_claim` atomic** — its four sequential writes should be one `SECURITY DEFINER` RPC, but the edge function authorizes on the secret while an RPC would have to use `is_admin()`. Converting means picking one mechanism first.

### A7. `unique_venue_claim UNIQUE (venue_id, status)`

Verified live. Permits only one row per (venue, status), so **a venue can never have two rejected claims**, and any retained terminal row blocks the next approval.

**Reframing that matters for whoever fixes this:** `revoke_venue_claim` deleting the approved claim row rather than marking it terminal has been treated as a design choice. It is not — it is a **workaround for this constraint**. Anyone "improving" that function by preserving an audit row will reintroduce the block.

`talent_applications` deliberately took the correct shape and is the fix pattern: a partial unique index, `ON (user_id) WHERE status = 'pending'`.

### A8. "Active" means three different things

`venue_staff.status = 'active'` (affiliation), `profiles.is_active` (tapped in), `venues.is_active` (open). Documented and centralized in `src/lib/presence.ts`. Listed as the archetype of this category, not because it needs work.

---

## B. Pre-launch gates

*Acceptable now specifically because signups are hand-gatekept and every account is known. Each becomes a real problem the day that stops being true.*

### B1. Unbounded pending message requests
A guest can hold unlimited pending threads with strangers. The first thing abused when signups open, and much harder to bound once there is real traffic to reason about.

### B2. Unbounded reads — RESOLVED for messages, reclassified for the rest

**Not every "fine now, not later" item is the same thing, and B2 was three items wearing one label.** The distinction that matters is whether a thing *degrades* or merely *irritates*. Pagination degrades; a missing feature irritates. Only the first blocks building on top of it.

**`fetchMessages` — was a genuine ceiling. FIXED 2026-09-02.** It grew with activity in one thread, unbounded, and grew while nobody was looking. Now keyset-paginated at 50 with a composite `(created_at, id)` cursor, served by `idx_messages_conversation_created_id` with no sort node. The composite cursor is not caution for its own sake: a single-column cursor makes a page boundary ambiguous when two messages share a microsecond, and the symptom — one message silently missing at a seam — is close to undiagnosable after the fact.

**`fetchConversations` — NOT a ceiling. Deliberately left unpaginated.** It grows with O(relationships), not O(activity): bounded by how many distinct people and venues you have a relationship with, and it does not grow while you sleep. Even a heavy manager is in the low hundreds. Two further reasons pagination would be *negative* value here: the `last_message_at` sort comes from a lateral subquery and so cannot use an index at all, meaning a `LIMIT` would avoid transferring rows but not computing them; and **a silently truncated inbox is worse than a slow one** — thread 201 vanishing with no indication is exactly the class of quiet wrongness this project keeps finding. Revisit only if a real account crosses ~200 conversations.

### B2b. `TalentDirectory` — genuine ceiling, and **the obvious fix makes it worse**

It fetches **all talent globally**, so it grows with platform size rather than with the user. At 10,000 talent every directory open ships 10,000 rows to every viewer.

**A naive `.limit()` would break search correctness.** Search is client-side — `filteredTalent` filters the already-fetched array — so a limit would silently make the search box search only the first page, and the user would have no way to know their results were incomplete. That turns a performance problem into a correctness problem. **This is the part worth remembering, because `.limit()` is exactly what someone will reach for.**

The real fix is three things together: server-side filtering (`ilike` on `username` and `display_name`), pagination, and a `(role_type, username)` composite index which does not currently exist — `idx_profiles_role_type` covers the filter but not the ordering, so a paginated query would sort every talent row. That is a search-architecture change, not a pagination change, and it deserves its own dispatch.

### B3. No rate limiting
Nothing throttles message sends, follows, or `interactions` writes.

### B4. Non-idempotent group creation
`create_group_conversation` has no natural uniqueness key, so a double-submitted form makes two groups. Tolerable behind a form rather than a one-tap button — **except there is no group deletion, so a duplicate is permanent.** Couples directly to C5.

---

## C. Missing features

### C1. Venue rating / review system
User-voted, multi-category. Verified not built — no rating, review, vote or competition table exists.

### C2. "Best Talent" cash-prize competition
User-voted, meant to drive engagement and talent sign-ups. Nothing in the schema.

### C3. Spotlight rebuild with real decay, extended to venues
Still blocked on explicit charge buttons existing on Discovery cards and talent profile pages. Verified: `Discovery.tsx:230` writes `interactions` with `interaction_type: "charge"` — a click-through tracker, not a charge — and only `Index.tsx` touches `post_likes`.

**Resolve A2 first.**

### C4. Event-first browsing
Nothing answers "what is on this week." **Changed shape:** `Events.tsx` is deleted and there is no route at all, while the `events` table still holds 2 rows with no reader and no writer. The gap widened — this now needs a page, a route, an event-creation path, and a nav entry.

### C5. Group ownership transfer or deletion
The group design makes the creator permanently unremovable from a group they made, because leaving would deliberately orphan management. Fine with a handful of hand-made groups; not fine later. Whichever is simpler closes this and B4.

### C6. `posts` has no UPDATE or DELETE policy — a decision, not a build
Verified: `posts` carries only INSERT and SELECT policies. Nobody can edit or delete their own post. This needs a call — ship it or accept it — rather than sitting in a queue implying someone will build it.

---

## D. Accepted risks — settled, not queued

*These read as open items. They are decisions. Leaving them in a work queue implies someone will fix them, which is wrong and makes the rest of the queue less trustworthy.*

- **Admin identity stays outside `role_type`** (owner, 2026-08-03). No fourth enum value, no admin flag. The *cost* is A6; the *decision* is closed.
- **A pending talent application and a pending venue claim can coexist.** Verified: **zero** constraints span the two tables. Mostly closed in practice since 2026-08-17 — both submission paths and both approval paths cross-check — and accepted at hand-reviewed scale. The residual is that nothing enforces it in the database.
- **Decline is a black hole.** A declined sender is never told and can keep writing into a thread the recipient will never see. Telling them would leak the decline through an error.
- **Member-to-member exposure inside groups.** The membership bound guarantees each member's relationship to the creator, not to each other.
- **Ticketing stays dormant.** Stripe, QR generation and the scan flow all work. Explicit owner call not to surface it. Not a task — just do not ship it by accident.
- **One account holds exactly one role, permanently.**
- **Tapped-in state is not cleared when a venue closes.** Presence is computed at display time instead.
- **Venue thread deletion cascades.** Deleting a venue destroys its staff thread and every message in it, irreversibly.

---

## E. Cleanup

*Genuinely low-stakes. Nothing depends on these.*

### E1. `Discovery.tsx` defines its own local `FollowButton`
Confirmed at line 83, distinct from `@/components/FollowButton`. Rename when that file is next opened.

### E2. Three cosmetic messaging findings
Primary/General routing keys on a display-name substring, so one thread lands in different tabs for each participant; uppercase leaks onto user content in the composer and the sidebar snippet while the message bubble is correctly exempt; two different fallback strings for one NULL display name. All recorded, all deliberately unfixed pending a visual pass.

---

## Closed since `b7e11e6`

- **Recursive RLS on `conversation_participants` — FALSE, verified false.** The live SELECT policy is `(user_id = auth.uid()) OR is_conversation_participant(conversation_id)`, and that function is `SECURITY DEFINER` with `search_path=public`, so its inner query runs as the owner and never re-enters the policy. `relforcerowsecurity = false` confirms the bypass. Also proven behaviourally: dozens of fixture cases read this table as `authenticated` with no `42P17`. The stale "unverified" warning has been removed from `CLAUDE.md` — a false warning sends a future session hunting a bug that does not exist and devalues the entries around it.
- **Messaging follow-gate — BUILT** (request queue, 2026-08-31).
- **Per-message read state — REPLACED and the old column DROPPED** (`20260902120000`). `conversation_participants.last_read_at` is the read cursor; `messages.is_read` is gone. Verified dead rather than merely unused before dropping: no function body, view, index, constraint, policy or trigger referenced it, **and** the data itself carried nothing the cursor cannot reproduce — a cursor cannot express a read/unread/read gap, so that was checked explicitly and found to be zero rows. Dropped without `CASCADE` so an unexpected dependency would fail loudly rather than be silently carried away.

---

## What the grouping reveals

**Three items are one problem: Supabase's permissive defaults.** A1's `qual: true` policies and the full table-level write grants found on `messages`, `conversation_participants` and `conversations` are the same phenomenon — defaults nobody chose that *look* like decisions. The previous doc had the policy half as Tier 1 and the grant half nowhere at all. Together they say: **this database is permissive by default, and every untouched table still is.** One audit pass covers all of it, which makes it the highest-leverage item here.

**Five items are one problem: the schema and the code disagree about the model.** A3, A4, A5, A6 and A7 all reduce to "the database says one thing, the application assumes another" — FKs pointing at `auth.users` where the code wants `profiles`, nullable columns treated as guaranteed, an enum carrying values the product denies, three spellings of "admin", a unique constraint that blocks the workflow it appears to protect. Four of them share a prerequisite: **a data audit before any constraint tightens.**

**Filed as cleanup, actually coherence:** A2 and A5. A2 is the serious one — a migration file disagreeing with a live function body is the exact condition that produced five invented references in this codebase, and it sits directly beneath C3, the next Spotlight work.

**A blocker disguised as a preference:** A6 reads like tidiness but is the single thing preventing `revoke_venue_claim` from being atomic.

**Invisible under the old framing:** A7 lived in `CLAUDE.md` prose rather than the backlog, so it never surfaced as work. It is a live schema defect with a known-good fix pattern already in use on the sibling table.

---

## Spec template

Write this before opening a session. Five lines, and it is the difference between a session executing a plan and improvising one.

```
Item:          [backlog ref or one-line description]
Files touched: [specific paths, if known]
Invariant:     [pull from CLAUDE.md, e.g. "sub_role is a label, never a permission"]
Verification:  [how you'll confirm it worked — e.g. "check rows affected, not just absence of error"]
Rollback:      [what happens if it's wrong, given no staging and no rollback]
```
