# admin-actions

## Overview

Supabase Edge Function (Deno) and the only server-side authority for admin
review decisions: venue claims, talent applications and Tier 2 business
verification. It authenticates the caller's JWT, requires that the user id
equal the `ADMIN_USER_ID` secret, validates the body against a zod
discriminated union, then writes with a **service-role** client. Because it
uses the service role, RLS does not bound any of its writes. Its only caller in
the app is `src/pages/CEODashboard.tsx` (`supabase.functions.invoke("admin-actions", ...)`).

This is one of three admin-identity mechanisms (see the project `CLAUDE.md`,
"CEO/admin identity"). The other two are the client-side `CEORoute` email check
and the DB `is_admin()` JWT-email check. Nothing keeps them in sync with this one.

Single source file: `index.ts`.

## Interface

- `[index.ts:Deno.serve]`: the HTTP handler. `OPTIONS` returns `"ok"` with
  `corsHeaders`. Every other method is treated as an action request. There is
  no method check beyond the `OPTIONS` branch.
- Request: header `Authorization: Bearer <user JWT>`, JSON body
  `{ action, payload }` validated by `[index.ts:ActionSchema]`
  (`z.discriminatedUnion("action", ...)`). All ids are `z.string().uuid()`.

  | `action` | `payload` |
  | --- | --- |
  | `approve_venue_claim` | `{ claim_id, venue_id, user_id }` |
  | `reject_venue_claim` | `{ claim_id }` |
  | `revoke_venue_claim` | `{ venue_id, user_id }` |
  | `approve_talent` | `{ user_id }` |
  | `reject_talent` | `{ user_id }` |
  | `approve_business` | `{ venue_id }` |
  | `reject_business` | `{ venue_id }` |

- Responses, all via `[index.ts:json]` (JSON with `corsHeaders`):
  - success: `{ ok: true }`. `revoke_venue_claim` returns
    `{ ok: true, demoted: boolean, downgraded: number }`.
  - `400 { error: "Invalid request", details }` on a schema failure
    (`parsed.error.flatten()`).
  - `401 { error: "Unauthorized" }` for a missing or non-`Bearer` header, or
    when `authClient.auth.getUser(token)` fails.
  - `403 { error: "Forbidden" }` when `userData.user.id !== ADMIN_USER_ID`.
  - `404 "Claim not found."` (`approve_venue_claim` only) and
    `404 "Venue not found."` (`approve_venue_claim`, `revoke_venue_claim`).
  - `409` for refused state: claim not pending, payload not matching the
    claim, role conflict, venue already owned, an existing approved claim, no
    approved claim to revoke (`revoke_venue_claim`), a venue owned by a
    different account (`revoke_venue_claim`), a claim no longer pending at
    reject time, and two zero-row races in `approve_venue_claim` (the owner
    write, and the final claim close).
  - `500` with fixed text when a write matches zero rows partway through:
    "Venue assigned, but no profile matched the claimant. Approve again to
    finish." (`approve_venue_claim` role write); "Any active staff were moved
    to pending, but the venue was not released. Revoke again to finish."
    (`revoke_venue_claim` venue release); "Venue released, but the claim was
    not marked revoked. Revoke again to finish." (`revoke_venue_claim` claim
    mark).
  - `500 { error: "Server misconfigured" }` if `ADMIN_USER_ID` is unset;
    `500 { error: "Internal error" }` from the outer `catch`. Other `500`s carry
    the database error message, either bare or after a prefix such as
    "Claim lookup failed: ", "Role check failed: ", "Venue lookup failed: ",
    "Claim check failed: " or "Venue assigned, but the role update failed: ".
- Environment variables read (names only): `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ADMIN_USER_ID`.
- Internal helpers (not exported): `[index.ts:findRoleConflict]`,
  `[index.ts:json]`, `[index.ts:RoleTrack]` (`"talent" | "manager"`),
  `[index.ts:MANAGER_ROLES]` (`["manager", "venue_manager"]`),
  `[index.ts:OPEN_STATUSES]` (`["pending", "approved"]`).
- Subdirectories: None.

## Invariants

- **Auth before parse before write.** `[index.ts:Deno.serve]` checks, in
  order: the `Authorization` header starts with `Bearer ` (`401` otherwise);
  `ADMIN_USER_ID` is set (`500 "Server misconfigured"` otherwise);
  `authClient.auth.getUser(token)` succeeds (`401`); the user id equals
  `ADMIN_USER_ID` (`403`); `ActionSchema.safeParse` (`400`). Only then does it
  create the service-role client `admin`. A non-admin caller never reaches a
  write.
- **The `ADMIN_USER_ID` check runs after the header check but before the
  token is validated.** With the secret unset, a request with no `Bearer`
  header gets `401`; any request with one, valid token or not, gets `500`.
- **`findRoleConflict` fails closed.** `[index.ts:findRoleConflict]` returns
  `readError` on any read failure, and both callers return `500` on it, so an
  incomplete check never becomes an approval. Its documented client twin,
  `checkOtherTrackConflict` in `src/lib/roleClaims.ts`, fails open. The comment
  above `RoleTrack` says that if the rule changes, **both files change**.
- **`findRoleConflict` treats `venue_manager` as a manager** through
  `MANAGER_ROLES`, for the `talent` track. For the `manager` track it blocks
  only `role === "talent"` and an open `talent_applications` row. It does not
  check `venue_claims`, so an existing manager can be approved for a second
  venue.
