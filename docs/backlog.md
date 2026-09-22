# Manolo AI — Backlog

**Source:** reconciled against the live database and repo at `fd48933` (2026-09-01). Every item was checked against `pg_policy`, `pg_constraint`, `pg_indexes`, `pg_proc` or the working tree — nothing is carried forward on trust.

**Why this file is in the repo.** It previously lived only in the owner's project knowledge, which is why a Claude Code session could not find it and why it went stale against `b7e11e6`. Here it sits next to `CLAUDE.md`, gets updated by whoever is working, and stops being a document only one party can see.

**Organized by kind, not urgency.** Urgency is annotated inline. The previous Tier 1-4 sort was useful for picking what to do next but hid that several unrelated-looking entries are one underlying problem — see *What the grouping reveals* at the end.

**How to use this:** pick one item, write the spec (template at the bottom) before opening a session, hand the spec to Claude Code. You decide what gets built; the session executes a plan rather than improvising one.

---

## A. Coherence problems

*Places the system holds two ideas about itself. These produce silent wrongness rather than errors, which is what makes them expensive.*

### A25. `_diag`: RLS disabled, no policies, and anon could read and write it. CLOSED 2026-09-15

**CLOSED by `20260913120000_a25_drop_diag.sql` (`196928e`).** Dropped with `DROP TABLE IF EXISTS public._diag`, no CASCADE, after a pre-apply check confirmed it present. Verified after applying: absent from `pg_tables` and `to_regclass`; its row type, TOAST table and `pg_depend` rows gone; no function, view or policy named it; `public` now holds 20 tables and none lacks RLS or a policy. `types.ts` was regenerated in the same commit, and the only change was removal of the 30-line `_diag` block.

**Production led the repo.** The migration was applied through the Management API before it was committed, and a machine restart then interrupted the finishing steps, so for that interval the drop existed in production with no committed file and no ledger row.

**The platform then re-applied it after the push, and the re-application was a clean no-op against an already-absent table.** Confirmed 2026-09-15 by the ledger row for `20260913120000` appearing and by the drop's call count in `pg_stat_statements` going from 2 to 3. The third call is attributed to the platform, not to the session's own rolled-back re-apply test (which also passed: no error, public relations 93 to 93, fingerprint unchanged), because that test ran the drop inside a `DO` block and `pg_stat_statements.track = top` does not count nested statements. **This is the first re-application this backlog records as observed completing on a migration written to be idempotent, rather than inferred from stored statement text.** It belongs with A16 as much as here; see A16.

**Origin, established 2026-09-13.** Created by a Claude Code session on 2026-09-02 at 08:56:37 UTC, running a scratch file named `diag.sql` with `npx supabase db query --linked`. The file's header described it as "Read-only" while it executed DROP TABLE, CREATE TABLE and INSERT. It copied what `conversation_summary` returned to the manager account into a table. Evidence: `pg_stat_statements` recorded the CREATE exactly once, as `postgres`, at 08:56:37.68 UTC, with no evictions since its last reset on 2026-07-28, and its recorded text begins with `diag.sql`'s own comment line; the table, its row type and all three rows shared transaction id 10198; the session transcript shows the file written at 08:55:51 UTC and run at 08:56:18 UTC. It was never in a migration. `types.ts` picked it up an hour later, in an unrelated regeneration at `526e798`. A later session saw `_diag` in the types on 2026-09-05 and moved on without recording it. The process finding is recorded in CLAUDE.md, beside "Diagnostic calls can be mutations".

**What it held and who could reach it, corrected from the original entry:**

- RLS off, no policies. `anon` and `authenticated` each held all seven table privileges: SELECT, INSERT, UPDATE, DELETE, **TRUNCATE, REFERENCES and TRIGGER**. The original entry listed only the first four.
- 3 rows: two `venue` threads (The Ritz Ybor, 2001 Odyssey) and one `dm`, with conversation ids, venue ids, and a `participants` column holding each participant's display name and username. **On row 3, `display_name` and `thread_title` held the placeholder text `(NULL)`**, written by `diag.sql`'s `coalesce`, not data; the original entry called them populated on all 3. Row 3's `venue_id` was likewise the placeholder `(null)`.
- Nothing read or wrote it. `pg_stat_statements` held no statement naming it from any role but `postgres`, and its 5 sequential scans were all accounted for by the creating run and the investigation's own reads (inferred).

### A1. Permissive `USING (true)` policies make their narrower siblings inert: six tables, and the fix must add before it removes

**Status 2026-09-22: `venues` DONE. Five tables still carry the shape: `profiles`, `venue_staff`, `venue_followers`, `events`, `portfolio_items`.**

- **Phase 1, `a688980` (`20260920120000`):** added three PERMISSIVE SELECT policies on `venues` for `authenticated`, removing nothing: owner (`auth.uid() = owner_id`), admin (`(SELECT is_admin())`) and active staff. The staff policy goes through a SECURITY DEFINER helper, `is_active_venue_staff`, because reading `venue_staff` directly closes a cycle with the five `venue_staff` policies that read `venues`. Measured on temp tables in a rolled-back transaction: that cycle raises `42P17`, and a permissive `USING (true)` on the second table does not mask it.
- **Phase 2, `4d99d2d` (`20260921120000`):** dropped exactly the two `USING (true)` policies, inside a DO block behind a check that the three phase 1 policies exist, so nothing is dropped unless that check passes, whatever runs the file. Rehearsed first in a rolled-back transaction ("A1 REHEARSAL PASSED: all 6 assertions"), then verified against the live state as real roles with real claims: "A1 PHASE 2 LIVE CHECK PASSED: all 5 checks | policies=6 | anon venues=15 closed=0 | owner closed=2 | staff closed=2 thread_titles=2 | admin venues=17".
- `venues` now holds 6 policies. The two `is_active` policies are duplicates of each other and were left for a separate cleanup. The `venues` row of the inert-policy table below is resolved; the rest of this entry is kept as the record it was written from.
- **On `venues`, A31 (column exposure) is now the larger remaining exposure.** The rows are bounded; all 28 columns of every readable row are not.
- **`20260921120000` (phase 2) now raises if it is ever re-applied on its own, and that is left as is deliberately.** Its first statement checks that the three phase 1 policies exist and raises if any is missing, and A8's reversal (`787e0fb`, `20260922120000`) removed all three. So a lone re-run of phase 2 aborts with `A1 phase 2 aborted: phase 1 policies missing on public.venues`. Left unamended for three reasons: **it fails safe**, since the check and the drops are in one DO block with the drops after the check, so nothing is dropped when it raises; **a normal sync will not re-run it**, because it already carries a ledger row (A16); and **a full in-order replay converges**, because phase 1 runs before it and recreates the three policies, then A8 removes them again at the end. Amending the file would create ledger drift against its stored statement text, which is the thing A16 measures. See A16.
- **Superseded in part on 2026-09-22 by an owner decision recorded in A8: a venue is always visible, and `is_active` is display only.** Phase 2's row narrowing is being reversed on purpose. The trap A1 removed stays removed: the end state is a single `USING (true)` SELECT policy with nothing inert beside it, which means the two `is_active` policies, the three phase 1 policies and `is_active_venue_staff` all go. Read A8 for the reasoning and the intended end state; this entry stays as the record of what was found and shipped.
- **`venue_staff` is the next one to be careful with.** Its `USING (true)` is what serves the public roster on Discovery, the venue page and talent profiles, and no narrower policy admits guests or anon, so it needs the same add-before-remove treatment.

**Rewritten 2026-09-13 from a fresh live dump:** `pg_policies` for all 21 tables in `public`, grants via `has_table_privilege` and `has_column_privilege`, exact row counts, and a read of every caller in `src/` and the edge functions. The previous version of this entry was right about `venues`, `venue_staff` and `venue_followers`, **wrong about `tickets`**, and missed `profiles`, `events` and `portfolio_items`.

Permissive policies OR together, so one `USING (true)` admits every row, and every narrower permissive policy for the same command and an overlapping role is dead. Postgres logs nothing; it just returns more rows. Measured: every `true` policy below is scoped to `{public}`, which covers `anon` and `authenticated`, so it overlaps every sibling. No `1=1`-style equivalent exists, and there is no RESTRICTIVE policy anywhere in `public`.

**Correction: `tickets` does not have this shape.** Its count of 15 policies holds, but its only `true` policy is "Service role can do everything", scoped to `{service_role}`, and `service_role` has `rolbypassrls = true` (measured), so that policy is never consulted. `tickets` has different permissive problems, recorded in A26 and A27.

**The inert policies, measured:**

| Table | SELECT policies with `true` | Inert because of them |
|---|---|---|
| venues | "Allow public read access for venues", "Enable read access for all users" | "Anyone can view active venues", "Public venues are viewable by everyone" |
| venue_staff | "Enable read access for all users" | "Managers can view staff for their owned venues", "Managers view venue staff", "Talent view own status" |
| venue_followers | "Public can view venue follower counts" | "Users can view their own venue follows", "Venue managers can view venue followers", and the SELECT part of ALL "Users can manage their venue follows" |
| profiles | "Public Read Access", "Public profiles are viewable by everyone" | "Users can see own profile" |
| events | "Events are public" | "Public can view active events", and the SELECT part of both ALL owner policies |
| portfolio_items | "Portfolio items are viewable by everyone" | The SELECT part of ALL "Users can manage own portfolio" |

**What the rows actually hold, ranked by content.** `anon` and `authenticated` hold SELECT on every column of all six tables (table-level grant, measured). Counts measured 2026-09-13 as aggregates; no values were read.

| Rank | Table | Rows | What anon can read |
|---|---|---|---|
| 1 | `profiles` | 5 | Real accounts: 1 guest, 3 talent, 1 manager, so `role_type` identifies the manager and guest accounts. Populated: `city` on 5, `display_name` on 4, `bio` on 2. Empty today: `full_name`, `location`, `website`, `total_lifetime_spend` (0 nonzero) and live presence (0 tapped in). Those columns become public the moment they are filled. |
| 2 | `venue_staff` | 2 | Both `active`: one person at two venues, `commission_rate` set on both. No public reader selects `commission_rate`. |
| 3 | `venues` | 17 | 15 open, 3 owned, 2 business-verified. Beyond directory data: `owner_id` (joins to a profile), and `commission_rate`, `standard_commission` and `table_min_spend` on all 17. `settings` empty on all, `subscription_tier = 'free'` on all, `ticketing_enabled` on 0. |
| 4 | `venue_followers` | 1 | One person following one venue. |
| 5 | `events` | 2 | Both active, price and description set. No reader in code. |
| 6 | `portfolio_items` | 0 | Empty. |

