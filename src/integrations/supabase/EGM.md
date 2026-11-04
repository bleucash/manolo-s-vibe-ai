# src/integrations/supabase

## Overview

The single Supabase client for the browser app (`client.ts`) and the generated
`Database` type it is parameterised with (`types.ts`, about 1,300 lines,
produced by `supabase gen types`). Every table, view and RPC call in `src` goes
through this typed client.

## Interface

`client.ts`

- `supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)`, reading
  `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`.
  [client.ts:supabase]

`types.ts` (generated; do not hand-edit)

- Exported symbols: `Json`, `Database`, `Tables`, `TablesInsert`,
  `TablesUpdate`, `Enums`, `CompositeTypes`, and the runtime `Constants`.
  [types.ts:Database] [types.ts:Constants]
- `Database.__InternalSupabase.PostgrestVersion = "14.1"`. [types.ts:Database]
- `public.Tables` (20): `conversation_participants`, `conversations`, `events`,
  `followers`, `interactions`, `messages`, `notifications`, `payout_history`,
  `payout_requests`, `portfolio_items`, `post_likes`, `posts`, `profiles`,
  `talent_applications`, `tickets`, `venue_business_applications`,
  `venue_claims`, `venue_followers`, `venue_staff`, `venues`. Each has `Row`,
  `Insert`, `Update` and `Relationships`. [types.ts:Database.public.Tables]
- `public.Views`: `conversation_summary` (`avatar_url`, `conversation_id`,
  `display_name`, `kind`, `last_message_at`, `last_message_content`,
  `last_sender_id`, `member_avatars`, `participant_id`, `participant_state`,
  `thread_title`, `unread_count`, `updated_at`, `venue_id`).
  [types.ts:Database.public.Views]
- `public.Functions` (19): `add_group_member`, `check_in_guest`,
  `cleanup_expired_posts`, `create_group_conversation`,
  `generate_verification_code`, `get_talent_spotlight`, `get_unpaid_commissions`,
  `has_role`, `has_role_type`, `is_accepted_conversation_participant`,
  `is_addable_group_member`, `is_admin`, `is_conversation_participant`,
  `mark_conversation_read`, `remove_group_member`, `show_limit`, `show_trgm`,
  `start_conversation`, `sync_venue_conversation`.
  [types.ts:Database.public.Functions]
- `public.Enums.app_role`: `manager`, `staff`, `user`, `venue_manager`,
  `talent`, `guest` (also in `Constants.public.Enums.app_role`).
  [types.ts:Database.public.Enums] [types.ts:Constants]
- `graphql_public` schema with the single function `graphql`.
  [types.ts:Database.graphql_public]

## Invariants

- The client is typed: a table, column, view or RPC absent from `types.ts` is a
  compile error. [client.ts:supabase]
- `types.ts` is only as current as its last regeneration. A migration that
  changes a table, view (notably `conversation_summary`) or RPC must regenerate
  `types.ts` in the same action; stale types confirm the old shape with full
  confidence. [CLAUDE.md:Migrations] [types.ts:Database]
- Generated types describe schema only, not RLS or column grants. They list
  every `venues` column, but `anon` and `authenticated` may read only granted
  columns, so `select("*")` or a read of an ungranted column on `venues`
  compiles and fails at runtime with `42501`.
  [types.ts:Database.public.Tables.venues] [CLAUDE.md:Hard operating rules]
- Every view column is typed nullable regardless of the SQL expression;
  consumers narrow at one boundary (see `src/hooks/useChat.ts`
  `ConversationSummary`). [types.ts:Database.public.Views]
- `app_role` keeps three legacy values (`staff`, `user`, `venue_manager`) that
  the app does not treat as roles; only `guest`, `talent`, `manager` are
  authoritative. [types.ts:Constants] [CLAUDE.md:Role model]

## Side Effects

- `client.ts`, at module load: if either env var is missing, logs a
  `console.error` and throws `"Missing Supabase configuration..."`, so any
  importer fails to load. Otherwise it constructs the client; network and auth
  traffic happen only when callers use it. [client.ts:supabase]
- `types.ts`: None. Types plus one `as const` object.

## Verification

- Run: `npm run typecheck` (`tsc --build`), then `npm run build` (`vite build`).
  `package.json` defines no `test` script.
