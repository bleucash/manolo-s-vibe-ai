# create-checkout-session

## Overview

Supabase Edge Function (Deno) that creates a Stripe Checkout Session for venue
entry tickets and returns its URL. It authenticates the caller with the
caller's own JWT, reads the venue's prices **as that user** (anon key plus the
forwarded `Authorization` header, so RLS and the `venues` column grants
apply), finds or creates a Stripe customer by email, and creates a
`mode: "payment"` session whose metadata the
[`stripe-webhook`](../stripe-webhook/EGM.md) function later turns into a
`tickets` row. It writes nothing to the database.

Ticketing is deliberately withheld from the shipped UI (see the project
`CLAUDE.md`, "Ticketing"): this function is dormant wiring to keep, not to
surface. The client reference is `src/components/TicketPurchaseDialog.tsx`,
which `fetch`es this function by a hard-coded project URL.

Single source file: `index.ts`.

## Interface

- `[index.ts:Deno.serve]`: the HTTP handler. `OPTIONS` returns `"ok"` with
  `corsHeaders`. There is no other method check.
- `[index.ts:corsHeaders]`: `Access-Control-Allow-Origin: *`; allowed headers
  `authorization, x-client-info, apikey, content-type`; methods
  `POST, OPTIONS`.
- Request: header `Authorization` (required, forwarded as-is to Supabase).
  JSON body `{ venue_id, price_type, quantity, referral_id }`. Only `venue_id`
  is required. `price_type === "vip"` selects VIP pricing. `referral_id` is
  carried into metadata as `promoter_id`.
- Response: `200 { url: session.url }`. **Every failure returns
  `400 { error: <message> }`**, including missing configuration, a missing
  header, an authentication failure, a venue read failure and Stripe errors.
- Stripe session metadata (the contract `stripe-webhook` reads):
  - `user_id`, `customer_name`, `venue_id`, `venue_name`, `ticket_type`;
  - `promoter_id`: `referral_id`, or `""` when it is absent.
- Redirects: `success_url` is `<origin>/wallet?session_id={CHECKOUT_SESSION_ID}`
  and `cancel_url` is `<origin>/venue/<venue_id>`. `origin` is the request's
  `origin` header, falling back to `"https://lovable.dev"`.
- Environment variables read (names only): `STRIPE_SECRET_KEY`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- Subdirectories: None.

## Invariants

- **Authentication runs before any Stripe call.** `supabase.auth.getUser()`
  must return a user, or it throws `"Authentication failed"`.
- **Quantity is clamped to 1 to 10**:
  `Math.min(Math.max(parseInt(quantity) || 1, 1), 10)`.
- **Pricing.** VIP applies only when `price_type === "vip"` **and**
  `venue.vip_price` is truthy. Otherwise `parseFloat(venue.entry_price) || 20.0`,
  so a missing or zero entry price is charged at 20.00 USD.
  `unit_amount` is `Math.round(unitPrice * 100)` cents, currency `usd`.
- **Ticket type label** is `"VIP Admission"` or `"General Admission"`. It is
  used in the product name and in `metadata.ticket_type`.
- **The venue read names its columns** (`name, entry_price, vip_price`), as
  the `venues` column-grant rule requires. All three are in the `GRANT SELECT`
  list in
  `supabase/migrations/20261014120000_a31_venues_column_grants.sql`.
  `select("*")` here would fail with `42501`.
- **The customer is found by email first:**
  `stripe.customers.list({ email, limit: 1 })`. It is created only when none
  matches, with `metadata.user_id`.
- **No server-side check that ticketing is enabled for the venue.** The
  function does not read `ticketing_enabled`, `business_verified` or
  `is_active`, and does not validate `referral_id` against `venue_staff`.

## Side Effects

- **Stripe (network):** `stripe.customers.list`, possibly
  `stripe.customers.create`, and `stripe.checkout.sessions.create`, on API
  version `2023-10-16` with `Stripe.createFetchHttpClient()`. A new customer
  is a persistent object in the Stripe account.
- **Supabase (network):** `auth.getUser()` and one `venues` SELECT, both as
  the calling user.
- **Database writes:** None.
- **Logging:** `console.error("Critical Function Error:", errorMessage)` on
  failure.

## Verification

- Type check (not run as part of this documentation pass; these Deno files
  are outside the app's `tsc` scope):
  `npx --yes deno check --node-modules-dir=none supabase/functions/create-checkout-session/index.ts`
- No automated tests exist for this function.
