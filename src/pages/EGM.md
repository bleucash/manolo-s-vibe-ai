# src/pages

## Overview

Route-level React pages. Each file default-exports one component. `src/App.tsx` mounts all of them on routes except `NotFound.tsx` (see Interface). Pages fetch with the typed Supabase client (`@/integrations/supabase/client`) and hand most UI and writes to components in `src/components`, hooks in `src/hooks`, and the `useUserMode()` context. This directory has no subdirectories and no tests.

Three route wrappers are defined in `src/App.tsx`, not in this directory: `RequireAuth` (`/notifications`), `BouncerRoute` (`/bouncer`, which wraps `DashboardGuard`) and `CEORoute` (`/ceo`, a client-side email check). All other pages enforce access themselves or not at all. The details are under Invariants.

## Interface

Route table, taken from `src/App.tsx`:

| Route | Default export | Wrapper in App.tsx | Delegates to |
| --- | --- | --- | --- |
| `/` | `[Index.tsx:Index]` | none | `CreatePostDialog`, `ActivitySidebar` |
| `/auth` | `[Auth.tsx:Auth]` | none | none |
| `/discovery` | `[Discovery.tsx:Discovery]` | none | `HeroReel`, `writeFollow` (`@/hooks/useFollow`), `isPresentAt` (`@/lib/presence`) |
| `/venue/manage` | `[VenueManage.tsx:VenueManage]` | none | `InteractiveHeroReel` |
| `/venue/:id` | `[Venue.tsx:Venue]` | none | `useVenueStatus`, `ClaimSectorModal`, `RequestToWorkModal`, `InteractiveHeroReel`, `PortfolioGallery` |
| `/talent/:id` | `[TalentProfile.tsx:TalentProfile]` | none | `useFollow`, `FollowButton`, `InteractiveHeroReel`, `PortfolioGallery`, `isPresentAt`/`isTappedIn` |
| `/talent-directory` | `[TalentDirectory.tsx:TalentDirectory]` | none | `InviteTalentModal`, `@/config/positions` |
| `/users/:id` | `[GuestProfile.tsx:GuestProfile]` | none | `useFollow`, `FollowButton` |
| `/profile` | `[Profile.tsx:Profile]` | none | `HeroReel`, `BecomeTalentModal`, `ClaimVenueModal` |
| `/wallet` | `[Wallet.tsx:Wallet]` | none | `QRCodeSVG` (`qrcode.react`) |
| `/messages` | `[Messages.tsx:Messages]` | none | `useChat` (`@/hooks/useChat`), `ChatWindow` |
| `/notifications` | `[Notifications.tsx:Notifications]` | `RequireAuth` | none |
| `/gigs` | `[Gigs.tsx:Gigs]` | none | `TalentGuard`, `TalentDashboard` |
| `/talent-manage` | `[TalentManage.tsx:TalentManage]` | none | `TalentGuard`, `InteractiveHeroReel` |
| `/dashboard`, `/dashboard/:id` | `[Dashboard.tsx:Dashboard]` | none | `DashboardGuard`, then `[Dashboard.tsx:ManagerDashboardPanel]`, then `ManagerDashboard` |
| `/bouncer` | `[Bouncer.tsx:Bouncer]` | `BouncerRoute` | `Html5Qrcode` (`html5-qrcode`) |
| `/ceo` | `[CEODashboard.tsx:CEODashboard]` | `CEORoute` | `@/config/positions`, `@/config/brand` |
| `*` | none; it is `<Navigate to="/discovery" />` | none | none |

`[NotFound.tsx:NotFound]` is not imported anywhere in `src/`. No route reaches it.

Other symbols worth knowing. None of them are exported.

- `[Auth.tsx:landingPathForRole]` is a `const` inside the `Auth` component body, not at module scope. `"manager"` goes to `/venue/manage`, `"talent"` to `/talent-manage`, and anything else to `/discovery`.

The rest are top-level:

- `[Bouncer.tsx:ScanResult]`, `[Bouncer.tsx:CheckInResponse]` and `[Bouncer.tsx:isCheckInResponse]`: a runtime type guard on the `check_in_guest` result. `result` must be one of `"success" | "already_used" | "invalid" | "wrong_venue"`.
- `[CEODashboard.tsx:adminActionError]` reads the server's `{ error }` message out of a `FunctionsHttpError` response body.
- `[Discovery.tsx:CATEGORIES]`, `ActiveBadge`, `ActiveFacepile`, `SpotlightCard`, `SpotlightEmptyCard`, `DirectoryCard`, `VenueFeedCard` and `TalentFeedCard` are local presentational components. `[Discovery.tsx:FollowButton]` is a local component and is **not** `@/components/FollowButton`.
- `[TalentDirectory.tsx:PAGE_SIZE]` (24), `DEBOUNCE_MS` (300), `likeEscape`, `pgrstQuote`, `EXCLUSION_FILTER` and `buildSearchFilter` build PostgREST filters. `[TalentDirectory.tsx:TalentProfile]` is the row type.
- `[Wallet.tsx:TicketData]` is the ticket row type.
- `[VenueManage.tsx:PageLoading]` and `[TalentManage.tsx:PageLoading]` are black full-screen spinners.

