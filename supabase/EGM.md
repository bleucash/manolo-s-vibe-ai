# supabase

## Overview

Server side of the app. Contains no source files of its own, only `config.toml`
plus two code directories: the Deno edge functions, and the SQL migrations
that define RLS policies, triggers, RPCs and the occasional schema change.
The table schema itself lives in the live database, not in these migrations;
the generated type of the whole schema is `src/integrations/supabase/types.ts`
(see [`../src/integrations/supabase/EGM.md`](../src/integrations/supabase/EGM.md)).

`supabase/migrations/` holds no contract file of its own, by decision: the
hosting platform applies whatever sits in that folder on sync, so it is
described here instead.

## Subdirectories & Boundaries

- functions: [`./functions/EGM.md`](./functions/EGM.md) - Deno edge functions.
  `admin-actions` is the server-side authority for every admin review decision
  (it checks the caller against `ADMIN_USER_ID`, then writes as service role,
  bypassing RLS). `create-checkout-session` and `stripe-webhook` are the
  dormant ticketing pair, coupled only through Stripe session metadata.
- migrations: no contract file (see Overview) - 51 SQL files,
  `20260104162336_…` through `20261021120000_a7_venue_claims_one_pending_per_venue.sql`.
  Summarised below.

### `config.toml`

- `[config.toml:project_id]` names the linked project (a project ref, not a secret).
- `[config.toml:functions.create-checkout-session]`,
  `[config.toml:functions.stripe-webhook]` and `[config.toml:functions.mcp]`
  each set `verify_jwt = false`, so any auth for them happens inside the
  function. `admin-actions` has no entry here.
- `functions.mcp` has no `supabase/functions/mcp/` directory (backlog A48).

### `migrations/`: what the SQL defines (latest state of each object)

Grouped by area. Each entry names the migration file that last creates or
replaces the object.

- **Roles and identity.**
  - `has_role(uuid, app_role)` and `has_role_type(uuid, text)`:
    `[20260808233255_set_search_path_on_role_helpers.sql]` only pins their
    `search_path`. No migration creates them; their bodies exist only in the
    live database.
  - `prevent_profile_privilege_escalation()`, run by trigger
    `profiles_prevent_privilege_escalation`: blocks any `role_type` change
    except by `service_role` `[20260817143603_sub_role_self_editable.sql]`.
  - `handle_new_user()`, run by trigger `on_auth_user_created` on `auth.users`:
    inserts `profiles (id, role_type 'guest')` `ON CONFLICT DO NOTHING`
    `[20260806175111_handle_new_user_trigger.sql]`.
  - `is_admin()` compares the JWT email claim with one hardcoded address
    `[20260804232027_venue_claims_rls.sql]`.
  - `profiles` UPDATE for `authenticated` is limited to eight named columns
    `[20260909120000_profiles_column_grants.sql]`.
  - `profiles.sort_name` is a stored generated column, with partial index
    `idx_profiles_talent_directory` `[20260905120000_profiles_sort_name.sql]`.
  - The `profiles_sub_role_allowed` and `venue_staff_staff_role_allowed` CHECKs
    list the nine positions `[20260817083313_position_check_constraints.sql]`.
- **Venues.**
  - `prevent_venue_owner_change()`, run by trigger `venues_prevent_owner_change`,
    refuses an owner-to-different-owner write for every caller, `service_role`
    included. For callers other than `service_role` it also refuses owner to
    NULL. It does **not** refuse NULL to an owner, for any caller: the code
    comment allows it as the "initial claim (NULL -> self) via existing RLS
    policy" `[20261019120000_a46_venue_owner_change_through_null.sql]`. What
    stops an ordinary user from claiming an unowned venue is the UPDATE policy
    "Managers can update their own venue" (`USING (auth.uid() = owner_id)`),
    not this trigger; a direct connection is stopped by neither. The original
    `[20260615001921_…]` version let `service_role` through unconditionally.
  - `venues_require_business_verified()`: only `service_role` may change
    `business_verified`, and only it may change `is_active`, `active_at`,
    `entry_price` or `vip_price` on an unverified venue
    `[20260809114940_tier2_business_verification.sql]`.
  - SELECT is a single policy, "Venues are readable by everyone"
    (`USING (true)`, `TO public`) `[20260922120000_a8_venues_public_read.sql]`.
    UPDATE is "Managers can update their own venue" (owner only).
  - `anon` and `authenticated` hold SELECT on 21 named columns only. The seven
    commercial columns are not granted `[20261014120000_a31_venues_column_grants.sql]`.
