-- 20261107090000_venue_roster_view.sql
--
-- Fix 9 part 2, step 2a: a public roster that exposes only which talent are
-- active at which venue (owner decision, J, 2026-11-06: rosters are public,
-- including to signed-out visitors; staff_role and commission_rate are not).
--
-- public.venue_roster (venue_id, user_id) lists active affiliations only.
-- It runs with its owner's rights (security_invoker = false) on purpose:
-- step 2b makes venue_staff readable only by the venue owner and the talent,
-- so the public roster has to read past that RLS, and this view is the one
-- narrow, column-limited door for it. It is the first definer-rights view in
-- this schema; the Supabase advisor will flag it ("security definer view"),
-- and that flag is accepted for this view only, for the reason above.
--
-- GRANTS ARE THE CRITICAL PART. Supabase's default privileges give anon and
-- authenticated every privilege on any new relation in public (measured
-- 2026-11-06: arwdDxtm). This view is simple enough to be automatically
-- updatable and runs as postgres, which bypasses RLS, so with the default
-- grants anyone, signed out included, could INSERT or UPDATE venue_staff
-- through it. Everything is revoked and SELECT alone is granted, and the
-- post-check fails the migration if any write privilege remains.
--
-- Rows with a NULL venue_id or user_id (nullable join keys, see CLAUDE.md)
-- are left out: they belong to no roster.
--
-- Embeds: PostgREST traces this view's columns to venue_staff's foreign keys
-- (venue_id -> venues, user_id -> profiles), which is what lets Discovery
-- embed venue_roster from venues and the pages embed profiles and venues
-- from it. Checked after applying with read-only REST calls, before any
-- code switches to it.
--
-- Changes nothing for existing readers: venue_staff is untouched here.
-- src/integrations/supabase/types.ts is regenerated in the same action
-- (CLAUDE.md: a new view reaches the client only through the types).
-- Safe to run twice.

CREATE OR REPLACE VIEW public.venue_roster
  WITH (security_invoker = false)
AS
  SELECT s.venue_id, s.user_id
  FROM public.venue_staff s
  WHERE s.status = 'active'
    AND s.venue_id IS NOT NULL
    AND s.user_id IS NOT NULL;

COMMENT ON VIEW public.venue_roster IS
  'Public roster: which talent are active at which venue, nothing else. Definer rights on purpose (venue_staff is private); SELECT-only grants are load-bearing.';

REVOKE ALL ON public.venue_roster FROM PUBLIC;
REVOKE ALL ON public.venue_roster FROM anon;
REVOKE ALL ON public.venue_roster FROM authenticated;
GRANT SELECT ON public.venue_roster TO anon, authenticated;

-- POST-CHECK
DO $post$
DECLARE
  v_cols text;
  v_bad  text;
BEGIN
  SELECT string_agg(attname, ',' ORDER BY attnum) INTO v_cols
  FROM pg_attribute WHERE attrelid = 'public.venue_roster'::regclass AND attnum > 0 AND NOT attisdropped;
  IF v_cols <> 'venue_id,user_id' THEN
    RAISE EXCEPTION 'post-check: venue_roster columns are %', v_cols;
  END IF;

  SELECT string_agg(r || ':' || p, ', ') INTO v_bad
  FROM unnest(ARRAY['anon', 'authenticated']) AS r,
       unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS p
  WHERE has_table_privilege(r, 'public.venue_roster', p);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'post-check: write privileges remain on venue_roster: %', v_bad;
  END IF;

  IF NOT has_table_privilege('anon', 'public.venue_roster', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.venue_roster', 'SELECT') THEN
    RAISE EXCEPTION 'post-check: anon or authenticated cannot read venue_roster';
  END IF;
END
$post$;
