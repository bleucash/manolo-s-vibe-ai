# src/lib

## Overview

Shared, framework-free helpers. `presence.ts` is the one place guest-visible
presence is computed. `roleClaims.ts` is the client-side, submission-time check
that stops a user filing a talent application and a venue claim at once.
`utils.ts` holds the Tailwind class-merge helper.

## Interface

`presence.ts`

- `interface PresenceProfile { is_active?, current_venue_id? }` and
  `interface PresenceVenue { id?, is_active? }`.
  [presence.ts:PresenceProfile] [presence.ts:PresenceVenue]
- `isTappedIn(profile): profile is T & { current_venue_id: string }`: tapped in
  anywhere, regardless of venue or whether it is open. [presence.ts:isTappedIn]
- `isPresentAt(profile, venue): boolean`: tapped in, tapped in at this venue, and
  this venue open. [presence.ts:isPresentAt]
- `isPresentAtOwnVenue(profile, venueIsOpen): boolean`: for callers that already
  know the venue matches. [presence.ts:isPresentAtOwnVenue]

`roleClaims.ts`

- `type RoleTrack = "talent" | "manager"`. [roleClaims.ts:RoleTrack]
- `interface TrackConflict { title, description }`. [roleClaims.ts:TrackConflict]
- `checkOtherTrackConflict(userId, track): Promise<TrackConflict | null>`: `null`
  when submission is allowed, otherwise the reason it is blocked.
  [roleClaims.ts:checkOtherTrackConflict]
- Not exported: `MANAGER_ROLES = ["manager", "venue_manager"]`,
  `OPEN_STATUSES = ["pending", "approved"]`.
  [roleClaims.ts:MANAGER_ROLES] [roleClaims.ts:OPEN_STATUSES]

`utils.ts`

- `cn(...inputs: ClassValue[])`: `twMerge(clsx(inputs))`. [utils.ts:cn]

## Invariants

- Three different "active" columns are kept apart: affiliation
  (`venue_staff.status = 'active'`), tapped in (`profiles.is_active` +
  `profiles.current_venue_id`) and open (`venues.is_active`). Presence requires
  tapped in, tapped in here, and here open. [presence.ts header comment]
- Presence must be computed through these functions, not re-derived inline.
  `TalentDashboard` is the one deliberate exception (the talent's own view).
  [presence.ts:isPresentAt] [CLAUDE.md:"Active" means three different things]
- `isPresentAt` fails closed when the venue has no `id`. [presence.ts:isPresentAt]
- Tapped-in state is deliberately not cleared when a venue closes; presence is
  evaluated at display time, so closing hides it and reopening restores it.
  [presence.ts header comment]
- `isTappedIn` is a type predicate so callers get `current_venue_id: string`
  without a non-null assertion. [presence.ts:isTappedIn]
- One account holds one role permanently. Only cross-track conflicts block:
  talent is blocked by a manager role or an open (`pending`/`approved`)
  `venue_claims` row; manager is blocked by a `talent` role or an open
  `talent_applications` row. A manager claiming another venue is the same track
  and stays allowed. [roleClaims.ts:checkOtherTrackConflict]
- `checkOtherTrackConflict` is not the enforcement point and fails open: any read
  error is logged and returns `null`. Enforcement is `findRoleConflict` in
  `supabase/functions/admin-actions/index.ts`, which fails closed and returns
  409. The two cannot share code (Deno bundle), so a rule change here must be
  mirrored there. [roleClaims.ts:checkOtherTrackConflict]
- `MANAGER_ROLES` treats the legacy enum value `venue_manager` as manager, unlike
  `src/contexts/UserModeContext.tsx`, which checks `"manager"` only.
  [roleClaims.ts:MANAGER_ROLES]

## Side Effects

- `presence.ts`, `utils.ts`: None. Pure functions.
- `roleClaims.ts`: Supabase reads only, `profiles` (`select("role_type")` by
  `id`), then either `venue_claims` or `talent_applications`
  (`select("id")` by `user_id`, `status IN ('pending','approved')`, `limit(1)`).
  `console.error` on read errors. No writes. [roleClaims.ts:checkOtherTrackConflict]

## Verification

- Run: `npm run typecheck` (`tsc --build`), then `npm run build` (`vite build`).
  `package.json` defines no `test` script.
