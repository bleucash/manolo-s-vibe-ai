# Manolo AI Blueprint

## System Overview

A nightlife app for guests, talent and venue managers. Underneath, it is a
venue-operations product: discovery, feeds and talent profiles bring venues
onto the platform, and every consumer feature also captures data. Project
decisions, traps and operating rules live in [`CLAUDE.md`](./CLAUDE.md), and
the verified open-issues list lives in [`docs/backlog.md`](./docs/backlog.md).
Read both before changing anything.

Two runtimes:

- **Browser SPA** (`src/`): React, Vite, TypeScript, Tailwind and shadcn/ui.
  It reads and writes the Supabase Postgres database directly through one
  typed client, under row-level security as the signed-in user.
- **Supabase** (`supabase/`): the database, whose policies, triggers and RPCs
  are defined in the migrations, and three Deno edge functions. The
  `admin-actions` function is the only server-side authority for admin review
  decisions and writes as service role. The two Stripe functions are dormant
  ticketing wiring.

```
Browser (src/)
  ├── supabase-js typed client ──► Postgres (RLS, triggers, RPCs)  [supabase/migrations]
  ├── Storage buckets: media, profile-media
  ├── Realtime channels (messages, notifications, tickets, venue_staff)
  ├── functions.invoke("admin-actions") ──► admin-actions (service role) ──► Postgres
  └── fetch create-checkout-session ──► Stripe ──► stripe-webhook ──► tickets   (dormant)
```

## Local Interface & Invariants

Build and tooling configuration at the repository root:

- `[vite.config.ts:server]`: the dev server listens on host `"::"`, port `8080`.
- `[vite.config.ts:resolve.alias.@]`: `@` resolves to `./src`.
- `[vite.config.ts:plugins]`: `react()` (SWC), plus `componentTagger()` from
  `lovable-tagger` in development mode only.
- `[tailwind.config.ts]`:
  - Class-based dark mode, with an empty `prefix`.
  - Content globs cover `./src/**` among others.
  - The container is centred, with `2rem` padding and a `2xl` screen of `1400px`.
  - The `neon` and `glass` colour groups, the shadcn tokens and the
    `borderRadius` scale (from `--radius`) all come from CSS variables defined
    in `src/index.css`.
  - Fonts are Bebas Neue (display) and Inter (body).
  - Custom keyframes and animations: `pulse-neon`, `slide-up`, `pulse-green`
    and `scan-line`, plus the accordion pair.
  - The plugin is `tailwindcss-animate`.
- `[postcss.config.js:plugins]`: `tailwindcss` and `autoprefixer`.
- `[eslint.config.js]`:
  - Ignores `dist` and applies to `**/*.{ts,tsx}`.
  - Extends `js.configs.recommended` and `tseslint.configs.recommended`.
  - Sets `ecmaVersion: 2020` and browser globals.
  - Rules: all of `reactHooks.configs.recommended.rules`, and
    `react-refresh/only-export-components` as a warning with
    `allowConstantExport: true`. `@typescript-eslint/no-unused-vars` is off.
- `[package.json:scripts]`: `dev` (`vite`), `build`, `build:dev`
  (`vite build --mode development`), `typecheck` (`tsc --build`), `lint` and
  `preview`. There is no `test` script. Verification is the typecheck, the
  build and lint (see System Verification).

## Subdirectories & System Boundaries

- src: [`./src/EGM.md`](./src/EGM.md) - the SPA: entry point and route table,
  with child contracts for components, pages, hooks, contexts, lib, config,
  integrations and types.
- supabase: [`./supabase/EGM.md`](./supabase/EGM.md) - `config.toml`, the
  migrations (summarised in that contract, since no contract file is kept
  inside `supabase/migrations/`), and the edge functions under
  [`./supabase/functions/EGM.md`](./supabase/functions/EGM.md).
- docs: no contract (no code) - `docs/backlog.md`, the verified backlog.
- public: no contract (no code) - static assets (`favicon.ico`,
  `placeholder.svg`, `robots.txt`).

## Global Invariants

- **The database is the boundary.** UI gating is a convenience. RLS policies,
  column grants and `SECURITY DEFINER` triggers enforce the rules (`supabase/EGM.md`).
  An RLS-filtered write returns no error and zero rows, so writes that depend
  on a policy must check rows affected. Several current call sites do not;
  `src/components/EGM.md` and `src/pages/EGM.md` list which.
- **One role per account.** `profiles.role_type` changes only through
  `service_role`, enforced by trigger `profiles_prevent_privilege_escalation`.
  In practice the only path is `admin-actions` (`approve_venue_claim`,
  `approve_talent`, `reject_talent`, and the revoke demotion).
- **Admin authority is server-side.** The `/ceo` route check
  (`src/App.tsx:CEORoute`) is UI-only. `admin-actions` authorises on
  `ADMIN_USER_ID`, and `is_admin()` in SQL reads the JWT email claim.
- **Venue ownership changes only through NULL.** Trigger
  `venues_prevent_owner_change` refuses owner-to-owner writes for every caller.
- **The client is typed against generated types.**
  `src/integrations/supabase/types.ts` must be regenerated whenever a migration
  changes a table, view or RPC. It describes the schema, not RLS or grants:
  `venues` must be read by named columns, because `select("*")` compiles but
  fails with `42501`.
- **Migrations are applied by the hosting platform on sync**, so each must be
  safe to run twice, and an unrun migration must never be committed
  (`CLAUDE.md`, "Migrations").

## Global Side Effects

- Supabase Postgres: reads and writes from the browser as the signed-in user,
  and from `admin-actions` and `stripe-webhook` as service role.
- Supabase Storage: the `media` bucket (hero reels) and the `profile-media`
  bucket (posts, portfolio).
- Supabase Realtime: subscriptions to `messages`, `notifications`, `tickets`
  and `venue_staff` changes.
- Supabase Auth: password sign-in and sign-up, session listeners.
- Stripe: Checkout Session creation and webhook verification (dormant; ticket
  purchasing is withheld from the shipped UI).
- Browser `localStorage`: `userMode` and `activeVenueId`.

## System Verification

- Run: `npm run typecheck`
- Run: `npm run build`
- Run: `npm run lint`
- Edge functions (outside `tsc`): `npx --yes deno check --node-modules-dir=none supabase/functions/<name>/index.ts`