`posts` and `post_likes` each carry a lone `true` SELECT with no narrower sibling, so they are outside this shape: `posts` exposes its 1 inactive row of 2, and `post_likes` exposes who charged which post (1 row).

**Whether the app depends on the wide read** (read from code 2026-09-13):

- `venues`: **yes, heavily, and there is no owner-scoped or admin-scoped SELECT.** The narrower policies are only `is_active = true`. Closed venues shown publicly: `Discovery.tsx:204`, `Venue.tsx:74`, `TalentProfile.tsx:66`. Owners reading their own venue whatever its state: `UserModeContext.tsx:81`, `useVenueStatus.ts:20-24`, `VenueManage.tsx:95`, `ManagerDashboard.tsx:166` and `184`, `VenuePriceEditor.tsx:37`. Unowned venues for claiming: `ClaimVenueModal.tsx:40-44`, `VenueManage.tsx:69-71`. Admin: `CEODashboard.tsx:82-86`, embeds at 57 and 72. And `conversation_summary`, which is `security_invoker` and LEFT JOINs `venues` for `thread_title`.
- `venue_staff`: **yes, for the public roster:** `Discovery.tsx:204` (embed, any viewer including anon), `Venue.tsx:77-81`, `TalentProfile.tsx:64-68`. CLAUDE.md records the full-roster facepile as deliberate. Every other reader is own-row or manager-scoped and covered by a narrower policy. The row read is intended; the `commission_rate` column is needed by no public reader.
- `venue_followers`: **no dependence found.** Only `Discovery.tsx:212` and `useFollow.ts:83-88` read it, both for the caller's own follows. Nothing reads follower counts, despite the policy's name.
- `profiles`: **yes, everywhere:** directory, public profiles, feed, messaging (`conversation_summary` joins it for names and avatars; `useChat.ts:244`), staff lists, CEO dashboard, payouts. The row read is intended; **the exposure is in the columns.** `select("*")` at `TalentProfile.tsx:46` and `GuestProfile.tsx:40`, and `profiles:user_id (*)` at `Index.tsx:87`, would have to change under any column-level fix.
- `events`: **no.** Nothing in `src/` or the edge functions reads or writes it.
- `portfolio_items`: **yes, for viewing someone else's portfolio:** `PortfolioGallery.tsx:24-28`, mounted at `TalentProfile.tsx:142`.

**Sequencing: add the missing policies first, then remove the `true` ones. The reverse order takes the app down.** This is the finding that determines how A1 is done.

- **`venues`.** No SELECT policy admits an owner reading their own closed venue, or an admin. Remove the `true` policies first and an owner of a closed venue (2 of 17 are closed today; which ones was not measured) can no longer read it: `useVenueStatus` returns nothing, so `DashboardGuard` shows Access Denied on `/dashboard` and `/bouncer`, and the venue drops out of `UserModeContext`'s list. **And 20 policies across 7 tables filter through `venues WHERE owner_id = auth.uid()`**, an inner read that runs under the caller's RLS, so they stop matching that venue too:

  | Table | Policies that read `venues` |
  |---|---|
  | `tickets` | 7: `Admin_Full_Access`, `Manolo_AI_Admin`, `Manolo_AI_Owner_Access`, `Strict_Owner_Access`, `Unified_Venue_Access`, "Staff and Managers can view venue tickets", "Managers can update ticket commissions" |
  | `venue_staff` | 5: "Managers can delete staff for their owned venues", "Managers invite talent to their venue", "Managers can view staff for their owned venues", "Managers view venue staff", "Managers can update staff for their owned venues" |
  | `events` | 2: "Managers can manage their own venue events", "Owners can manage their events" |
  | `payout_history` | 2: "Managers insert payouts for verified venues", "Managers can view payout history" |
  | `payout_requests` | 2: "Managers can view venue payout requests", "Managers can update payout requests" |
  | `venue_business_applications` | 1: "Owners create own pending business applications" |
  | `venue_followers` | 1: "Venue managers can view venue followers" |

  They are spelled three ways (`venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid())`, `auth.uid() IN (SELECT owner_id FROM venues WHERE id = ...)`, and one `EXISTS`), and all of them read `venues` as the caller. The owner of a closed venue would lose its tickets, staff management, events, payouts and business application; the claim list, the CEO dashboard, closed venue pages and closed venue thread titles would empty as well. Inferred from the policies and the code, not exercised.
