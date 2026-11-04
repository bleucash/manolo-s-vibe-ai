# src/config

## Overview

Static, render-time configuration with no I/O. `positions.ts` is the single
source for the nine positions a person can hold (used by both
`profiles.sub_role` and `venue_staff.staff_role`) and for which of them may
appear on guest-facing surfaces. `brand.ts` holds brand values expected to
change before launch, kept in one file so a rename is not half-done across JSX.

## Interface

`positions.ts`

- `POSITIONS` (`as const`): nine keys, `host`, `entertainer`, `dj`, `bartender`,
  `bottle_girl`, `promoter`, `media`, `security`, `event_staff`, each mapping to
  `{ label, description, guestFacing }`. Only `security` and `event_staff` have
  `guestFacing: false`. [positions.ts:POSITIONS]
- `type Position = keyof typeof POSITIONS`. [positions.ts:Position]
- `ALL_POSITIONS: Position[]` and `GUEST_FACING_POSITIONS: Position[]`.
  [positions.ts:ALL_POSITIONS] [positions.ts:GUEST_FACING_POSITIONS]
- `isPosition(value): value is Position`, a type predicate over
  `string | null | undefined`. [positions.ts:isPosition]
- `isGuestFacingPosition(value): boolean`. [positions.ts:isGuestFacingPosition]
- `positionLabel(value): string | null`: the label, or the raw stored value if
  unrecognised, or `null` if empty. For internal surfaces. [positions.ts:positionLabel]
- `guestFacingLabel(value): string | null`: the label for guest-facing positions,
  `null` for operational or unknown values. For Discovery, the talent directory
  and public profiles. [positions.ts:guestFacingLabel]
- `isOperationalPosition(value): boolean`: true only for a known non-guest-facing
  position. [positions.ts:isOperationalPosition]
- Not exported: `interface PositionMeta` and the compile-time check `_shape`.
  [positions.ts:PositionMeta] [positions.ts:_shape]

`brand.ts`

- `VERIFICATION_INSTAGRAM_HANDLE = "getmanolo"`: the account talent applicants DM
  their verification code to and venue claimants DM from the venue's account.
  [brand.ts:VERIFICATION_INSTAGRAM_HANDLE]

## Invariants

- The key list of `POSITIONS` is duplicated in the database CHECK constraints
  `profiles_sub_role_allowed` and `venue_staff_staff_role_allowed`. Adding or
  removing a position here without changing both constraints makes writes fail
  at the DB. The constraints live in the database, not in this directory.
  [positions.ts:POSITIONS header comment]
- Every entry must carry `label`, `description` and `guestFacing`:
  `_shape: Record<Position, PositionMeta> = POSITIONS` fails the build otherwise.
  [positions.ts:_shape]
- Display surfaces filter on `guestFacing` rather than keeping their own lists, so
  adding a position is a one-line change here. [positions.ts:POSITIONS header comment]
- Unknown values fail closed for guest-facing purposes: `isGuestFacingPosition`
  returns false and `guestFacingLabel` returns `null`, so legacy free text never
  leaks onto a public surface. [positions.ts:isGuestFacingPosition] [positions.ts:guestFacingLabel]
- `isOperationalPosition` is deliberately not `!isGuestFacingPosition`: `null`
  (not chosen yet) and unknown legacy values return false, so they are not
  dropped from listings. Use it to filter people out of guest-facing lists; use
  `isGuestFacingPosition` to decide whether to render a label.
  [positions.ts:isOperationalPosition]
- `label` and `description` are display-only and not stored in the database, so
  copy changes need no migration. [positions.ts:POSITIONS header comment]
- A position is a label, never a permission: `profiles.sub_role` is
  self-assigned, so gating capability on it makes that capability
  self-assignable. Gate on `role_type` or `venue_staff` instead.
  [CLAUDE.md:Two layers of identity]
- `VERIFICATION_INSTAGRAM_HANDLE` is stored without the leading `@`; add it at
  render time. Nothing persists this value (only the applicant's own handle is
  stored), so changing it takes effect everywhere at once.
  [brand.ts:VERIFICATION_INSTAGRAM_HANDLE]

## Side Effects

- None. Both files export constants and pure functions only.

## Verification

- Run: `npm run typecheck` (`tsc --build`), then `npm run build` (`vite build`).
  `package.json` defines no `test` script.