- **Business verification (Tier 2).**
  - Table `venue_business_applications`, with unique index
    `venue_business_applications_one_pending_per_venue` and policies
    "Applicants read own business applications" and "Owners create own pending
    business applications" `[20260809114940_tier2_business_verification.sql]`.
  - Policy "Managers insert payouts for verified venues" on `payout_history`:
    INSERT only at an owned, business-verified venue (same file).
- **Venue claims.**
  - `status` is NOT NULL, CHECK `venue_claims_status_allowed`
    (`pending`, `approved`, `rejected`, `revoked`).
  - Partial unique indexes `venue_claims_one_pending_per_venue` and
    `venue_claims_one_approved_per_venue` allow one pending and one approved
    claim per venue, with rejected and revoked history unlimited
    `[20261021120000_a7_venue_claims_one_pending_per_venue.sql]`.
  - INSERT policy "Claimants create own pending claims": own `user_id`,
    `status = 'pending'`, and not talent
    `[20261014140000_a33_venue_claims_reject_talent.sql]`.
  - SELECT policy "Claimants read own claims": own rows, or `is_admin()`.
    There is no UPDATE or DELETE policy; admin writes go through `admin-actions`.
  - Columns: `instagram_handle` was added, and `legal_name` and
    `business_email` were made nullable
    `[20260802212814_add_instagram_handle_relax_tier2_fields.sql]`.
- **Talent and staff.**
  - `talent_applications` allows one pending application per user, with a
    DB-generated `verification_code` `[20260806183927_…]` `[20260812224048_…]`.
  - `venue_staff` status CHECK `venue_staff_status_allowed`
    (`pending`, `pending_talent_action`, `active`, `ignored`). Talent may request
    work (insert `pending`) and respond to an invite (`pending_talent_action` to
    `active` or `ignored`) `[20260817190000_venue_staff_request_policies.sql]`.
  - Managers may invite talent only at an owned, business-verified venue
    `[20260821100000_manager_invite_policy.sql]`. Manager UPDATE and DELETE of
    staff require an owned, business-verified venue `[20260809114940_…]`
    `[20260811112457_…]`.
  - Talent may delete their own link at any status `[20260818090000_…]`.
  - Check-in: `enforce_check_in_requires_active_staff()` (trigger
    `profiles_enforce_check_in`) requires an active affiliation to set
    `current_venue_id`. `clear_check_in_on_staff_change()` (trigger
    `venue_staff_clear_check_in`) clears the check-in when an affiliation
    leaves `active` `[20260818090000_check_in_constraint_and_talent_exits.sql]`.
- **Messaging.**
  - `conversation_participants.state` (`accepted`, `pending`, `declined`).
    Policy "Participants can respond to their own request" allows a move only
    out of `pending`, and only on your own row
    `[20260831100000_conversation_participant_state.sql]`.
  - Membership helpers: `is_conversation_participant()` guards reads;
    `is_accepted_conversation_participant()` guards message INSERT.
  - `start_conversation(target_user_id)` takes an advisory lock and returns an
    existing two-person thread first. For a new thread, the recipient is
    `pending` unless the sender is talent or manager, or the recipient follows
    them `[20260831100100_start_conversation_request_queue.sql]`.
  - Read cursor: `mark_conversation_read()` moves `last_read_at` forward only
    `[20260901100000_read_cursor.sql]`. `messages.is_read` was dropped
    `[20260902120000_drop_messages_is_read.sql]`.
  - `conversations.kind` (`dm`, `venue`, `group`), with one venue thread per
    venue (`uniq_conversation_per_venue`). View `conversation_summary`
    (`security_invoker`, scoped to `auth.uid()`) exposes `thread_title`,
    `kind` and `unread_count` `[20260901120000_conversation_kind.sql]`.
  - Groups: `create_group_conversation`, `add_group_member` and
    `remove_group_member`, with a cap of 50 participants and members limited
    to active staff at the creator's venues `[20260901140000_group_conversations.sql]`.
  - The venue thread reconciler `sync_venue_conversation()` is run by triggers
    `venue_staff_sync_conversation` and `venues_sync_conversation`
    `[20260901160000_venue_thread_reconciler.sql]`.
