# stripe-webhook

## Overview

Supabase Edge Function (Deno) that receives Stripe webhook events, verifies
their signature, and on `checkout.session.completed` inserts one `tickets`
row from the session metadata written by
[`create-checkout-session`](../create-checkout-session/EGM.md). It computes a
promoter commission from the promoter's active `venue_staff` row and stores it
on the ticket as a dollar snapshot. It writes with a **service-role** client,
so RLS does not apply.

Ticketing is withheld from the shipped UI (see the project `CLAUDE.md`,
"Ticketing"). This is dormant wiring to keep, not to surface.

Single source file: `index.ts`.

## Interface

- `[index.ts:Deno.serve]`: the HTTP handler. `OPTIONS` returns `"ok"` with
  `corsHeaders`.
- `[index.ts:corsHeaders]`: `Access-Control-Allow-Origin: *`; allowed headers
  include `stripe-signature`.
- Request: the raw Stripe event body (`req.text()`) and a `stripe-signature`
  header.
- Event handled: `checkout.session.completed` only. Other event types are
  acknowledged with `200 { received: true }` and otherwise ignored.
- Metadata consumed from `session.metadata`:
  - required: `user_id`, `venue_id`;
  - optional: `promoter_id`, `venue_name` (default `"Unknown Venue"`) and
    `ticket_type` (default `"General Admission"`).
- Responses:
  - `400 { error: "No signature" }` when the header is missing (only once the
    environment check has passed);
  - `400 { error }` when signature verification fails;
  - **`200` in every other case**, including errors (see Invariants).
- Environment variables read (names only): `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SIGNING_SECRET`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`.
- Subdirectories: None.

## Invariants

- **The environment is checked first, then the signature.** If any of the
  four environment variables is missing, the handler throws into the outer
  `catch` and returns `200 { error: "Missing environment configuration" }`,
  before the `stripe-signature` header is read. Otherwise
  `stripe.webhooks.constructEventAsync(body, signature, webhookSecret)` runs
  on the raw text body before the event is used. A missing header or failed
  verification returns `400`, so Stripe retries.
- **After verification, failures return `200`, so Stripe does not retry them.**
  This covers:
  - missing `user_id` or `venue_id` (`{ error: "Missing metadata" }`);
  - a failed ticket insert (`{ error: insertError.message }`);
  - the outer `catch`, which includes missing environment configuration.

  A dropped ticket is therefore visible only in the function logs.
- **Idempotency is a read-then-insert check on `tickets.stripe_session_id`**
  using `.single()`, whose error is discarded. Two concurrent deliveries can
  both pass the check. If two rows already exist, `.single()` errors, the
  check reads as "no ticket", and another row is inserted. No repo migration
  declares a unique constraint on `tickets.stripe_session_id`; the live schema
  was not checked.
- **Commission comes only from an active affiliation.** The
  `venue_staff.commission_rate` lookup filters
  `venue_id = metadata.venue_id`, `user_id = promoter_id` and
  `status = 'active'`. The result is
  `pricePaid * (commission_rate / 100)`, and it is `0` when there is no
  promoter, no matching row, a NULL or zero rate, or a lookup error (which is
  logged, not fatal). **That is the value this function sends, not
  necessarily the value stored:** the comment in
  `supabase/migrations/20261014120000_a31_venues_column_grants.sql` describes
  `calculate_ticket_commission` as a BEFORE INSERT trigger on `tickets` that
  reads `venues.standard_commission` and yields `commission_earned` as
  price_paid times `standard_commission` when there is no promoter rate. The
  trigger's body is in no repo migration; read the live definition before
  relying on either value.
- **`promoter_id` is not validated as a person or role.** It is whatever
  `create-checkout-session` put in metadata from the client's `referral_id`.
  Only the commission depends on the `venue_staff` match. The ticket's
  `promoter_id` is stored either way, with `""` coerced to NULL.
- **Price paid is `session.amount_total / 100`**, the total in dollars, not
  a per-ticket price. Exactly one `tickets` row is created per session,
  whatever the checkout quantity.
- **Ticket fields set on insert:**
  - `status: "active"`, `qr_code: crypto.randomUUID()`,
    `stripe_session_id: session.id`;
  - `event_name` is set to the ticket-type label, and `venue_name` is taken
    from metadata.

## Side Effects

- **Database writes (service role):** `tickets` INSERT with `user_id`,
  `venue_id`, `promoter_id`, `commission_earned`, `venue_name`, `event_name`,
  `price_paid`, `status`, `stripe_session_id` and `qr_code`. The insert fires
  the `calculate_ticket_commission` BEFORE INSERT trigger (see Invariants);
  other triggers on `tickets`, if any, are not visible in the repo.
- **Database reads:** `tickets` (idempotency check) and
  `venue_staff.commission_rate`.
- **Network:** Stripe SDK client construction and local signature
  verification. No Stripe API call is made on the handled path.
- **Logging:** `console.error` on every failure path. `console.log` of the
  promoter id, commission amount and rate only when an active `venue_staff`
  row with a non-zero `commission_rate` is found. Every created ticket logs a
  success line with only the ticket id.

## Verification

- Type check (not run as part of this documentation pass; these Deno files
  are outside the app's `tsc` scope):
  `npx --yes deno check --node-modules-dir=none supabase/functions/stripe-webhook/index.ts`
- No automated tests exist for this function.
