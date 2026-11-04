# supabase/functions

## Overview

Supabase Edge Functions, one directory per function, each a single Deno
`index.ts` built around `Deno.serve`. There is no `_shared` module: helpers
are duplicated deliberately rather than imported (see `findRoleConflict` in
`admin-actions`). Two concerns are grouped here:

- **Admin review authority.** `admin-actions` is the server-side boundary for
  the venue-claim, talent-application and business-verification decisions.
  It writes as the service role after matching the caller against
  `ADMIN_USER_ID`.
- **Ticketing (dormant).** `create-checkout-session` creates a Stripe Checkout
  Session as the calling user. `stripe-webhook` turns the completed session
  into a `tickets` row as the service role. The two are coupled only through
  the Stripe session `metadata` keys:
  - `user_id`, `venue_id`, `venue_name`;
  - `promoter_id`, `ticket_type`, `customer_name`.

  Ticket purchasing is withheld from the shipped UI by owner decision.

Writes made with the service role bypass RLS, so in these functions the code
itself is the authorization boundary.

## Subdirectories & Boundaries

- admin-actions: [./admin-actions/EGM.md](./admin-actions/EGM.md) - Admin-only
  JWT-gated action endpoint. Its seven zod actions are:
  - `approve_venue_claim`, `reject_venue_claim`, `revoke_venue_claim`;
  - `approve_talent`, `reject_talent`;
  - `approve_business`, `reject_business`.

  It writes `venues`, `profiles`, `venue_claims`, `venue_staff`,
  `talent_applications` and `venue_business_applications` with deliberately
  ordered, non-transactional steps.
- create-checkout-session:
  [./create-checkout-session/EGM.md](./create-checkout-session/EGM.md) -
  Authenticated Stripe Checkout Session creation for venue entry. It reads
  `venues` prices as the caller, makes no database writes and returns
  `{ url }`.
- stripe-webhook: [./stripe-webhook/EGM.md](./stripe-webhook/EGM.md) -
  Signature-verified handler for `checkout.session.completed`. It inserts one
  `tickets` row with a commission snapshot from active `venue_staff`, and
  returns `200` even on post-verification failures.
