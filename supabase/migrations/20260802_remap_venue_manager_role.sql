-- DECISION: descoped from a full app_role enum collapse to this single-row
-- remap. Originally planned to shrink app_role from 6 values down to 3
-- (guest, talent, manager), but that requires recreating the type, which
-- cascades into:
--   - has_role(uuid, app_role) - parameter typed directly as app_role,
--     would need to be dropped/recreated against the new type
--   - idx_profiles_active_talent - partial index whose predicate embeds a
--     literal 'talent'::app_role cast, would need to be dropped/recreated
--   - has_role_type(uuid, text) - casts internally via _role_type::app_role,
--     survives unmodified only as long as the type name doesn't change
-- Confirmed via read-only query on 2026-08-02: role_type currently holds
-- only 'talent' (3 rows) and 'venue_manager' (1 row) - zero rows for
-- 'staff' or 'user'. Recreating a type and two dependent DB objects on a
-- production database with no rollback, for a purely cosmetic cleanup of
-- an enum that isn't causing any live bug, is disproportionate to what's
-- gained. The actual bugs (phantom is_verified_* references, the
-- venue_manager/manager split in application code) are already fixed
-- separately in the app code.
--
-- So: app_role keeps all 6 values. 'staff', 'user', and 'venue_manager'
-- become dormant (no rows reference them after this migration runs) but
-- are not physically removed from the type. This is deferred, not
-- abandoned - log it in CLAUDE.md as a deferred item, revisit only if a
-- real reason to touch app_role's shape comes up on its own.
--
-- This migration only remaps the one row confirmed to hold the legacy
-- 'venue_manager' value (re-confirmed via SELECT COUNT(*) immediately
-- before this file was finalized: exactly 1 row, both on 2026-08-02) to
-- 'manager', matching how application code (UserModeContext,
-- useWorkerPermissions) already treats the two as equivalent.

-- profiles_prevent_privilege_escalation blocks any direct write to
-- role_type unless auth.role() = 'service_role'. auth.role() reads the
-- request.jwt.claim.role session setting, which only PostgREST sets per
-- request - a direct migration connection (supabase db push, psql, this
-- file) never goes through PostgREST, so that setting is never populated
-- and auth.role() returns NULL. NULL = 'service_role' is not true, so the
-- exemption never applies here: this trigger blocks every migration that
-- writes to profiles.role_type, not just this one. Disable/enable around
-- the UPDATE is the proven pattern already used for yesterday's venue
-- ownership reset; reusing it rather than inventing a new approach.
ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;

UPDATE public.profiles SET role_type = 'manager' WHERE role_type = 'venue_manager';

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;
