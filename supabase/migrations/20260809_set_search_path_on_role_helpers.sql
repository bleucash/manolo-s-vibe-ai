-- has_role() and has_role_type() are both SECURITY DEFINER but neither sets
-- search_path (confirmed live 2026-08-09: pg_proc.proconfig is NULL on both,
-- prosecdef is true on both). handle_new_user and
-- prevent_profile_privilege_escalation both already set it; these two were
-- the outliers.
--
-- Why it matters, and it is not equal across the two:
--   has_role_type(uuid, text) selects `from profiles`, UNQUALIFIED. With no
--   search_path pinned, a SECURITY DEFINER function resolves that name using
--   the CALLER's search_path, so anything able to put its own `profiles`
--   table in an earlier schema gets read instead of public.profiles. This is
--   the function that gates `posts` INSERT via RLS, so it is the live surface.
--   has_role(uuid, app_role) selects `from public.profiles`, qualified, so it
--   is not exposed the same way, but it still resolves the `=` operator and
--   the app_role cast through the caller's path. Pinned for the same reason.
--
-- Neither function has a CREATE FUNCTION anywhere in this migrations folder:
-- both were created directly against the live DB, the same drift pattern
-- already logged for prevent_profile_privilege_escalation. Their live bodies
-- were pulled with pg_get_functiondef before writing this, not reconstructed.
--
-- ALTER FUNCTION ... SET is deliberately used instead of CREATE OR REPLACE.
-- It attaches the setting without restating the body, so there is no chance
-- of a transcription error silently changing behaviour on a function that RLS
-- depends on. Nothing else about either function is touched.

ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;

ALTER FUNCTION public.has_role_type(uuid, text) SET search_path = public;