- **Posts, likes and heat.**
  - Only talent and managers may post `[20260805000142_posts_insert_talent_manager_only.sql]`.
  - `post_likes` soft-deletes through `is_active`, with no DELETE policy.
    Policy "Users can update their own likes" is the UPDATE path the
    soft delete and the client's upsert depend on
    `[20260811202026_post_likes_soft_delete.sql]`.
  - Policy "Venue managers can view venue followers" on `venue_followers`
    `[20260809171733_fix_venue_followers_manager_policy.sql]`.
  - `apply_talent_charge()` (trigger `post_likes_apply_talent_charge`,
    AFTER INSERT) maintains `profiles.heat_score` with a 3-hour half-life
    `[20260811205216_talent_heat_score.sql]`.
  - `interactions` is UNIQUE on (user, target, target type, interaction type)
    `[20260811205552_interactions_dedupe_and_unique.sql]`.
  - `get_talent_spotlight(limit_count)`: the committed file counts `post_likes`
    `[20260331170246_create_talent_spotlight_rpc.sql]`. The live body is
    documented as different (CLAUDE.md, "Charge / Heat / Spotlight"), so read
    the live definition, not this file.
- **Tickets.**
  - Policy `Manolo_AI_Owner_Access` covers tickets at owned venues `[20260104162336_…]`.
  - `check_in_guest(qr_input, current_venue_id)` and
    `get_unpaid_commissions(venue_id_input)` raise `42501` unless the caller
    owns the venue `[20260910120000_a15_owner_checks.sql]`.

### Invariants that cross the migrations

- Every migration must be safe to apply twice: the platform applies the folder
  on sync. Most files use `IF EXISTS` and `IF NOT EXISTS` guards, and later
  ones add pre- and post-checks in `DO` blocks. Three applied statements have
  no guard and would fail if re-run:
  - `CREATE POLICY "Talent and managers can post"`, with no matching
    `DROP POLICY IF EXISTS` `[20260805000142_posts_insert_talent_manager_only.sql]`;
  - `ADD CONSTRAINT interactions_unique_user_target_type`, with no prior drop
    `[20260811205552_interactions_dedupe_and_unique.sql]`;
  - `ADD COLUMN instagram_handle text`, without `IF NOT EXISTS`
    `[20260802212814_add_instagram_handle_relax_tier2_fields.sql]`.
- Writes to trigger-guarded columns from a direct connection trip the guards,
  because `auth.role()` is NULL there. Migrations that write them disable the
  trigger in the same file, for example
  `[20260802203411_remap_venue_manager_role.sql]`.

### Data-changing migrations

- `[20260802203411_…]`: remaps `venue_manager` roles to `manager`.
- `[20260811205552_…]`: deletes duplicate `interactions`.
- `[20260820230000_clear_defaulted_staff_role.sql]`: clears defaulted
  `promoter` staff roles.
- `[20260822100000_clear_orphaned_affiliations.sql]`: deletes `venue_staff`
  rows at ownerless venues.
- `[20260831100000_…]`, `[20260901100000_…]`, `[20260901120000_…]`: backfill
  participant `state`, `last_read_at` and conversation `kind`.
- `[20260901160000_…]`: reconciles every venue's thread.
- `[20260902120000_drop_messages_is_read.sql]`: drops the column
  `messages.is_read` and its data.
- `[20260907120000_drop_dead_update_user_profile.sql]`: drops both overloads of
  the RPC `update_user_profile`.
- `[20260913120000_a25_drop_diag.sql]`: drops `public._diag`.
- Grant and revoke changes: `[20260830140000_…]`, `[20260831100000_…]`,
  `[20260901100000_…]`, `[20260901120000_…]`, `[20260909120000_…]`,
  `[20260910120000_…]`, `[20260920120000_a1_phase1_venue_read_policies.sql]`
  (EXECUTE on `is_active_venue_staff(uuid)` revoked from `PUBLIC` and `anon`,
  granted to `authenticated` and `service_role`), `[20261014120000_…]`.

## Verification

- Edge functions: `npx --yes deno check --node-modules-dir=none supabase/functions/<name>/index.ts`
  (see each function's contract).
- Migrations: there is no automated check in the repo. A migration's own
  post-check `DO` block fails it on apply.
- Client-side typing of the schema: `npm run typecheck`.
