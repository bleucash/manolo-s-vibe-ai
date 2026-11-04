# src

## Overview

The React single-page app (Vite, TypeScript, Tailwind, shadcn/ui). This
directory holds the entry point and the route table; everything else lives
in the child packages linked below. The app talks to Supabase only through
the one typed client in `integrations/supabase`, and to the server-side
admin authority only through the `admin-actions` edge function.

## Interface

- `[main.tsx:createRoot]`: no exports. Renders `<App />` into `#root` and
  imports the global stylesheet `./index.css`. No providers are mounted here.
- `[App.tsx:App]`: default export. Providers from outer to inner:
  `BrowserRouter` > `UserModeProvider` > the routed layout (`Routes` plus
  `BottomNav` on every route), with sonner `<Toaster />` as a sibling inside
  `UserModeProvider`.
- Route table `[App.tsx:Routes]`:

  | Path | Component | Guard in `App.tsx` |
  |---|---|---|
  | `/` | `Index` | none |
  | `/auth` | `Auth` | none |
  | `/discovery` | `Discovery` | none |
  | `/venue/manage` | `VenueManage` | none (declared before `/venue/:id`) |
  | `/venue/:id` | `Venue` | none |
  | `/talent/:id` | `TalentProfile` | none |
  | `/talent-directory` | `TalentDirectory` | none |
  | `/users/:id` | `GuestProfile` | none |
  | `/profile`, `/wallet`, `/messages`, `/gigs`, `/talent-manage` | same-named pages | none (each page checks its own session) |
  | `/notifications` | `Notifications` | `RequireAuth` |
  | `/dashboard`, `/dashboard/:id` | `Dashboard` | none (`Dashboard` wraps itself in `DashboardGuard`) |
  | `/bouncer` | `Bouncer` | `BouncerRoute` (needs `activeVenueId`, then `DashboardGuard`) |
  | `/ceo` | `CEODashboard` | `CEORoute` (signed-in email must equal one hardcoded address) |
  | `*` | redirect to `/discovery` | none |

- `[vite-env.d.ts]`: Vite client type reference only.
- Child packages:
  - [`./components/EGM.md`](./components/EGM.md): feature components and the
    `ui` design system; most client-side writes live here.
  - [`./pages/EGM.md`](./pages/EGM.md): the routed page components, plus
    `NotFound.tsx`, which no route mounts (the `*` route redirects instead).
  - [`./hooks/EGM.md`](./hooks/EGM.md): `useChat`, `useFollow` and `writeFollow`,
    `useVenueStatus`, `useVenueVerified`, `useIsMobile`, `useToast`.
  - [`./contexts/EGM.md`](./contexts/EGM.md): `UserModeProvider` and `useUserMode`
    (session, role-derived flags, owned venues, active venue).
  - [`./lib/EGM.md`](./lib/EGM.md): `isPresentAt` (presence),
    `checkOtherTrackConflict` (client role-track check), `cn`.
  - [`./config/EGM.md`](./config/EGM.md): `POSITIONS` and
    `VERIFICATION_INSTAGRAM_HANDLE`.
  - [`./integrations/EGM.md`](./integrations/EGM.md): the typed Supabase client
    and the generated `Database` types.
  - [`./types/EGM.md`](./types/EGM.md): hand-written domain types plus
    `Post` and `PostWithVenue`.

## Invariants

- `[App.tsx:CEORoute]`, `[App.tsx:RequireAuth]` and `[App.tsx:BouncerRoute]`
  read `useUserMode()`, so they must render inside `UserModeProvider`. Each
  shows `LoadingState` while `isLoading` is true.
- `CEORoute` is a UI convenience only. Its own comment names `admin-actions`,
  which checks the caller against `ADMIN_USER_ID`, as the real boundary.
  `CEODashboard` makes every write through that function.
- Most routes have no guard in `App.tsx`. Access rules live in the pages and
  components, such as `TalentGuard`, `DashboardGuard` and per-page session
  redirects, and finally in RLS and the database triggers.
- `/venue/manage` must stay declared before `/venue/:id`, or `manage` is read
  as a venue id `[App.tsx:Routes]`.
- `main.tsx` uses a non-null assertion on `document.getElementById("root")`.

## Side Effects

- `[main.tsx:createRoot.render]` mounts the React root and imports `./index.css`.
- `[App.tsx:CEORoute]` logs a `console.error` when a signed-in user who is not
  the CEO opens `/ceo`.
- The guards and the `*` route redirect on the client with `<Navigate>`.
- Every Supabase, Storage, Realtime, edge-function and `localStorage` effect
  belongs to a child package and is listed in its contract.

## Verification

- Run: `npm run typecheck`
- Run: `npm run build`
- Run: `npm run lint`
