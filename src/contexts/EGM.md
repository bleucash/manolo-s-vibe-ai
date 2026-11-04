# src/contexts

## Overview

`UserModeContext.tsx` provides the app-wide session and role context: the
current Supabase session, the signed-in user's role-derived flags, the venues a
manager owns (with their Tier 2 `business_verified` flag), and the active venue
selection. It hydrates instantly from `localStorage`, then reconciles against
`profiles.role_type` and `venues.owner_id`.

## Interface

- `UserModeProvider: React.FC<{ children }>`: owns the state below and the auth
  subscription. [UserModeContext.tsx:UserModeProvider]
- `useUserMode()`: returns the context value; throws
  `"useUserMode must be used within UserModeProvider"` outside the provider.
  [UserModeContext.tsx:useUserMode]
- Context value fields (`UserModeContextType`, not exported):
  [UserModeContext.tsx:UserModeContextType]
  - `mode: "guest" | "talent" | "manager"` and `setMode(mode)`
  - `isManager: boolean`, `isTalent: boolean`
  - `userVenues: Venue[]`, where the local `Venue` is
    `{ id, name, image_url, hero_reel_url, business_verified }`
    [UserModeContext.tsx:Venue]
  - `activeVenueId: string | null` and `setActiveVenueId(id | null)`
  - `isLoading: boolean`
  - `session: Session | null`
- Not exported: `type UserMode`, `interface Venue`, `syncProfileAndVenues`.

## Invariants

- `mode` is a UI hint, not an authorization source. It initialises from
  `localStorage.userMode` with an unchecked cast (default `"guest"`), is
  overwritten by `syncProfileAndVenues` from `profiles.role_type`, and `setMode`
  lets any caller set it to anything. Gate access on `role_type`, never on `mode`.
  [UserModeContext.tsx:setModeState initializer] [UserModeContext.tsx:setMode]
  [CLAUDE.md:Role model]
- Manager status is `role_type === "manager"` only; `venue_manager` is not
  accepted here (contrast `MANAGER_ROLES` in `src/lib/roleClaims.ts`). Any role
  other than `manager` or `talent` resolves to `"guest"`.
  [UserModeContext.tsx:syncProfileAndVenues]
- `userVenues` is fetched only for managers and only venues with
  `owner_id = userId`, so it is owner-scoped by construction;
  `src/hooks/useVenueVerified.ts` relies on that scope.
  [UserModeContext.tsx:syncProfileAndVenues]
- `business_verified` is carried on each venue so the five Tier 2 surfaces do not
  each query it. [UserModeContext.tsx:Venue]
- A stored `localStorage.activeVenueId` is used only if it is one of the owned
  venues; otherwise the first owned venue becomes active.
  [UserModeContext.tsx:syncProfileAndVenues]
- The `isVerifying` ref drops a sync requested while another is in flight; it is
  not queued. [UserModeContext.tsx:isVerifying]
- Query errors are not inspected: only `data` is destructured from the
  `profiles` and `venues` reads, so a failed read leaves the previous state and
  still sets `isLoading` to false. A manager owning zero venues leaves
  `userVenues` and `activeVenueId` at their prior values.
  [UserModeContext.tsx:syncProfileAndVenues]
- `isLoading` starts true and becomes false after the first sync completes, when
  there is no initial session, or on `SIGNED_OUT`. Consumers must wait on it
  before rendering a blocked state. [UserModeContext.tsx:UserModeProvider]

## Side Effects

- `localStorage`: reads `userMode` and `activeVenueId`; writes `userMode` in
  `setMode` and after each sync; writes or removes `activeVenueId` in
  `setActiveVenueId`; removes both on `SIGNED_OUT`.
  [UserModeContext.tsx:setMode] [UserModeContext.tsx:setActiveVenueId]
  [UserModeContext.tsx:UserModeProvider]
- Supabase reads: `profiles` (`select("role_type")` by `id`) and, for managers,
  `venues` (`select("id, name, image_url, hero_reel_url, business_verified")`
  by `owner_id`). [UserModeContext.tsx:syncProfileAndVenues]
- Auth: `supabase.auth.getSession()` on mount and an `onAuthStateChange`
  subscription; `SIGNED_IN` and `TOKEN_REFRESHED` trigger a resync, `SIGNED_OUT`
  resets all state. The subscription is removed on unmount.
  [UserModeContext.tsx:UserModeProvider]
- `console.error("Context Neural Sync Error:", err)` on a thrown error.
  [UserModeContext.tsx:syncProfileAndVenues]

## Verification

- Run: `npm run typecheck` (`tsc --build`), then `npm run build` (`vite build`).
  `package.json` defines no `test` script.