URL, query and localStorage inputs:

- Path params come from `useParams()`: `id` in `[Venue.tsx:Venue]`, `[TalentProfile.tsx:TalentProfile]`, `[GuestProfile.tsx:GuestProfile]` and `[Dashboard.tsx:Dashboard]` (read as `urlVenueId`).
- Query params: `?next` in `[Auth.tsx:Auth]`. `?conversation` in `[Messages.tsx:Messages]` is read once as the initial state and is not kept in sync afterwards.
- localStorage: only `[Auth.tsx:handleAuth]` touches it. It removes `userMode` and `activeVenueId`, then on login sets `userMode`.

## Invariants

Access and routing:

- `/ceo` access is enforced only by `CEORoute` in `src/App.tsx`. `[CEODashboard.tsx:CEODashboard]` has no gate of its own. Every write it makes goes through the `admin-actions` edge function, which is the server-side boundary.
- `[Auth.tsx:Auth]` accepts `next` only if it matches `/^\/(?!\/)/` (a same-origin path, with `//` rejected). Otherwise it uses `"/"`. On login an explicit `?next` wins over `landingPathForRole(role)`. On sign-up the same validated path is sent to Supabase as `options.emailRedirectTo` (`window.location.origin` plus the path).
- `[Auth.tsx:handleAuth]` writes `userMode` from the `profiles.role_type` it just queried, before a hard redirect (`window.location.href`).
- These pages redirect to `/auth` when there is no session: `[Gigs.tsx:Gigs]`, `[Messages.tsx:Messages]`, `[TalentManage.tsx:TalentManage]`, `[Wallet.tsx:setupRealtimeAndFetch]` and `[Profile.tsx:fetchProfileData]` (via `supabase.auth.getUser()`).
- `[Gigs.tsx:Gigs]` and `[TalentManage.tsx:TalentManage]` delegate the talent gate to `<TalentGuard>`. `Gigs` destructures `mode` but never uses it.
- Some pages gate or redirect on `mode` rather than `role_type`:
  - `[VenueManage.tsx:VenueManage]` redirects to `/profile` when `mode !== "manager"`, after waiting for `contextLoading`.
  - `[Profile.tsx:Profile]` redirects `"talent"` mode to `/talent-manage` and `"manager"` mode to `/venue/manage`.
  - `[Index.tsx:Index]` shows the create-post button when `mode === "manager" || mode === "talent"`.
- `[VenueManage.tsx:VenueManage]` deliberately does not redirect when there is no `activeVenueId`. It renders a stable pending or empty screen, which breaks the redirect loop with `Profile.tsx`.
- `[Profile.tsx:Profile]` (venue-claim entry) and `[Venue.tsx:Venue]` (claim button) both hide claiming from talent. The gate is the account role (`isTalent`), never `mode` (comment A33).
- `[Dashboard.tsx:ManagerDashboardPanel]` is mounted only inside `DashboardGuard`. It calls `setActiveVenueId(urlVenueId)` when the URL's venue differs from the active one, so `/dashboard/:id` persists that venue as active.
- `[Bouncer.tsx:Bouncer]` sends the user to `/dashboard` when there is no `activeVenueId`. The venue-ownership check is server-side, inside `check_in_guest`. Errors `42501`, `PGRST301` and `PGRST303` show "Not authorized at this venue".
- `[TalentDirectory.tsx:canInvite]` is `isManager && !!activeVenueId`.

Data shape and filtering:

- `venues` reads always name their columns. No page uses `select("*")` on `venues`; see the A31 comments in `[Venue.tsx:fetchVenueData]`, `[VenueManage.tsx:fetchVenue]` and `[Discovery.tsx:Discovery]`.
- Presence goes through `isPresentAt` from `@/lib/presence`. It is used in `[Discovery.tsx:ActiveFacepile]`, `SpotlightCard`, `TalentFeedCard` and `[TalentProfile.tsx:fetchData]`.
- `[Index.tsx:fetchActiveNodes]` does the same thing server-side. It filters `is_active = true` and `venues.is_active = true` through the explicitly named embed `venues!profiles_current_venue_id_fkey!inner`.
- `[Discovery.tsx:VenueFeedCard]` shows the open badge on `venue.is_active` alone.
- Affiliation filters use `"active"`:
  - `[Discovery.tsx:Discovery]` filters `.eq("venue_staff.status", "active")`.
  - `[Venue.tsx:fetchVenueData]` and `[TalentProfile.tsx:fetchData]` filter `.eq("status", "active")`.
  - `[Venue.tsx:Venue]` branches the viewer's own link on `"pending"` or `"active"`.
- Operational positions never reach guest surfaces:
  - `[Discovery.tsx:Discovery]` filters both talent rails with `!isOperationalPosition(t.sub_role)`.
  - `[TalentDirectory.tsx:EXCLUSION_FILTER]` keeps rows where `sub_role` is null or is not a non-`guestFacing` position.
  - `[TalentManage.tsx:TalentManage]` offers only `GUEST_FACING_POSITIONS` and stores an empty choice as `null`.
- `[TalentDirectory.tsx:fetchPage]` uses keyset pagination on `(sort_name, id)` with `limit(PAGE_SIZE + 1)`.
  - `likeEscape` must run before `pgrstQuote`.
  - Chained `.or()` calls are ANDed.
  - Stale responses are dropped by comparing `requestIdRef`.
- `[Messages.tsx:renderConversationList]` branches on `conv.kind === "dm"` and renders `conv.thread_title`. It never branches on a NULL `display_name`.
- `[Index.tsx:fetchUserCharges]` reads `post_likes` with `is_active = true`. `[Index.tsx:handleChargeToggle]` soft-toggles with `upsert(..., { onConflict: "post_id,user_id" })`.
- `[CEODashboard.tsx:CEODashboard]` disables Approve on venue claims and talent applications until the reviewer ticks that application's `dmConfirmed` box. The business-verification "Verify" button has no `dmConfirmed` box and is never disabled. Reject is never gated. Revoke runs only from the `AlertDialog` (`[CEODashboard.tsx:handleRevoke]`).
- `[Wallet.tsx:setupRealtimeAndFetch]` shows only tickets with `status === "active"`. The same rule applies to realtime INSERT and UPDATE events.

Rows-affected discipline:

- `[Venue.tsx:handleWithdraw]` is the only page write that ends in `.select()` and checks for zero rows.
- These writes check only `error`:
  - `[TalentManage.tsx:handleSave]`
  - `[Notifications.tsx:markAllRead]`
  - `[Notifications.tsx:clearAll]`
  - `[Index.tsx:handleChargeToggle]`

## Side Effects

Supabase tables and views, as they appear in `supabase.from(...)` calls:

- `profiles`:
  - Read by Auth, Discovery, GuestProfile, Index, Profile, TalentDirectory, TalentManage, TalentProfile and CEODashboard.
  - Written only by `[TalentManage.tsx:handleSave]`, which updates `display_name`, `sub_role` and `bio`.
- `venues`: read by `[Discovery.tsx:Discovery]`, `[Venue.tsx:fetchVenueData]`, `[VenueManage.tsx:fetchVenue]`, `[TalentProfile.tsx:fetchData]` and `[CEODashboard.tsx:fetchOversightData]`.
- `venue_staff`:
  - Read by Venue and TalentProfile.
  - Deleted by `[Venue.tsx:handleWithdraw]`, which deletes the viewer's own row.
- `venue_claims`: read by `[Profile.tsx:fetchProfileData]`, `[VenueManage.tsx:checkPendingClaim]` and `[CEODashboard.tsx:fetchOversightData]`.
- `talent_applications`: read by `[Profile.tsx:fetchProfileData]` and `[CEODashboard.tsx:fetchOversightData]`.
- `venue_business_applications`: read by `[CEODashboard.tsx:fetchOversightData]`.
- `followers`: read by `[Discovery.tsx:Discovery]`, `[Index.tsx:fetchFollowerFeed]` and `[GuestProfile.tsx:fetchProfile]` (a count).
- `venue_followers`: read by `[Discovery.tsx:Discovery]`. Follow writes go through `writeFollow` in `[Discovery.tsx:handleToggleFollow]`.
- `posts`: read by `[Index.tsx:fetchFollowerFeed]`.
- `post_likes`:
  - Read by `[Index.tsx:fetchUserCharges]`.
  - Upserted by `[Index.tsx:handleChargeToggle]`.
