# src/types

## Overview

`database.ts` holds hand-written domain types that predate the generated
Supabase types, plus `Post` and `PostWithVenue`, which are derived from the
generated `Database` in `src/integrations/supabase/types.ts`. Only two exports
are imported elsewhere in `src`: `PostWithVenue` by `src/pages/Index.tsx` and
`Venue` by `src/pages/Discovery.tsx`.

## Interface

- `type Json`. [database.ts:Json]
- Hand-written interfaces: `Profile`, `Venue`, `VenueClaim`, `PortfolioItem`,
  `Ticket`. [database.ts:Profile] [database.ts:Venue] [database.ts:VenueClaim]
  [database.ts:PortfolioItem] [database.ts:Ticket]
- `type Post = GeneratedDatabase["public"]["Tables"]["posts"]["Row"]`.
  [database.ts:Post]
- `type PostWithVenue = Post & { profiles: <profiles Row>; venues: Pick<<venues Row>, "id" | "name"> | null }`.
  [database.ts:PostWithVenue]
- `interface Database`: a hand-written schema over `profiles`, `venues`,
  `venue_claims`, `portfolio_items`, `tickets`. It is distinct from the
  generated `Database`, which this file imports as `GeneratedDatabase`; no file
  in `src` imports this one. [database.ts:Database]

## Invariants

- `Post` and `PostWithVenue` are derived from the generated types so they cannot
  drift from the table. `PostWithVenue` mirrors the `Index.tsx` select
  `*, profiles:user_id (*), venues:venue_id (id, name)`; `venues` is a `Pick` of
  `id` and `name` because the embed selects only those, so reading another field
  is a compile error. [database.ts:PostWithVenue]
- `Profile.sub_role` is typed `Position | null` from `src/config/positions.ts`,
  matching the `profiles_sub_role_allowed` constraint. [database.ts:Profile]
- The hand-written interfaces are not checked against the schema:
  - `Venue.verified` has no column in the generated `venues` Row (a phantom
    column; see CLAUDE.md "Phantom columns"). `Discovery.tsx` imports this type.
    [database.ts:Venue]
  - `VenueClaim.status` is `"pending" | "approved" | "rejected"`, without the
    `revoked` status CLAUDE.md records for claim history (A7).
    [database.ts:VenueClaim]
  - `Profile.role_type` is a three-value union while the generated `app_role`
    enum has six values. [database.ts:Profile]
- For new code, derive types from the generated `Database` (or its `Tables<...>`
  helper), as `Post` does, rather than adding hand-written interfaces here.
  [database.ts:Post]

## Side Effects

- None. Type declarations only.

## Verification

- Run: `npm run typecheck` (`tsc --build`), then `npm run build` (`vite build`).
  `package.json` defines no `test` script.
