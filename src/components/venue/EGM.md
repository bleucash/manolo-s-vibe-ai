# venue

## Overview

Venue-scoped editing widgets for managers. `VenuePriceEditor` loads a venue's
`entry_price` and `vip_price`, lets the manager edit them, and saves both. Saving
is gated on Tier 2 business verification through `useVenueVerified`
(`src/hooks/useVenueVerified`), and the blocked state is rendered with
`Tier2Notice` from [`../dashboard/EGM.md`](../dashboard/EGM.md).

## Interface

- `[VenuePriceEditor.tsx:VenuePriceEditor]` default export, props
  `VenuePriceEditorProps = { venue: { id: string; name: string } }`.
- `[VenuePriceEditor.tsx:parsePrice]` module-local (not exported),
  `(raw: string) => number | null`.
- Subdirectories: None.

## Invariants

- `[VenuePriceEditor.tsx:handleSave]` The `venues` update ends in `.select("id")`
  and treats `!data || data.length === 0` as a failure ("Nothing was saved."),
  so an RLS-filtered zero-row update is not reported as success. Keep this check.
- `[VenuePriceEditor.tsx:parsePrice]` An empty field returns `null` and blocks
  saving instead of writing `0`. Otherwise it accepts only values where
  `Number.isFinite(value) && value >= 0`.
- `[VenuePriceEditor.tsx:VenuePriceEditor]` Gate:
  `tier2Blocked = !verificationLoading && !isVerified` disables both inputs and
  renders `Tier2Notice`. Saving requires
  `canSave = loadState === "loaded" && pricesValid && !isSaving && !tier2Blocked`.
  `handleSave` itself re-checks load state and parsed values but not
  `tier2Blocked`. The server is the real boundary:
  `[supabase/migrations/20260809114940_tier2_business_verification.sql:venues_require_business_verified]`
  is a `BEFORE UPDATE` trigger that `RAISE`s on an `entry_price` or `vip_price`
  change for an unverified venue, so that path surfaces as a real error rather
  than a silent zero-row result.
- `[VenuePriceEditor.tsx:useEffect]` Keyed on `venue.id`. A `cancelled` flag
  drops stale responses. A read error sets `loadState` to `"failed"`, and the
  form renders only when it is `"loaded"`.

## Side Effects

- `[VenuePriceEditor.tsx:useEffect]` `supabase.from("venues")` select
  `entry_price, vip_price`, `.eq("id", venue.id)`, `.single()`.
- `[VenuePriceEditor.tsx:handleSave]` `supabase.from("venues")` update
  `{ entry_price, vip_price }`, `.eq("id", venue.id)`, `.select("id")`.
- Sonner toasts on success and failure, and `console.error` on load and save errors.

## Verification

- Run: `npm run typecheck` (`tsc --build`) and `npm run build` (`vite build`).
  `package.json` has no `test` script.