- `interactions`: written by `[Discovery.tsx:handleCardClick]`, but see the warning below.
- `conversation_participants`: read by `[GuestProfile.tsx:handleMessage]`, which reads the recipient's `state`.
- `notifications`:
  - Read by `[Notifications.tsx:fetchNotifications]`.
  - Updated by `[Notifications.tsx:markAllRead]` (`is_read`), with no `user_id` filter.
  - Deleted by `[Notifications.tsx:clearAll]`, filtered only by `.neq("id", "00000000-...")`.
  - Both writes rely on RLS to scope them to the current user.
- `tickets`: read by `[Wallet.tsx:setupRealtimeAndFetch]`.

**Warning: `[Discovery.tsx:handleCardClick]` never sends its insert.** The `supabase.from("interactions").insert(...)` call is neither awaited nor `.then`'d. In the installed `@supabase/postgrest-js` (2.89.0), `insert()` only builds the request, and the fetch is issued inside `then()` (`node_modules/@supabase/postgrest-js/dist/index.mjs`), so a builder that is never awaited sends nothing. This is established by reading the library source; it has not been observed at runtime.

RPCs:

- `[Discovery.tsx:Discovery]` calls `get_talent_spotlight` with `{ limit_count: 3 }`.
- `[GuestProfile.tsx:handleMessage]` calls `start_conversation` with `{ target_user_id }`, then navigates to `/messages?conversation=<id>`.
- `[Bouncer.tsx:onScanSuccess]` calls `check_in_guest` with `{ qr_input, current_venue_id }`.

Edge functions:

- `admin-actions` is called from `[CEODashboard.tsx:handleVenueApproval]`, `handleTalentApproval`, `handleRevoke` and `handleBusinessApproval`.
- The actions are `approve_venue_claim`, `reject_venue_claim`, `approve_talent`, `reject_talent`, `revoke_venue_claim`, `approve_business` and `reject_business`.
- Every action mutates. There is no dry-run.

Auth:

- `supabase.auth.signInWithPassword` and `signUp` in `[Auth.tsx:handleAuth]`.
- `getUser` in `[Profile.tsx:fetchProfileData]`.
- `getSession` in `[Wallet.tsx:setupRealtimeAndFetch]`.
- `signOut` in `[Profile.tsx:handleLogout]`, `[TalentManage.tsx:handleSignOut]` and `[VenueManage.tsx:handleSignOut]`.

Realtime:

- `[Notifications.tsx:Notifications]` subscribes on channel `"neural-feed"` to `postgres_changes` `*` on `notifications`, with no row filter.
- `[Wallet.tsx:setupRealtimeAndFetch]` subscribes on channel `"wallet-tickets"` to INSERT and UPDATE on `tickets`, filtered `user_id=eq.<uid>`.
- `[Notifications.tsx:Notifications]` always removes its channel on unmount.
- `[Wallet.tsx:Wallet]` assigns its channel only after two awaits (`getSession`, then the `tickets` select), and its cleanup removes it only `if (channel)`. If Wallet unmounts before setup finishes, the `"wallet-tickets"` subscription created afterwards is never removed.

Messaging: `[Messages.tsx:Messages]` makes no direct Supabase calls. All reads and writes go through `useChat`.

Context and device:

- `setMode` is called by the `toggleUserMode` handlers in Profile, TalentManage and VenueManage.
- `setActiveVenueId` is called by `[Dashboard.tsx:ManagerDashboardPanel]`.

In-page navigation (in addition to the redirects listed under Invariants):

- Discovery: `/talent/:id` and `/venue/:id` through `handleCardClick`, and `/talent-directory`.
- Index: `/talent/:id`, `/users/:id` and `/venue/:id`.
- Venue: `/dashboard` (the owner's "Operation Control" button), `/discovery` and `/talent/:id`.
- VenueManage: `/discovery` and `/venue/:id`.
- TalentProfile: `/venue/:id`.
- TalentDirectory: `/discovery` and `/talent/:id`.
- Messages: `/`.
- Wallet: `/discovery`.
- Bouncer: "Disconnect" goes to `/dashboard`.
- Mode toggles: Profile's `toggleUserMode` goes to `/talent-manage`, `/venue/manage` or `/profile`. The TalentManage and VenueManage toggles go to `/profile`.
- Sign-out: each `signOut` handler (Profile, TalentManage, VenueManage) then navigates to `/auth`.
- Back buttons (`navigate(-1)`): Gigs, GuestProfile, Notifications, TalentProfile and Venue.
- `[Bouncer.tsx:startScanner]` opens the camera via `Html5Qrcode`.

## Verification

- Run: `npm run typecheck`
- Run: `npm run build`
- `package.json` has no `test` script.