- **`approve_venue_claim`: every check runs before the first write**
  (comment "A46"). The `venue_claims` row is the source of truth. The payload's
  `venue_id` and `user_id` must match it (`409` otherwise), and it must be
  `pending`. Then: `findRoleConflict(..., "manager")`; the venue must exist and
  be unowned or already owned by this claimant; and no `approved` claim may
  already exist for the venue (`venue_claims_one_approved_per_venue`, A7).
- **`approve_venue_claim` write order: owner, then role, then claim**, with no
  transaction. The owner write is conditional,
  `.or("owner_id.is.null,owner_id.eq.<user_id>")`, and must match exactly one
  row. The claim is closed last and only `.eq("status", "pending")`, so a
  partial failure leaves the claim pending and re-approving resumes it.
- **`reject_venue_claim` only rejects a `pending` claim**
  (`.eq("status", "pending")`, exactly one row or `409`). An approved claim is
  undone with `revoke_venue_claim`, not rejected.
- **`revoke_venue_claim` reads before writing.** It requires an `approved`
  claim matching `venue_id`, `user_id` and status, and a venue whose
  `owner_id` is NULL (a resumed retry) or this `user_id`.
- **`revoke_venue_claim` write order (code order): staff, then venue, then
  claim, then role.** (1) `venue_staff` rows with `status = 'active'` at the
  venue become `pending`, not deleted. (2) `venues.owner_id` is set to NULL and
  must match exactly one row. (3) That approved claim becomes `revoked`,
  conditional on still being `approved`, exactly one row. (4) `role_type` is
  set to `guest` only if the user owns no other venue. Staff are downgraded
  before the venue is released so that a partial failure never leaves an
  ownerless venue with active affiliations. The numbered comments in this case
  ("1. Release the venue first", "Steps 3 and 4") do not match the code's
  order. Read the calls, not the step numbers.
- **`approve_talent` checks for conflicts, then writes `role_type` before the
  application.** It calls `findRoleConflict(..., "talent")` before any write.
  Writing the role first means a failed second write leaves
  "approved but still pending" rather than an applicant dropped from the queue.
- **`approve_business` writes the flag before the application**
  (`business_verified = true`, then the pending application becomes
  `approved`), for the same recoverability reason.
- **Rows-affected checks are not uniform.** These writes end in
  `.select("id")` and require exactly one row: the `venues` (owner),
  `profiles` and `venue_claims` writes in `approve_venue_claim`; the
  `venue_claims` write in `reject_venue_claim` (its only write); and the
  `venues` and `venue_claims` writes in `revoke_venue_claim`.
  The `venue_staff` downgrade in `revoke_venue_claim` also ends in
  `.select("id")`, but its count is never checked; it only becomes the
  `downgraded` value in the response, and zero is a valid result.
  These writes check only `error`, so a write that matches zero rows still
  returns `{ ok: true }`:
  - the `profiles` and `talent_applications` writes in `approve_talent` and
    `reject_talent`;
  - the `venues` and `venue_business_applications` writes in
    `approve_business` and `reject_business`;
  - the demotion write in `revoke_venue_claim`.
- **`reject_talent` sets `profiles.role_type = 'guest'` with no role check and
  no check that a pending application exists.** It does not call
  `findRoleConflict` or read the current role first.
- **`reject_business` sets `venues.business_verified = false` with no check
  that a pending application exists**, so it also unverifies an already
  verified venue.
- **The DB also refuses owner-to-owner moves.** In the repo migration
  `supabase/migrations/20261019120000_a46_venue_owner_change_through_null.sql`,
  `prevent_venue_owner_change` refuses an owned-to-different-owner write
  **before** its `service_role` early return, so this function cannot move an
  owned venue directly to another owner either. This was read from the
  migration file, not from the live function body. The project `CLAUDE.md`
  still describes the older body, in which service role bypassed the guard
  entirely.

## Side Effects

- **Database writes (service role, RLS bypassed), by table:**
  - `venues`: `owner_id` (`approve_venue_claim` sets it,
    `revoke_venue_claim` nulls it); `business_verified`
    (`approve_business` sets `true`, `reject_business` sets `false`).
  - `profiles`: `role_type` (`manager` in `approve_venue_claim`, `talent` in
    `approve_talent`, `guest` in `reject_talent` and in `revoke_venue_claim`
    when demoted).
  - `venue_claims`: `status` (`approved`, `rejected`, `revoked`).
  - `venue_staff`: `status` `active` to `pending` (`revoke_venue_claim`).
  - `talent_applications`: `status` `pending` to `approved` or `rejected`.
  - `venue_business_applications`: `status` `pending` to `approved` or
    `rejected`.
- **Database reads:** `profiles.role_type`, `venue_claims`,
  `talent_applications` (in `findRoleConflict`); `venue_claims`, `venues`
  (pre-checks and the remaining-venues lookup).
- **Trigger exposure:** writes to `venues.owner_id` and `venue_staff.status`
  fire DB triggers this file does not show (for example
  `venues_prevent_owner_change`, and the venue-thread and check-in triggers
  described in `CLAUDE.md`). A trigger that `RAISE`s surfaces as a `500` with
  its message.
- **Network:** `authClient.auth.getUser(token)` against Supabase Auth, using
  the anon key.
- **Logging:** `console.error("admin-actions error", err)` in the outer
  `catch`.
- **No dry run.** Every successful request performs its write; a diagnostic
  call is a real approval or rejection.

## Verification

- Type check (not run as part of this documentation pass; these Deno files
  are outside the app's `tsc` scope):
  `npx --yes deno check --node-modules-dir=none supabase/functions/admin-actions/index.ts`
- No automated tests exist for this function.