- **`profiles`.** Remove both `true` SELECTs and only "Users can see own profile" remains, so every read of another user's profile returns nothing: the directory, public profiles, feed authors, messaging names and avatars, staff lists, CEO owner names and payout names all empty. Same order: add the policies for what must stay readable first, then remove.
- **`venue_staff` and `portfolio_items`** also break for guests and anon (the public roster, someone else's portfolio), since no narrower policy admits them. The four `tickets` policies that read `venue_staff` key on the caller's own row, which "Talent view own status" still admits.
- **`venue_followers` and `events`:** no break found. "Public can view active events" still admits both event rows.
- **Removing one of two duplicate `true` policies on `venues` or `profiles` changes nothing**, because its twin still admits everyone. A partial fix will look applied and do nothing.

**A9's shape on the same tables:** a table-level write grant with a policy that bounds only the row. Grants measured 2026-09-13; consequences inferred from the policies, not exercised.

- **`venue_staff`: confirmed.** `authenticated` holds table-level INSERT and UPDATE on all 7 columns, and neither trigger on the table (`venue_staff_clear_check_in`, `venue_staff_sync_conversation`) guards a column.
  - "Talent respond to their own invitations" checks only `auth.uid() = user_id` and the new `status`. A talent accepting an invite could, in the same UPDATE, rewrite `venue_id` to a venue that never invited them and set their own `commission_rate`, limited only by `unique_venue_user_connection`.
  - "Talent request to work a venue" does not constrain `commission_rate` either, and approval (`ManagerApprovalPanel.tsx:85`) updates only `status`, so a self-chosen rate would survive approval.
  - "Managers can update staff for their owned venues" checks only `venue_id`, so a manager could rewrite `user_id` to any profile and set `status = 'active'`, bypassing the invite consent that the INSERT policy pins. Already recorded in A17; now backed by this grant measurement.
- **`venues`: confirmed.** "Managers can update their own venue" bounds the row to the owner, and `authenticated` holds UPDATE on all 28 columns. The live trigger bodies guard `business_verified` always, `owner_id` against reassignment between two users, and `is_active`, `active_at`, `entry_price` and `vip_price` **only on unverified venues**. Unguarded for any owner: `commission_rate`, `standard_commission`, `table_min_spend`, `base_price`, `subscription_tier`, `ticketing_enabled`, `settings`. **So an owner could enable the paid tier or ticketing for themselves.** Unused today: all 17 are `free` and 0 have ticketing enabled.
- `events`, `venue_followers`, `portfolio_items`: the same shape at own-row scope, low impact.
- `profiles`: UPDATE closed by A9 (8 columns, re-measured). INSERT is still table-level on all 22 columns including `role_type`, bounded only by `auth.uid() = id`. Unreachable for an existing account because `handle_new_user` already inserted the row (inferred), and `prevent_profile_privilege_escalation` fires on UPDATE only (measured).
- `anon` holds table-level writes on all six too, but every write policy keys on `auth.uid()`, which is NULL for anon, so none passes (inferred from the predicates).

**Stale comment.** `Venue.tsx:85-86` says the own-row read is "Self-scoped by the 'Talent view own status' policy". That policy is inert beside "Enable read access for all users"; the query's own `.eq("user_id", session.user.id)` is what scopes it. The outcome is right and the stated mechanism is wrong, which makes a dead policy look live. Recorded here; the comment itself was not edited in this pass.

**Re-dump before fixing.** This schema has recorded cases of migration files disagreeing with live bodies, and this entry is itself a correction of a previous one.

### A31. Column exposure on `venues` outranks what A1 leaves behind on that table

Found 2026-09-13, re-measured 2026-09-16. **Rank this against A1, not under it. Once A1's phase 2 lands, this is the larger remaining exposure on `venues`.**

Measured: `anon` and `authenticated` hold table-level SELECT on all 28 columns of `venues`. A1's policy work bounds which **rows** a caller reads and changes nothing about which **columns** come back, so for every one of the 15 active venues anyone holding the public anon key can still read `commission_rate`, `standard_commission` and `table_min_spend` (set on all 17 rows), plus `owner_id`, `subscription_tier` and `ticketing_enabled`. Phase 2 narrows anon from 17 venues to 15; it does not narrow a single column.

The fix is A9's shape on a second table: revoke the broad SELECT, grant only the columns the app reads. **Blocked on narrowing the callers first.** A column grant makes a query that names an ungranted column fail with `42501` rather than return a narrower row, and three readers ask for everything: `Venue.tsx:74` and `VenueManage.tsx:95` use `select("*")`, and `Index.tsx:87` embeds `venues:venue_id (*)`. `UserModeContext.tsx:81`, `CEODashboard.tsx:82-86` and `TalentProfile.tsx:55` already name their columns and would survive unchanged.

Same coupling A9 recorded: the grant list has to be derived from the code, and every new column read later needs a new GRANT. That failure is loud, which is the point.

**Promoted 2026-09-22: this is now the ONLY remaining control on `venues`.** The owner decision recorded in A8 makes every venue row public by design, so the row layer stops separating anything on this table. The separation between a venue's public profile, which is meant to be world-readable, and its commercial terms, which are not (`commission_rate`, `standard_commission`, `table_min_spend`, and arguably `owner_id`, `subscription_tier` and `ticketing_enabled`), lives entirely at the column layer. There is no second line behind it: no policy will hide a row from anyone, so a column that is granted is a column that is published.

That also changes how the blocker reads. Narrowing `select("*")` at `Venue.tsx:74` and `VenueManage.tsx:95`, and `venues:venue_id (*)` at `Index.tsx:87`, was previously a chore in front of a fix; it is now the whole gate in front of the only boundary this table has left.

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

**DECISION (owner, 2026-09-22): a venue is always visible. `venues.is_active` is a display concern and never a visibility control. SHIPPED 2026-09-22 by `20260922120000_a8_venues_public_read.sql` (`787e0fb`).**

`public.venues` now carries exactly two policies: `"Venues are readable by everyone"` (SELECT, PERMISSIVE, `TO public`, `USING (true)`) and `"Managers can update their own venue"` (UPDATE, unchanged). The two `is_active` policies and the three A1 phase 1 policies are gone, and `is_active_venue_staff` was dropped with the policy that was its only caller. Rehearsed first in a rolled-back transaction as real roles ("A8 REHEARSAL PASSED: all 9 assertions", anon closed 0 to 2, anon total 15 to 17, non-owner UPDATE 0 rows, owner UPDATE 1 row, staff thread titles 2, admin total 17), with a before-and-after snapshot confirming nothing persisted. Verified live after applying: the two policies above, the helper gone, and an unchanged md5 over every venue row.

A venue is a real public place. Hiding its row protects nothing: a bar's name, address and category are public facts, and a closed bar is still somewhere people look up. `is_active` means open for business right now. It drives a badge, the ordering of Discovery and the presence rule in `src/lib/presence.ts`, and it must never decide whether a row can be read.

What this settles, so it does not get re-litigated:

- A venue card on Discovery leads to that venue's profile page, and that page renders in full whatever `is_active` says: hero reel, evergreen content, posts. A closed venue is a venue with no "open" badge, not a missing one.
- **Venues have no directory; talent does.** There is no listed-versus-unlisted state for a venue to be in, so no reading of `is_active` as "on the platform" is correct.
- Visibility is not conditional on ownership, staffing or verification either. Those bound who may **write** a venue, and, through A31, which **columns** a reader gets. They do not bound whether the row exists to a reader.

**Intended end state for `public.venues`:** one SELECT policy, `USING (true)`, for everyone; the UPDATE policy unchanged; the two `is_active` SELECT policies removed, because `is_active` no longer controls visibility; and the three A1 phase 1 policies removed, because a policy admitting every row makes them inert and leaving inert policies is the exact trap A1 existed to remove. `is_active_venue_staff` goes with them: measured 2026-09-22 through `pg_depend`, its only dependent is the policy being removed.

**This reverses part of A1 phase 2 deliberately. It is a decision, not a correction of a mistake.** A1's finding stands and its main result is kept: `venues` carried two `USING (true)` policies beside two narrower ones that were therefore inert, and that trap is gone. Phase 2 additionally narrowed **which rows** the surviving policies admit, and that narrowing is what this decision reverses. The end state is the opposite of the trap rather than a return to it: one policy, saying exactly what it does, with nothing inert beside it. See A1 for the migrations and A31 for what still bounds this table.

### A9. `profiles.heat_score` is user-writable, and the grant is why. CLOSED 2026-09-09

**CLOSED by `20260909120000_profiles_column_grants.sql`.** `authenticated` now holds UPDATE on exactly 8 of 22 columns and `anon` on 0. Verified after applying at the column layer rather than at `relacl`: `heat_score` is false for both, true for `postgres`; `role_type` remains true for `service_role`; `relacl` shows `anon=ardDxtm` and `authenticated=ardDxtm`, the `w` gone from both, while `postgres` and `service_role` keep `arwdDxtm`.

**The coupling this created, which is the cost of the change.** `heat_score` integrity now depends on `apply_talent_charge()` remaining `SECURITY DEFINER` owned by `postgres`, the `profiles` owner. Verified live at ship time: `prosecdef=true`, `owner=postgres`, `search_path=public`, and `postgres` holds implicit owner UPDATE on `heat_score` despite `rolsuper=false`. Flipping that function to `SECURITY INVOKER`, or changing its owner, makes every post like fail with `42501`: loud, since the trigger is `AFTER INSERT` and the raise aborts the like. **Before this migration that flag was inert**, because `authenticated` could write `heat_score` directly. That is the whole point of the change.

**Every non-client writer was enumerated before shipping**, since a `SECURITY INVOKER` one would have been a launch-breaking regression. All three foreign-table triggers (`apply_talent_charge` on `post_likes`, `clear_check_in_on_staff_change` on `venue_staff`, `handle_new_user` on `auth.users`) are `SECURITY DEFINER` owned by `postgres`. `admin-actions` writes `role_type` as `service_role`. No `SECURITY INVOKER` writer exists, and no rule rewrites into `profiles`. Note `apply_talent_charge` writes `heat_score` and `heat_updated_at`, **neither of which is granted**, so it is the one that would have broken; `clear_check_in_on_staff_change` writes three columns that are all in the grant and would have survived either way.

**A measurement lesson worth more than the fix.** The first fixture reported `updated_at` NOT stamped on three of four writes and looked like a failure. It was not: `update_updated_at_column()` sets `NEW.updated_at = now()`, and `now()` is `transaction_timestamp()`, constant for the life of a transaction, so only the first write in a transaction can show a change. The probe asked "did the value change" when the question was "did the trigger fire". Corrected by running one write per transaction and comparing against a stored original rather than a value read inside the same transaction. **The grant list was never adjusted to make it pass.**

The one-write-per-transaction fixture ran on 2026-09-09 at 22:06 UTC and again on 2026-09-10 at 10:49 UTC, the second time against the applied A9 grants rather than fixture-applied ones. Both runs stamped on all four write shapes. Four distinct `now()` values per run confirm four distinct transactions.

The original entry, kept because the reasoning is the reusable part:

---


Found 2026-09-05 while reading `profiles`' grants before adding a column. Three facts that are individually fine and jointly are the hole:

| Piece | Measured value |
|---|---|
| UPDATE policy `Users can update own profile` | `USING (auth.uid() = id)` |
| Grant in `relacl` | table-level `arwdDxtm` for `anon` and `authenticated`, so UPDATE spans all 22 columns |
| Row triggers on `profiles` | `enforce_check_in`, `prevent_privilege_escalation` (guards `role_type` only since 2026-08-17), `update_profiles_updated_at` |

**Nothing guards `heat_score`.** The policy admits the row and no grant bounds which columns of it get rewritten, so an authenticated user can PATCH their own `heat_score` to any value. That column is the talent heat ranking, and it is maintained by an `AFTER INSERT` trigger on `post_likes` **specifically so the decay cannot be duplicated or gamed**. A direct write bypasses the trigger and sets the score outright.

This is the exact failure `CLAUDE.md`'s grants-before-policy rule describes, now found on a fourth table. **Fix shape is the one already used twice**, on `messages` (`20260830140000`) and `conversation_participants` (`20260831100000`): revoke the broad UPDATE, grant only the columns a user may edit, leave the rest ungranted. Column grants fail loudly with `42501` and fail closed, which is why they are the right tool rather than another trigger.

**Inferred from the schema, not demonstrated.** Demonstrating it means performing the write, and the only rows available are real accounts. Read the grants and the trigger list before fixing rather than trusting this entry.

**Re-derived from live 2026-09-07 rather than trusted, and it held.** Two corrections and one addition:

- **22 columns, not 21.** `sort_name` landed in `ad56d21` after this entry was written. Does not change the conclusion.
- **The UPDATE policy has no explicit `WITH CHECK`.** Postgres falls back to `USING`, so `id` stays pinned and a row cannot be reassigned to someone else, but nothing constrains *which columns* get rewritten. That is A1's "USING with no WITH CHECK" shape, on a third table.
- **The grant list is EIGHT columns, derived from the code rather than guessed.** Every `.update()` in `src/` was enumerated and resolved to its table; exactly three target `profiles`:

| Site | Columns |
|---|---|
| `TalentManage.tsx:82` | `display_name`, `sub_role`, `bio` |
| `TalentDashboard.tsx:212` | `is_active`, `current_venue_id`, `active_at` |
| `InteractiveHeroReel.tsx:76` | `hero_reel_url`, when `entityType === 'talent'` |

`InteractiveHeroReel` writes to a **variable** table name (`entityType === "venue" ? "venues" : "profiles"`) and is the one a naive grep misses. There is no INSERT or UPSERT on `profiles` from `src/` at all; row creation is entirely `handle_new_user()`.

**`avatar_url` is the eighth and is added deliberately despite having no writer.** It is rendered on `TalentProfile` and has no write path anywhere in `src/`, which is an omission rather than a decision (see A12). Granting it now avoids a `42501` the day an avatar editor ships.

**The maintenance cost is real and is the right trade:** a new profile field means a new GRANT, and forgetting one fails loudly at runtime with `42501`. The behaviour it replaces failed silently and permissively.

**Nothing legitimate gets locked out.** Measured: zero `SECURITY INVOKER` functions write `profiles`. Every writer (`apply_talent_charge`, `clear_check_in_on_staff_change`, `handle_new_user`) is `SECURITY DEFINER` and runs as owner, and `admin-actions` writes `role_type` as `service_role`, whose grant is untouched. One residual is unmeasured: whether a `BEFORE` trigger setting `updated_at` requires the caller to hold UPDATE on that column. It should not, since privilege checks apply to the statement's target columns, but that is reasoning rather than measurement and is cheap to settle with a rolled-back fixture before shipping.

**Two smaller things from the same reading, recorded here rather than as their own items.** `anon` holds `d` (DELETE) and `D` (TRUNCATE) on `profiles`. DELETE is masked by the absence of a DELETE policy. **TRUNCATE is not subject to RLS at all**, so nothing masks it; it is unreachable only because `anon` is `NOLOGIN` and PostgREST exposes no TRUNCATE verb. Latent rather than live, but it is masked by circumstance rather than by a boundary. `profiles` also carries duplicate policy pairs (two `USING true` SELECTs, two INSERTs), which is A1's shape on another table.

### A10. `idx_profiles_active_talent` indexes the orphan venue column

`(venue_id, role_type, updated_at) WHERE venue_id IS NOT NULL AND role_type = 'talent'`. But `profiles.venue_id` is the FK-less orphan recorded in A3; the column the application actually uses is `current_venue_id`.

Grepped `src/` 2026-09-05: every profile-related `venue_id` reference is `current_venue_id`, `venue_staff.venue_id`, or `posts.venue_id`. **Nothing filters `profiles.venue_id`.** Measured `idx_scan = 0` since the postmaster started on 2026-07-28 with statistics never reset, though at 5 rows a sequential scan would win regardless, so the zero is consistent with this rather than proof of it.

**Why this belongs here and not in Cleanup:** `CLAUDE.md` names this index as one of exactly two objects that a full `app_role` collapse would have to drop and recreate, and that cost is part of why A5 stays deferred. So some of A5's price is being paid to preserve an index built on the wrong column. Resolve this before pricing A5, not after.

### A11. The portfolio is built and broken three ways, all silent

Found 2026-09-07. The talent profile portfolio is **not missing**. `PortfolioGallery.tsx` is a real horizontal scroller (`overflow-x-auto snap-x snap-mandatory`), `portfolio_items` is a real table with RLS, two policies, a `media_type` CHECK, an FK and a `UNIQUE (user_id, display_order)`, and `PortfolioUpload.tsx` is a working uploader. None of it functions.

**1. The reader names a column that does not exist.** `PortfolioGallery.tsx:81` renders `src={item.image_url}`. The column is **`media_url`**. Every card would render `<img src={undefined}>`.

**The reader/writer split is the detail worth keeping.** `PortfolioUpload.tsx:64` inserts `media_url` **correctly**. So the schema is right and the writer is right; only the read side is wrong. Nothing catches it because the fetch is `.select("*")` into `useState<any[]>([])`, so no typed boundary exists. Seventh invented reference. `media_type` is also never consulted, so a stored `'video'` would be forced through an `<img>` tag.

**2. Nothing mounts the uploader.** `PortfolioUpload` is imported by **zero** files. The gallery's own empty state reads "Use the Dashboard to upload professional content", and no such control exists. `TalentManage.tsx` numbers its sections `1. HUD HEADER`, `2. HERO REEL EDITOR`, `4. IDENTITY SETTINGS`. **Section 3 is missing**, which is where the uploader would have sat.

**3. The venue gallery cannot hold a row at all.** `Venue.tsx:229` passes `venue.id` as `userId`, but `portfolio_items.user_id` is `FOREIGN KEY ... REFERENCES profiles(id) ON DELETE CASCADE`. A venue id is a different id space, so no row can ever exist for a venue. Not an empty gallery, an impossible one.

**Measured: 0 rows in `portfolio_items`, and no object under a `portfolio/` prefix in the `profile-media` bucket.** That is why none of this has surfaced. Fixing (1) alone would make (2) the visible blocker; fixing (2) would make (3) visible on the venue side only.

### A12. `bio` and `sub_role` are editable and rendered nowhere

`TalentManage.tsx:82` writes `display_name`, `sub_role` and `bio`. `TalentProfile.tsx` renders `hero_reel_url`, `display_name`, `username` as a fallback, and `avatar_url` **only as the hero reel's fallback image**. It renders neither `bio` nor `sub_role`.

**A talent writes a bio into the void.** `sub_role` at least surfaces elsewhere, on the Discovery card and in the directory, so a talent's position is visible everywhere except their own profile page. `bio` has no reader anywhere.

The mirror of it: **`avatar_url` is rendered but has no writer** in `src/`, which is why A9's grant list includes it. Also never written from anywhere: `username` (so nobody can set one after signup, which is why 2 of 3 talent have none), `full_name`, `website`, `location`, `city`, `banner_url`. `banner_url` is a real column with no reader and no writer.

Filed as coherence rather than a feature request: the system collects a field and then does not believe in it, which is the same shape as A8.

### A15. Two SECURITY DEFINER functions perform no caller authorization

**Ranked above A13, which is why it appears first despite the higher number.** Found 2026-09-09 reading the two live function bodies that A13 was opened for. The `search_path` question turned out to be the smaller half; this is the real finding.

**Both are `SECURITY DEFINER`, so both bypass RLS on `tickets` and `profiles` entirely.** Both carry EXECUTE for `anon`, `authenticated`, `authenticator`, `service_role` and **PUBLIC** (the leading `=X` in `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`). Neither body calls `auth.uid()` or checks the caller in any way.

**`get_unpaid_commissions(venue_id_input uuid)` is the serious one.** It takes `venue_id_input` from the caller and never verifies the caller owns that venue, is staff there, or is signed in at all. It returns promoter `full_name`, `username`, ticket counts and unpaid commission totals for **any** venue id. Cross-reference A1: `venues` carries a `qual: true` SELECT policy, so venue ids are world-readable. **There is no secret to guess.** PII plus financial data, no gate, across all 17 venues.

**`check_in_guest(qr_input text, current_venue_id uuid)` is a mutation.** It marks a ticket `used` and stamps `scanned_at`. It does check that the supplied `venue_id` matches the ticket's, but `venue_id` is public, so **the only real secret is the QR code**. The missing caller check means burning a ticket does not require being at the door: anyone holding the QR, including from a photo of it, can invalidate it remotely.

**Current scale, measured:** `tickets` 6 rows, `payout_history` 0 rows, and ticketing is deliberately dormant in the shipped UI. Bounded today.

**Trigger condition: this goes live the day ticketing is surfaced.** Filed as a **gate on that work, not a standalone task**. Whoever turns ticketing on must close this first, because that is exactly the moment nobody will be re-reading these two function bodies.

**Owner ruling (2026-09-10): payouts are visible to the venue owner and managers only.** Not door staff, not bouncers, not general `venue_staff` membership. This settles the open question this entry previously recorded (owner, venue staff, or an admin).

**The ruling cannot be fully implemented against the current schema. Recorded as a SCHEMA GAP, not as a revised rule.** The product model includes managers who do not own the venue they manage, and the schema cannot represent them:

- `venue_staff.staff_role` is constrained by `venue_staff_staff_role_allowed` to nine values: `host`, `entertainer`, `dj`, `bartender`, `bottle_girl`, `promoter`, `media`, `security`, `event_staff`. None means manager or owner.
- Ownership exists only on `venues.owner_id`.
- `profiles.role_type = 'manager'` is account-level and venue-agnostic. It identifies someone as a manager without identifying which venue, so as a gate it would admit a manager of a different venue.

So no per-venue manager is expressible today. See A17.

**Consequence: the A15 gate can only enforce owner-only for now. That is a partial implementation of the ruling, not the ruling.** Recorded explicitly so that owner-only is never later mistaken for the decision. The ruling is unchanged; owner-only is simply all the schema can express until A17 is closed.

**The ruling is already violated beneath the RPC.** Three `tickets` policies admit active venue staff to read ticket rows directly, including `commission_earned` and `promoter_id`. Measured live:

| Policy | Command, roles | Admits |
|---|---|---|
| "Staff and Managers can view venue tickets" | SELECT, authenticated | owner or active staff |
| `Unified_Venue_Access` | ALL, public | owner or active staff |
| "Venue staff can read venue tickets" | SELECT, public | active staff only |

None of them looks at `staff_role`, so a host or a bouncer at a venue can already read payout-relevant columns without calling `get_unpaid_commissions`. **Gating the function alone does not satisfy the ruling.** `Unified_Venue_Access` is `FOR ALL`, so it admits active staff for every command, not only reads; the table grants on `tickets` for those writes were not measured in this pass.

**No helper exists for "caller owns, or is active staff at, venue X".** Read live 2026-09-10. `is_addable_group_member(_owner, _member)` takes two arbitrary ids and no venue, and never reads `auth.uid()`; `sync_venue_conversation` and `create_group_conversation` write rows; `is_admin()` checks one hardcoded email. The predicate lives inline across **23 policies in four distinct shapes**:

| Shape | Predicate | Policies |
|---|---|---|
| Owner only | `venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid())`, or the equivalent `auth.uid() IN (SELECT owner_id FROM venues WHERE id = <table>.venue_id)`, or `auth.uid() = owner_id` on `venues` itself | 15: `events` 2, `payout_history` 1 (SELECT), `payout_requests` 2, `tickets` 5, `venue_business_applications` 1, `venue_followers` 1, `venue_staff` 2, `venues` 1 |
| Owner and business-verified | `venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid() AND business_verified)` | 4: `payout_history` INSERT, and `venue_staff` DELETE, UPDATE and the invite INSERT |
| Owner or active staff | `venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid() UNION SELECT venue_id FROM venue_staff WHERE user_id = auth.uid() AND status = 'active')` | 2: "Staff and Managers can view venue tickets", `Unified_Venue_Access` |
| Active staff only | `EXISTS (SELECT 1 FROM venue_staff WHERE user_id = auth.uid() AND venue_id = tickets.venue_id AND status = 'active')` | 2: "Venue staff can read venue tickets", "Venue staff can scan tickets" |

**A1 confirmed live.** `venues` carries two PERMISSIVE SELECT policies with `USING true` ("Allow public read access for venues", "Enable read access for all users"), `anon` holds SELECT on `id`, and there are 17 rows. That is what makes `get_unpaid_commissions` enumerable: every venue id it accepts is readable by anyone.

**Revoking EXECUTE from `anon` and PUBLIC breaks no call site.** Both functions are reachable only after sign-in. `PayoutsPanel` renders only inside `DashboardGuard`, which requires a session and ownership (`Dashboard.tsx:37`, `DashboardGuard.tsx:63`, `useVenueStatus.ts:15`). `/bouncer` requires `activeVenueId`, which is set only for a signed-in manager from the venues they own (`App.tsx:56-63`, `UserModeContext.tsx:44` and `81-88`). Both calls carry the session token and run as `authenticated`, which holds its own explicit grant (`authenticated=X/postgres`), independent of the `=X` PUBLIC and `anon=X` entries. Every guard above both call sites is client-side; none constrains a direct RPC call made with the anon key.

**`plpgsql.variable_conflict` is `error`.** Measured live, with no database or role override, no `#variable_conflict` directive in either body, and `proconfig` NONE on both. `get_unpaid_commissions` declares `RETURNS TABLE(full_name, promoter_id, ticket_count, total_unpaid, username)`, and those output columns are plpgsql variables that collide with real column names: `promoter_id` (`tickets`, `payout_history`), `ticket_count` (`payout_history`), `full_name` and `username` (`profiles`). Every reference in the body is alias-qualified today. Under `error`, a future unqualified reference raises `column reference is ambiguous` rather than silently changing a predicate. **That safety depends on the mode staying `error`**: under `use_variable` the same reference would resolve silently to the variable. The mode was measured in the Management API session; that PostgREST sessions use the same value is inferred from the absence of any override. `check_in_guest` has no such collision: neither of its parameters is a column of `tickets`, and it never queries `profiles`.

**Call sites, both live:** `check_in_guest` at `Bouncer.tsx:82`, `get_unpaid_commissions` at `PayoutsPanel.tsx:28`. Neither is dead.

### A13. `search_path` unpinned on two live SECURITY DEFINER functions

`check_in_guest` and `get_unpaid_commissions`: `prosecdef=true`, `proconfig` NONE, owner `postgres` (`rolsuper=false`). Read live 2026-09-09. See A15 for the more serious problem in the same two functions.

**Both bodies schema-qualify every relation.** Not one unqualified table reference between them: `check_in_guest` uses `public.tickets` twice; `get_unpaid_commissions` uses `public.tickets`, `public.profiles` and `public.payout_history`. The remaining unqualified names are `pg_catalog` functions (`json_build_object`, `row_to_json`, `NOW()`, `COUNT`, `SUM`) and operators, and `pg_temp` is never consulted for function or operator names. Every object and column named in both bodies was also checked against the live schema; none is phantom.

**Why this is theoretical rather than live, measured:** `authenticated` and `anon` have `CREATE=false` on every schema they can see: `public`, `extensions`, `auth`, `storage`, `graphql_public`. `nspacl` on `public` shows PUBLIC holding `U` only, not `C`, so the PG15 default was never loosened. `postgres` also carries a role-level `search_path="$user", public, extensions` in `pg_db_role_setting`. No caller can create an object in any schema these functions resolve through.

**One unresolved residual, recorded as untested rather than as fine.** Both `anon` and `authenticated` have `TEMP` on the database (`true`, measured), and `get_unpaid_commissions` has four unqualified **type** names in casts: `::TEXT` x2, `::BIGINT`, `::NUMERIC`. `pg_temp` is consulted for type names. Whether `pg_temp` precedes `pg_catalog` for type resolution, and so whether a temp relation's implicit composite type could shadow one of those casts, **was not tested**. `check_in_guest` has no casts and so has no exposure even in principle.

**Pinning is behaviour-neutral for both, verified by reading.** Since every relation is already qualified and everything else resolves from `pg_catalog`, `SET search_path = public` or `SET search_path = ''` resolves identically to what runs today. That makes this cheap to fix whenever it is picked up, most naturally in the same change that closes A15.

**Background: the EXECUTE audit this entry came from (2026-09-07).** Kept here because "What the grouping reveals" cites A13 as the EXECUTE face of the permissive-defaults problem.

The third face of the permissive-defaults problem. A1 is the policy half, A9 the grant half, this is the EXECUTE half. Audited 2026-09-07 with `has_function_privilege` rather than by parsing `proacl`, deliberately: a NULL `proacl` means the default applies, and **for functions the default is EXECUTE to PUBLIC**, so parsing the ACL text would have missed every untouched function, which is exactly the population being audited.

**31 non-extension functions in `public` are executable by `anon` and `authenticated`** (plus 31 `pg_trgm` internals, which is normal). Of ours:

- **12 are trigger functions**, where the grant **can never be exercised**: triggers fire with the statement's privileges, not the caller's EXECUTE right. Pure surplus.
- **5 are policy helpers** (`has_role`, `has_role_type`, `is_conversation_participant`, `is_accepted_conversation_participant`, `is_addable_group_member`). These **need** the grant, since policy expressions evaluate as the querying user.
- **5 are genuinely called** from `src/`, the complete set of `.rpc(` names: `check_in_guest`, `get_unpaid_commissions`, `get_talent_spotlight`, `mark_conversation_read`, `start_conversation`.
- **4 are dormant by design**, not dead: `create_group_conversation`, `add_group_member`, `remove_group_member`, `sync_venue_conversation`. Group chat is built; talent group creation is gated.
- **1 is used but not via `.rpc(`**: `generate_verification_code()` is the DEFAULT on `talent_applications.verification_code`.
- **2 were dead and were DROPPED** 2026-09-07 (`20260907120000`): both `update_user_profile` overloads. See below.

**Two worth a look, not a claim:**

- **`check_in_guest` and `get_unpaid_commissions` are `SECURITY DEFINER` with no pinned `search_path`, and both ARE called from `src/`.** Every other `SECURITY DEFINER` function here pins it. **Investigated 2026-09-09; see the top of this entry for the `search_path` result, and A15 for the more serious finding in the same two functions.**
- **`is_admin()` is `SECURITY INVOKER`**, so it runs with the caller's privileges, while `CLAUDE.md` describes it as the database's admin boundary. Worth reading the body before relying on it. Not asserting it is wrong.

**One remaining dead function, not dropped:** `cleanup_expired_posts()` returns integer, has no caller in `src/`, is referenced by no column default and no function body, and **`pg_cron` is not installed**, so nothing schedules it. Left alone rather than swept up with the drop, because it is inert rather than dangerous.

**What was dropped and why it was the right first slice.** `update_user_profile(p_role_type text)` set `role_type` to whatever it was passed for `auth.uid()`, EXECUTE-granted to `anon` and `authenticated`, held closed by exactly one thing: `prevent_profile_privilege_escalation` raising because `auth.role()` returns `'authenticated'`. `CLAUDE.md` records three occasions where a migration disabled that same trigger to work around the `auth.role()` trap, and during any such window this was a live self-promotion endpoint. The other overload assigned to `profiles.role`, a column that does not exist, making it the sixth invented reference and the second to live in a SQL function body. Neither could succeed, which is what made the drop safe rather than merely tidy.

### A14. `create-checkout-session` runs as the caller, not as the owner

Found 2026-09-09 while enumerating writers of `profiles` before shipping A9. Of the three edge functions, it is the only one that forwards the caller's JWT:

```ts
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});
```

`admin-actions` and `stripe-webhook` both build their write client on `SUPABASE_SERVICE_ROLE_KEY`, so their writes run as `service_role` and are unbound by column grants. This one executes **as the authenticated caller**, so anything it writes is subject to whatever that role holds.

**Nothing today.** Measured: it contains no reference to `profiles` at all, and neither does `stripe-webhook`. So this is not a live problem and there is nothing to fix.

**Why it is worth writing down anyway.** A9 introduced the first real column boundary on `profiles`, and this is the single place in the codebase where a server-side write would land on the caller's side of it. The obvious future change, having checkout stamp something onto the buyer's profile (`total_lifetime_spend` is sitting right there, ungranted), would fail with `42501` from inside an edge function, where the error surfaces further from its cause than a client write would. Whoever adds that write needs to decide deliberately between granting the column and switching the client to the service key.

Same family as A13: the question is never "does this code work" but "which role is it running as", and that is invisible at the call site.

### A16. The platform re-applies every migration: 42 of 42 carry stored statement text

Every migration in the repo carries stored statement text in `supabase_migrations.schema_migrations`: 42 of 42. Only a platform apply writes that text; the Management API writes no row at all. So the platform has applied every migration on sync, including ones run by hand first. Re-application is not an occasional risk, it is universal. Every migration must therefore be written to survive running twice.

Measured 2026-09-10: all 42 rows compared against the current files. 41 are identical, 1 differs in comments only (`20260909120000`), and 0 differ in SQL, so no drift exists at the migration layer today. Two rows (`20260104162336`, `20260615001921`) have empty ledger names and UUID filenames; stored text matches both files exactly, harmless.

**One file in the repo now raises if re-applied alone: `20260921120000` (A1 phase 2).** Its precondition checks for policies that a later migration removes, so it aborts rather than dropping anything, and it is left unamended because amending it would create exactly the drift this entry measures. The reasoning is recorded in A1. It is the first case here where "every migration must survive running twice" meets a later migration that legitimately removes what an earlier one requires: the guarantee that still holds is the in-order replay, not the isolated re-run.

**Re-application observed completing, 2026-09-15 (see A25).** `20260913120000_a25_drop_diag.sql` was applied through the Management API before it was committed, then pushed. After the push its ledger row appeared, and the call count for its `DROP TABLE IF EXISTS public._diag` in `pg_stat_statements` went from 2 to 3, against a database where the table was already gone, with no error. That is the first re-application this backlog records as observed completing on a migration written to be idempotent, rather than inferred from stored statement text as above, and it completed cleanly because the statement carries `IF EXISTS`. Attribution caveat: the third call is attributed to the platform because the session's own rolled-back re-apply test ran the drop inside a `DO` block, which `pg_stat_statements.track = top` does not count.

### A17. Managers who do not own their venue cannot be represented

Found 2026-09-10 during the A15 investigation. **The product model includes managers who do not own the venue they manage. The schema cannot represent them.** The owner has ruled that such managers see payouts (A15), so this gap is exactly what limits A15 to owner-only.

**What exists today, measured live:**

- `venue_staff` has 7 columns: `id`, `created_at`, `venue_id`, `user_id`, `status`, `staff_role`, `commission_rate`. It holds 2 rows, both `staff_role = 'host'` and `status = 'active'`, and both members have `role_type = 'talent'`.
- Ownership exists only on `venues.owner_id`, a foreign key to `auth.users`. Of 17 venues, 3 are owned and 14 are not; all 3 belong to one account whose `role_type` is `manager`. No owner has a `venue_staff` row at their own venue.
- `profiles.role_type = 'manager'` is account-level and names no venue.
- A search of `public` for role-like columns and tables finds only `profiles.role_type`, `profiles.sub_role` and `venue_staff.staff_role` (plus `venues.capacity`, which is occupancy). There is no manager, admin, member, delegate or team table.

**Closing it means altering the `venue_staff.staff_role` CHECK.** `venue_staff_staff_role_allowed` currently permits exactly nine values: `host`, `entertainer`, `dj`, `bartender`, `bottle_girl`, `promoter`, `media`, `security`, `event_staff`. `profiles_sub_role_allowed` carries the identical list (measured live), so the change has to be made knowing the two lists are currently kept in step.

**Adding the value is not enough; the policy shape has to be decided too.** The three `tickets` policies that admit active venue staff ("Staff and Managers can view venue tickets", `Unified_Venue_Access`, "Venue staff can read venue tickets") key on `venue_staff.status = 'active'` and ignore `staff_role`. A manager added as an active `venue_staff` row would be admitted automatically, which matches the ruling. But those same policies already admit hosts and security, whom the owner has ruled out of payout data. So closing this gap requires deciding the policy shape, not only adding a value.

**What blocks granting a delegated manager.** Checked live 2026-09-10:

| Path | Policy | Predicate | Admits a manager account? |
|---|---|---|---|
| Manager invites talent from the directory (`InviteTalentModal`, mounted in `TalentDirectory.tsx`) | "Managers invite talent to their venue" (INSERT, authenticated) | `status = 'pending_talent_action' AND venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid() AND business_verified) AND has_role_type(user_id, 'talent')` | **No.** The account being added must be talent. |
| Talent requests to work from the venue page (`RequestToWorkModal`, mounted in `Venue.tsx`) | "Talent request to work a venue" (INSERT, authenticated) | `auth.uid() = user_id AND status = 'pending' AND has_role_type(auth.uid(), 'talent')` | **No.** The caller, who is the account being added, must be talent. |

`has_role_type` is `SECURITY DEFINER` with `search_path=public`, and checks `profiles.role_type = _role_type::app_role` exactly. **These are the only two INSERT policies on `venue_staff`.** No function in `public` inserts into `venue_staff`, and no edge function writes it.

**One route the policies do not close.** "Managers can update staff for their owned venues" (UPDATE, authenticated) constrains only `venue_id`, to owned and business-verified venues, in both `USING` and `WITH CHECK`, and `authenticated` holds table-level UPDATE on `venue_staff`. So at the policy level, an owner of a business-verified venue can rewrite an existing row's `user_id` to any profile, including a manager account, and set its `status` to `active`. **This is inferred from the predicate and the grant, not demonstrated**, since demonstrating it means performing the write. No client code issues such an update: `InviteTalentModal.tsx:81` updates only `status` and `staff_role`. It is A9's shape on a second table: the policy bounds which row, and nothing bounds which columns.

**The staff invite link is dead.** `ManagerDashboard.tsx:151` copies `${origin}/venue/<id>/join` and shows "Invite Link Copied". No route in `App.tsx` contains `join`, and the catch-all at `App.tsx:124` redirects to `/discovery`.

**Net:** the dead link is not the only blocker. The two working insert paths admit talent accounts only, so no shipped UI can add a manager account to `venue_staff`, even once `manager` is a valid `staff_role`. The one opening the policies leave is an owner UPDATE that no client performs.

**What was verified, and how:**

- **Verified live against the database:** both INSERT policies and their exact predicates; that no other INSERT policy exists; the body of `has_role_type`; that no function inserts into `venue_staff`; the table grants on `venue_staff`; the owner UPDATE policy's predicate; both CHECK constraints; the three `tickets` policies.
- **Verified by reading source in this session:** the two client insert sites and where their modals mount; the absence of any `venue_staff` write in edge functions; the route table in `App.tsx`; how the invite link is built.
- **Not verified:** the owner UPDATE route by performing it; that the invite link lands on `/discovery`, which is inferred from React Router's matching rather than observed in a browser.

### A18. Talent-side sales are already implemented, and must stay separate from `get_unpaid_commissions`

`TalentDashboard.tsx:67` reads `status, price_paid` from `tickets` filtered on `promoter_id` equal to the signed-in user's id, across all venues, and subscribes to live changes on the same filter (`TalentDashboard.tsx:53`). It renders on `/gigs` inside `TalentGuard` (`Gigs.tsx:21`); `/gigs` itself has no route-level guard (`App.tsx:98`). The read is RLS-gated by two `tickets` SELECT policies, `Talent_Commission_View` and `Talent_view_own_referrals`, both `USING (promoter_id = auth.uid())` and duplicates of each other, which is A1's shape.

`tickets.promoter_id` references `profiles(id)` (`ON DELETE SET NULL`), so a promoter is a user profile, not a separate entity. No function or view returns sales scoped to a single promoter across venues; the only functions mentioning promoters are the commission trigger and `get_unpaid_commissions`, which is venue-scoped.

**`get_unpaid_commissions` must never be widened to serve this.** It is venue-scoped and, per the A15 ruling, gated to owner and managers. Talent numbers are promoter-scoped across venues and already have their own read and their own gate. If talent-side sales grow, that is its own function with its own gate.

**A second source of truth for commission.** `TalentDashboard.tsx:42` computes `availableBalance = grossSales * 0.1`, a hardcoded 10%, labelled "10% Commission" at `TalentDashboard.tsx:356`. It never reads `tickets.commission_earned` or `venue_staff.commission_rate`, so it cannot agree with the stored figure (A19) or with any per-staff rate an owner sets.

### A19. Commission is stored at 10x the ticket price

`tr_calculate_commission` (BEFORE INSERT on `tickets`) runs `calculate_ticket_commission()`, which sets `NEW.commission_earned := NEW.price_paid * COALESCE(v_rate, 0)`. `v_rate` is the promoter's active `venue_staff.commission_rate`, falling back to `venues.standard_commission`. Both columns are `numeric(5,2)` defaulting to `10.00`, which the webhook treats as a percentage, and every live value is `10.00` (both staff rows, all 17 venues). So the trigger multiplies the price by 10.

**Measured on live rows:** 5 of 6 tickets carry `commission_earned` at 10x `price_paid` (200.00 on 20.00, 300.00 on 30.00). The sixth is 30.00 with 0.00.

**The webhook computes it correctly and is overwritten.** `stripe-webhook/index.ts:96-97` computes `pricePaid * (ratePercentage / 100)` and passes it as `commission_earned` (`stripe-webhook/index.ts:109`), but the BEFORE INSERT trigger replaces whatever the insert supplied. The trigger also falls back to the venue's standard rate when a ticket has no promoter, which is why 5 tickets with a NULL `promoter_id` carry any commission at all.

**Why it matters:** `get_unpaid_commissions` sums this column. It returns nothing today only because it filters on `promoter_id IS NOT NULL` and no ticket has one.

`venues` carries two commission columns: `commission_rate` (`numeric`, default `0.00`) and `standard_commission` (`numeric(5,2)`, default `10.00`). The trigger reads only `standard_commission`.

**Gate: resolve before ticketing goes live.**

### A20. Ticket status vocabulary: door-scanned tickets vanish from every count

Writers and readers use different words for a ticket's state:

| Writer or reader | Status it uses |
|---|---|
| `stripe-webhook/index.ts:113` inserts | `active` |
| `check_in_guest` (the Bouncer scan) writes | `used` |
| Policy "Venue staff can scan tickets" requires, in `WITH CHECK` | `Scanned` |
| `ManagerDashboard.tsx:79-87` counts revenue and tickets sold | `active` or `Scanned` |
| `ManagerDashboard.tsx:78` and `:88` count occupancy | `Scanned` |
| `TalentDashboard.tsx:72` counts scanned | `Scanned` |

**Measured:** 5 of 6 live tickets are `used`, and 1 is `Scanned`. Every ticket admitted through Bouncer therefore disappears from the owner's revenue, tickets-sold and occupancy figures, and from the talent's scanned count.

A second consequence: `check_in_guest` treats only `used` as already scanned, so a ticket marked `Scanned` through the staff policy path would not be refused by the RPC. Nothing in `src/` updates `tickets` directly today, so that half is latent.

**Gate: resolve before ticketing goes live.**

### A21. Referral attribution is caller-supplied and unchecked

`create-checkout-session/index.ts:44` reads `referral_id` from the request body, validates nothing about it, and forwards it as Stripe metadata `promoter_id` (`create-checkout-session/index.ts:96`). `stripe-webhook/index.ts:55` reads it back and inserts it as `tickets.promoter_id` (`stripe-webhook/index.ts:108`). Since `tickets.promoter_id` references `profiles(id)`, any existing profile is accepted. **Any signed-in buyer could name any profile as their referrer.** And because the commission trigger (A19) falls back to the venue's standard rate when the named promoter has no active affiliation, an arbitrary referrer would still accrue commission.

**Harmless today:** `TicketPurchaseDialog`, the component that carries a referral id, is imported by nothing, and 0 of 6 live tickets carry a `promoter_id`.

### A22. `check_in_guest` returns the full ticket row on `wrong_venue` and `already_used`

Found 2026-09-10 while planning A15, and deliberately left unchanged by `20260910120000_a15_owner_checks.sql`, which kept the response shape as it was.

Both branches return `row_to_json(ticket_record)`: every column of `tickets`, including `user_id`, `qr_code`, `stripe_session_id`, `payment_intent_id`, `price_paid` and `commission_earned`. The scanner renders only two of them: `customer_segment` and `event_name` (`Bouncer.tsx:228` and `Bouncer.tsx:231`).

**The function is `SECURITY DEFINER`, so it bypasses RLS on `tickets`, and the caller can receive data the `tickets` policies would deny them.** Since A15 the caller must own the venue whose door is being scanned, so `wrong_venue` hands the owner of one venue a ticket row from a different venue. Read against the live policies on 2026-09-11, a SELECT on that row would be admitted only if the caller owns the ticket's venue (ruled out on this branch), holds an active `venue_staff` row there, is the buyer (`user_id`), or is the promoter (`promoter_id`). In every other case RLS denies the read and the function returns the row anyway. `already_used` is a different problem: the ticket is at the caller's own venue, which the owner policies already let them read, so nothing is bypassed there, but the response still carries far more than the scanner uses.

Separate from A15 on purpose: A15 changes who may call the function; this changes what the function returns.

### A23. Two client failure paths ship unobserved: the credential branches, and a History tab that never reads its error

Found 2026-09-11 shipping the A15 client half (`b794fd7`).

**No credential branch in either component has been observed rendering.** `Bouncer.tsx` shows "Not authorized at this venue. Sign in again." when the caught error's code is `42501`, `PGRST301` or `PGRST303`. `PayoutsPanel.tsx` has no code-specific branch; the same refusals land in its failed state. What stands behind the codes: `42501` from the EXECUTE grant was measured live as anon; `42501` from the owner-check RAISE is inferred from the A15 F1/F3 fixtures, not measured through PostgREST; `PGRST301` was measured with a bad token signature; the expired-token path was not measured. The verification planned for `b794fd7` blocks the request in DevTools, which is a network error with code `""`: it reaches PayoutsPanel's failed state and cleared list, and neither credential path.

**Why they are unreachable by clicking.** The client guards keep both causes away from the RPC:

- *Not the owner.* Both components pass `activeVenueId`, and every writer of it picks an owned venue: `syncProfileAndVenues` from venues where `owner_id` is the user (`UserModeContext.tsx:81-88`), `VenueSwitcher.tsx:42` from that same list, and `Dashboard.tsx:18` only inside `DashboardGuard`, which renders its children only when `useVenueStatus` reads the user as `owner_id` (`DashboardGuard.tsx:63`, `useVenueStatus.ts:33`). `/bouncer` sits behind the same guard (`App.tsx:56-63`).
- *No session.* `SIGNED_OUT` clears `activeVenueId` (`UserModeContext.tsx:122-131`), which sends the scanner to `/dashboard` (`Bouncer.tsx:56-61`) and unmounts PayoutsPanel (`ManagerDashboard.tsx:279`). The anon-key fallback reaches the RPC only if a token refresh fails at call time (auth-js `__loadSession` returns a null session and supabase-js sends the anon key) before that event lands. Whether a failed refresh emits `SIGNED_OUT` was not read.
- *Token rejected.* `PGRST301` and `PGRST303` need the server to reject a token the client still considers valid, since auth-js refreshes any token inside its expiry margin before sending. Inferred causes: clock skew or a rotated signing key.

Read from code, not exercised: the one ordinary route to the owner-check RAISE is ownership changing mid-session. An admin revoke nulls `owner_id` while `activeVenueId` still holds the venue, `syncProfileAndVenues` does not clear it when the owner is left with no venues (`UserModeContext.tsx:83`), and `DashboardGuard` re-reads ownership only when the session object changes. Observing either credential branch therefore needs a signed-in test account and either an ownership change on a test venue or a call made outside the UI.

**The History tab never reads `error`.** `PayoutsPanel.tsx:40-45` (lines 35-40 before `b794fd7`) destructures only `data` from the `payout_history` select. A failed history fetch sets `history` to `[]` and renders nothing: no toast, no failed state, and the list at `PayoutsPanel.tsx:150` has no empty-state message, so failed and genuinely empty look identical. `loadFailed` does not cover it: a supabase query returns its error rather than throwing, so the catch is reached only through the pending branch's `if (error) throw error`. Left out of `b794fd7`, which was scoped to the pending tab.

### A24. PayoutsPanel has no request-ordering guard: a late response can render one venue's payouts under another

Found 2026-09-11 by reading, not reproduced.

`fetchData` (`PayoutsPanel.tsx:27`) writes whatever response arrives into `payouts` (`PayoutsPanel.tsx:38`), with nothing checking that it answers the most recent request. The effect at `PayoutsPanel.tsx:23-25` re-runs on every `venueId` change, and the panel is mounted without a `key` (`ManagerDashboard.tsx:279`), so a venue switch starts a second fetch on the same instance while the first may still be in flight. If the first response lands last, it overwrites the newer one: venue A's rows render while `venueId` is venue B.

**Same money-attribution hazard as the stale-list defect fixed in `b794fd7`, reached by a different path.** Settle inserts `payout_history` with `venue_id: venueId` and the displayed row's `promoter_id` and `total_unpaid` (`PayoutsPanel.tsx:73-75`), so it would record venue A's promoter and amount against venue B. Clearing the list on failure does not cover it: both responses succeed.

**The switch is reachable mid-flight.** The tab buttons are hidden during load, because `if (loading) return <LoadingState />` (`PayoutsPanel.tsx:92`) replaces the whole panel. But `VenueSwitcher` renders outside the panel and outside the Tabs (`ManagerDashboard.tsx:210`, Tabs from `ManagerDashboard.tsx:253`), so it stays clickable while a fetch is pending.

**The fix already exists in this codebase. Use it, do not invent a second pattern.** `TalentDirectory.tsx` discards stale responses with a monotonic `requestIdRef`, added in `7ec156e`: `useRef(0)` (`TalentDirectory.tsx:143`); each new request takes `const myId = ++requestIdRef.current` (`TalentDirectory.tsx:214`); success, failure and the loading flag each return early unless `requestIdRef.current === myId` (`TalentDirectory.tsx:218`, `223`, `228`). Applied here, the guard belongs on the `setPayouts` and `setHistory` writes, on the catch (so a late failure cannot clear a newer good list), and on `setLoading(false)`. Settle's refresh (`PayoutsPanel.tsx:85`) goes through `fetchData`, so it would be covered by the same guard.

### A26. Tickets can be minted directly by any signed-in user

Found 2026-09-13 during the A1 investigation. **Inferred from policies and grants, not executed.**

- Measured: `authenticated` holds table-level INSERT on all 18 `tickets` columns (and UPDATE and DELETE).
- Measured: "Authenticated users can purchase a ticket" (INSERT, `{authenticated}`) is `WITH CHECK (auth.uid() = user_id)` and nothing else.
- The one BEFORE INSERT trigger is `tr_calculate_commission` (`calculate_ticket_commission`). Its body was not read in this pass, so whether it rejects anything is unverified.

So any signed-in user could insert a row into `tickets` through the database API for any `venue_id`, with a `qr_code`, `price_paid` and `status` of their choosing, bypassing Stripe entirely. `check_in_guest` looks a ticket up by `qr_code`, requires its `venue_id` to match the venue being scanned, and refuses only `status = 'used'`, so the owner's scanner would admit it.

The UI withholds ticketing, but that does not close this: the table and the check-in RPC are live, and the UI is not involved. It is a ticketing gate alongside **A19** (commission stored at 10x) and **A20** (status vocabulary), to resolve before ticketing ships. Related: A14 (`create-checkout-session` runs as the caller) and A21 (referral attribution unchecked).

### A27. `Unified_Venue_Access` is FOR ALL with no WITH CHECK: active staff can write tickets

Found 2026-09-13 during the A1 investigation. Extends what A15's investigation recorded: that this policy admits active staff for every command, with the grants on `tickets` unmeasured at the time. They are now measured.

- Measured: `Unified_Venue_Access` is `FOR ALL`, roles `{public}`, `USING (venue_id IN (SELECT venues.id FROM venues WHERE (venues.owner_id = auth.uid()) UNION SELECT venue_staff.venue_id FROM venue_staff WHERE ((venue_staff.user_id = auth.uid()) AND (venue_staff.status = 'active'::text))))`, with no `WITH CHECK`.
- Measured: `authenticated` holds table-level INSERT, UPDATE and DELETE on all 18 `tickets` columns.

With no `WITH CHECK`, its `USING` doubles as the check for INSERT and UPDATE. So any active staff member, whatever their `staff_role` (hosts and security included), can insert tickets at their venue, update any column of any ticket there (`price_paid`, `commission_earned`, `promoter_id`, `status`, `qr_code`), and delete them. Because permissive policies OR together, it also makes "Venue staff can scan tickets" ineffective: that policy's `WITH CHECK (status = 'Scanned')` was the only limit on what staff may write, and `Unified_Venue_Access` admits the same caller with no limit at all. Inferred from policies and grants, not executed.

### A28. `get_talent_spotlight` runs as the caller over a table the caller cannot read: Spotlight is empty for everyone

Found 2026-09-13 during the A1 investigation. **Inferred from the catalog, not run.**

- Measured: `get_talent_spotlight(limit_count integer)` is `SECURITY INVOKER` (`prosecdef = false`), and its live body reads `interactions` joined to `profiles`.
- Measured: `interactions` has RLS enabled and exactly one policy, "Users can log their own interactions", which is INSERT. There is no SELECT policy.
- Measured: `interactions` holds 8 rows.

A caller-rights function sees only the rows the caller's policies admit, and with no SELECT policy that is none, for `anon` and `authenticated` alike. So the Spotlight call at `Discovery.tsx:211` returns empty for every user regardless of the data. Not executed, so the empty result itself has not been observed. The body also filters to the last 24 hours, so even a readable table might return nothing; how many of the 8 rows fall inside that window was not measured.

This contradicts CLAUDE.md's description of `interactions` as Spotlight's live input: the rows are written, but no caller can read them back through this function. Read with **A2** (the migration files disagree with this live body) and **C3** (the Spotlight rebuild): whichever body C3 builds on, the invoker-versus-RLS question has to be decided with it, or the rebuild ships empty the same way.

### A29. `realtime.subscription`: RLS off and anon holds SELECT. Supabase-managed, not urgent

Found 2026-09-13 during the A25 investigation, whose item 5 asked whether any other relation sits in `_diag`'s state. Every table in `public` was ruled out. **This is the one relation from that check that was not.**

Measured:

- `relrowsecurity = false`, and no policies.
- `anon` and `authenticated` both hold SELECT on it, and both hold USAGE on the `realtime` schema.
- 2 rows.
- Owned by `supabase_realtime_admin`. Columns: `id bigint`, `subscription_id uuid`, `entity regclass`, `filters realtime.user_defined_filter[]`, `claims jsonb`, `claims_role regrole`, `created_at timestamp without time zone`, `action_filter text`, `selected_columns text[]`. The `claims` column presumably holds subscribers' JWT claims; that is inferred from its name, and no values were read.

**Not checked: whether the `realtime` schema is reachable through the API.** USAGE on a schema is not the same as the API exposing it, and the exposed-schemas setting was not read. If the schema is not exposed, anon holds a grant it has no route to use.

**Supabase-managed, so the fix may not be ours to make.** The table belongs to Supabase's Realtime service and is owned by its admin role. Changing its RLS or grants could break Realtime or be reverted by the platform. The first step is reading the exposed-schemas setting, not altering the table.

The same check also surfaced `extensions.pg_stat_statements` and `pg_stat_statements_info`, where anon also holds SELECT. Those are treated as ruled out because Postgres shows other roles' query text as `<insufficient privilege>`, so anon sees only its own statements. That is from the Postgres documentation, not tested here.

### A30. Revoking a closed venue strands it: unowned, invisible, unclaimable and impossible to reopen from the app

Found 2026-09-16 while establishing which accounts A1's phase 1 policies must cover. Not fixed, and neither candidate fix was chosen.

`admin-actions` nulls `owner_id` at `index.ts:230` and never touches `is_active`. So revoking a claim on a venue that is closed at the time produces a venue that is unowned and closed at once.

**Under A1's phase 2 policy set (`is_active = true`, `auth.uid() = owner_id`, `is_admin()`) no condition admits such a row.** It is not active; it has no owner to match; and only the admin would see it. It drops off Discovery and out of `ClaimVenueModal.tsx:40-44`, which lists unowned venues precisely so they can be claimed, so nobody can claim it. It also cannot be reopened from the app: the only UPDATE policy on `venues` requires `auth.uid() = owner_id` and there is no owner, so only the service role or a direct database write can flip `is_active` back. Inferred from the policies and the code, not exercised.

**Measured 2026-09-16:** no venue is in that state today. 14 are unowned and open, 1 is owned and open, 2 are owned and closed. The two closed ones are also the only business-verified venues in the database, so they are the likeliest revoke targets, which is what makes this worth recording rather than filing as theoretical.

**Two candidate fixes, neither chosen:**

- Have revoke set `is_active = true` in the same call that nulls `owner_id`, so the venue stays visible and claimable. This changes what an admin action does to a venue's public state.
- Admit unowned venues in the read policy (`owner_id IS NULL`), which keeps them visible without changing revoke. This widens a policy that A1 exists to narrow.

Latent rather than live: it needs both a revoke on a closed venue and A1 phase 2, since today's `true` policies would still show the venue either way.

**DOWNGRADED 2026-09-22 by the visibility decision in A8.** Once every venue row is readable regardless of `is_active`, most of this entry stops applying: an unowned closed venue stays visible on Discovery and stays listed in `ClaimVenueModal.tsx:40-44`, so it can be claimed, and claiming gives it an owner who can reopen it. The two candidate fixes above are moot for the visibility half.

**What survives, and it is the smaller half:** a venue that is closed when its claim is revoked stays closed, and nothing in the app can reopen it until someone claims it, because the only UPDATE policy on `venues` requires `auth.uid() = owner_id`. So the venue is visible but sits with no "open" badge until a new owner appears, and `admin-actions` still leaves `is_active` untouched when it nulls `owner_id` (`index.ts:230`). That is a stale-display problem rather than a lockout, which is why this is no longer ranked with the A-section's live defects.

### A32. Two orphan rows found in passing: a profile pointing at no venue, and a post whose author has no profile

Found 2026-09-16 during the A1 reader survey. Both are incidental, neither was investigated, and both are data rather than schema.

- **A `profiles.venue_id` value matches no venue row.** On 2026-09-13 exactly one profile had `venue_id` set. On 2026-09-16 a join from both `profiles.venue_id` and `profiles.current_venue_id` to `venues` returned zero rows, so that value either points at a venue that does not exist or was cleared in between; which one was not measured. This is the column A10 records as the one `idx_profiles_active_talent` indexes, and the column CLAUDE.md records as carrying no foreign key at all, which is exactly what lets it hold a dangling id.
- **A post tagged to The Ritz Ybor has no matching `profiles` row for its author.** Both posts in the database are tagged to that venue; one joins to a profile and one does not. Whether `posts.user_id` is NULL or holds an id with no profile was not checked. Nothing renders it today, since the feed is follower-scoped, which is why it surfaced only in a catalog join.

Recorded so the next audit recognises them rather than rediscovering them as new findings.

---

## B. Pre-launch gates

*Acceptable now specifically because signups are hand-gatekept and every account is known. Each becomes a real problem the day that stops being true.*

### B1. Unbounded pending message requests
A guest can hold unlimited pending threads with strangers. The first thing abused when signups open, and much harder to bound once there is real traffic to reason about.

### B2. Unbounded reads — RESOLVED for messages, reclassified for the rest

**Not every "fine now, not later" item is the same thing, and B2 was three items wearing one label.** The distinction that matters is whether a thing *degrades* or merely *irritates*. Pagination degrades; a missing feature irritates. Only the first blocks building on top of it.

**`fetchMessages` — was a genuine ceiling. FIXED 2026-09-02.** It grew with activity in one thread, unbounded, and grew while nobody was looking. Now keyset-paginated at 50 with a composite `(created_at, id)` cursor, served by `idx_messages_conversation_created_id` with no sort node. The composite cursor is not caution for its own sake: a single-column cursor makes a page boundary ambiguous when two messages share a microsecond, and the symptom — one message silently missing at a seam — is close to undiagnosable after the fact.

**`fetchConversations` — NOT a ceiling. Deliberately left unpaginated.** It grows with O(relationships), not O(activity): bounded by how many distinct people and venues you have a relationship with, and it does not grow while you sleep. Even a heavy manager is in the low hundreds. Two further reasons pagination would be *negative* value here: the `last_message_at` sort comes from a lateral subquery and so cannot use an index at all, meaning a `LIMIT` would avoid transferring rows but not computing them; and **a silently truncated inbox is worse than a slow one** — thread 201 vanishing with no indication is exactly the class of quiet wrongness this project keeps finding. Revisit only if a real account crosses ~200 conversations.

### B2b. `TalentDirectory`: RESOLVED 2026-09-06

It fetched **all talent globally**, growing with platform size rather than with the user. Now server-side filtered and keyset-paginated at 24, ordered by `(sort_name, id)` and served by `idx_profiles_talent_directory` with no sort node.

**Kept because it is the reusable lesson: a naive `.limit()` would have broken search correctness.** Search was client-side over the already-fetched array, so a limit alone would have silently made the search box search only the first page, with no way for the user to know results were incomplete. A performance problem converted into a correctness problem. `.limit()` is exactly what someone reaches for.

**Two things this entry previously got wrong, corrected rather than deleted.** The index it named, `(role_type, username)`, was the wrong shape: `username` is NULL on 2 of 3 talent rows and is not what the card renders, so it could not be the sort key. What shipped is `sort_name`, a generated column holding `coalesce(display_name, username, '')`, because **PostgREST `.order()` resolves against real columns only** and cannot take an expression (measured: the expression form returns 400, and the control returned `42703 column ... does not exist`, which is the proof). The `''` tail makes the key total as a property of the expression rather than of today's data.

**Three things were measured against live before any of it was built**, and each would have been a silent defect if assumed:

- **Chained `.or()` calls are ANDed**, not ORed. Tested so that AND, OR, first-wins and last-wins each give a different row count. Had they ORed, the operational exclusion would leak.
- **`NOT (sub_role IN (...))` drops null `sub_role` rows**, which is 2 of the 3 live talent. The shipped form is `or=(sub_role.is.null,sub_role.not.in.(...))`.
- **`*`, `%` and `_` are wildcards server-side**, while the old client-side `String.includes()` treated them literally. Typing `%` would have returned the entire directory. Worse, **a single backslash inside a PostgREST double-quoted value is consumed**, so the obvious escape silently evaporates and the metacharacter reverts to a wildcard with HTTP 200. Values inside `or=()` must be double-quoted (an unquoted comma is a 400, and names contain commas) and LIKE escaping must run *before* the quoting so its backslashes get doubled.

**Still deliberately absent:** no `pg_trgm` GIN index. The btree cannot serve `ilike '%term%'`, so the search predicate is evaluated per row. Acceptable now, and a separate decision.

Proven against a 2,000-row fixture inside a transaction that rolled back: 61 pages walked with a seam landing inside a 60-row identical-`sort_name` run, zero gaps, zero repeats, order exact, and a search term matching only a late row still found.

### B2c. Two pagination implementations disagree about "is there more"

`useChat` sets `hasMoreMessages = page.length === PAGE_SIZE`. A thread holding exactly 50 messages therefore renders "Load earlier messages"; clicking it fetches 0 rows and the button then disappears. One dead click, no wrong output.

`TalentDirectory` (2026-09-06) instead fetches `PAGE_SIZE + 1` and renders `PAGE_SIZE`, so `hasMore` is exact for the same single round trip and no button is ever shown that does nothing.

**The cost is not the dead click, it is the disagreement.** Two keyset implementations in one codebase now answer "is there another page" differently, and the next person to paginate something will copy whichever they open first. Align `useChat` to the plus-one form. Filed here rather than in Cleanup because the resolution is a decision about which shape is canonical, not a tidy-up.

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

### C7. Neither profile page renders posts, and the talent profile has no avatar

Measured 2026-09-07: **neither `TalentProfile.tsx` nor `Venue.tsx` queries `posts` at all.** `TalentProfile` section 5 is a hardcoded placeholder that will never fill:

```tsx
{/* 5. INTEL FEED (PLACEHOLDER FOR VERTICAL SCROLL) */}
   <h3 ...>Latest Intel</h3>
   {[1, 2].map((i) => (
     <div key={i} className="aspect-square w-full bg-zinc-900/20 ... animate-pulse" />
   ))}
```

Two permanently pulsing grey squares that read as loading and are not.

**Against the stated design** (hero reel, avatar floating over it, portfolio in a horizontal scroll, then posts):

| Intended | Talent | Venue |
|---|---|---|
| Hero reel | present | present |
| Floating avatar | **absent** | absent (staff facepile instead) |
| Portfolio scroll | present but broken, see A11 | present but unfillable, see A11 |
| Their posts | **absent** | **absent** |

`avatar_url` reaches `TalentProfile` only as `fallbackImageUrl` behind the hero reel. There is no `<Avatar>` element on the page.

**There is no `VenueProfile.tsx`.** The public venue page is `Venue.tsx`. A manager can edit exactly three things across two files: `is_active`/`active_at` (`ManagerDashboard.tsx:185`), `entry_price`/`vip_price` (`VenuePriceEditor.tsx:38`), and `hero_reel_url`. Not `name`, not `image_url`, not `location`.

Filed as a missing feature rather than coherence because the fetch was never written, unlike A11 where the code exists and is wrong.

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

**Updated 2026-09-07: it has a third face, and the problem is now A1 + A9 + A13.** The same uniform permissiveness was applied to function EXECUTE, including to 12 trigger functions where the grant can never be exercised and 3 functions nothing calls. Two of those three were dropped (`20260907120000`); the audit found the rest. The pattern is identical each time: **the default was applied everywhere, so the places it matters are indistinguishable from the places it does not**, and that is what makes the surface expensive to reason about rather than any single grant being catastrophic.

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
