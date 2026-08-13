-- Closes the systemic gap logged in CLAUDE.md: there is no trigger on
-- auth.users and nothing anywhere inserts into profiles, so every signup
-- since launch has landed profile-less (live counts were 5 auth.users vs 4
-- profiles before the CEO row was patched in by hand). Every role-based
-- code path treats a profile-less user as a guest with no row to read.
--
-- WHAT IS ACTUALLY AVAILABLE AT SIGNUP (verified, not assumed):
-- Auth.tsx calls supabase.auth.signUp({ email, password }) with no
-- options.data, so raw_user_meta_data on real rows contains only
-- {sub, email, email_verified, phone_verified}. No username, no name,
-- nothing else. The only human-meaningful field is the email itself.
--
-- WHY THIS INSERTS ONLY id, DELIBERATELY:
--   1. profiles has `profiles_username_key UNIQUE (username)`. Deriving a
--      username from the email local-part would collide for e.g.
--      info@a.com and info@b.com. A unique violation inside an AFTER
--      INSERT trigger on auth.users aborts the whole transaction, which
--      would BLOCK SIGNUP ENTIRELY. Not worth it for a cosmetic default.
--   2. profiles SELECT is `USING (true)`, world-readable. Deriving username
--      or display_name from an email would publish part of every user's
--      email address to anyone who reads the table.
-- role_type is left to its column default ('guest'), stated explicitly here
-- only for readability. Everything else stays NULL for the app to fill in.
-- If richer defaults are wanted later, the right fix is Auth.tsx passing
-- options.data at signup, not guessing from the email in SQL.
--
-- SECURITY DEFINER is required: the trigger fires while Supabase's auth
-- system inserts into auth.users, in a context that has no rights on
-- public.profiles, and where auth.uid() is not the new user, so the
-- existing "Users can insert own profile" policy (WITH CHECK auth.uid() = id)
-- would reject it. The function is owned by postgres, which also owns
-- profiles, and profiles is not FORCE ROW LEVEL SECURITY, so the owner
-- bypasses RLS here. Kept as narrow as possible to justify those rights:
-- one INSERT, no reads, no updates, no dynamic SQL, no other tables.
-- SET search_path = public prevents search_path hijacking (the existing
-- has_role_type / has_role helpers omit this; separate pre-existing smell).
--
-- ON CONFLICT (id) DO NOTHING makes it idempotent. Without it, a signup for
-- a user whose profiles row somehow already exists (hand-patched rows like
-- the CEO's, a replayed insert) would raise a PK violation and block that
-- signup. Deliberately NOT wrapping the body in an exception handler that
-- swallows errors: silently continuing is exactly how the profile-less
-- users accumulated unnoticed in the first place. If this ever fails, it
-- should fail loudly at signup rather than quietly recreate the same gap.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role_type)
  VALUES (NEW.id, 'guest')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
