-- A7: venue_claims keeps history; one pending and one approved claim per venue.
--
-- unique_venue_claim UNIQUE (venue_id, status) allowed one row per venue per
-- status, so a venue could never hold two rejected claims (a second squatter
-- could not be rejected: 23505) and revoke had to DELETE the approved claim to
-- keep the venue claimable. Owner decision (option B):
--   * one pending claim per venue, first come;
--   * at most one approved claim per venue;
--   * rejected and revoked history unlimited;
--   * status NOT NULL, limited to pending, approved, rejected, revoked.
-- Revoke now marks the claim 'revoked' (admin-actions, same change set).
--
-- Statement order matters: status is constrained first, so the partial
-- indexes are built over a column that can no longer hold NULL or an unknown
-- value. The old constraint is dropped only after the data has been checked.
--
-- Safe to re-apply (A16): the guard is read-only, SET NOT NULL is a no-op when
-- already set, the CHECK is dropped and re-added under one name, the old
-- constraint and index are dropped IF EXISTS, the new indexes are created IF
-- NOT EXISTS, and the post-check is read-only. No earlier migration creates
-- unique_venue_claim, so an in-order replay cannot bring it back before this.
-- NOT NULL changes the generated Row type: types.ts is regenerated in the
-- same commit as this file.

-- 1. Guard: refuse to run against data the new rules would reject.
DO $guard$
DECLARE
  v_bad_status int;
  v_dup_pending int;
  v_dup_approved int;
BEGIN
  SELECT count(*) INTO v_bad_status FROM public.venue_claims
   WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected', 'revoked');
  SELECT count(*) INTO v_dup_pending FROM (SELECT venue_id FROM public.venue_claims
   WHERE status = 'pending' GROUP BY venue_id HAVING count(*) > 1) d;
  SELECT count(*) INTO v_dup_approved FROM (SELECT venue_id FROM public.venue_claims
   WHERE status = 'approved' GROUP BY venue_id HAVING count(*) > 1) d;
  IF v_bad_status > 0 OR v_dup_pending > 0 OR v_dup_approved > 0 THEN
    RAISE EXCEPTION 'A7: data violates the new rules (bad status %, venues with >1 pending %, venues with >1 approved %)',
      v_bad_status, v_dup_pending, v_dup_approved;
  END IF;
END
$guard$;
-- ----
-- 2. status: NOT NULL, and only the four known values.
ALTER TABLE public.venue_claims ALTER COLUMN status SET NOT NULL;
-- ----
ALTER TABLE public.venue_claims DROP CONSTRAINT IF EXISTS venue_claims_status_allowed;
-- ----
ALTER TABLE public.venue_claims ADD CONSTRAINT venue_claims_status_allowed
  CHECK (status IN ('pending', 'approved', 'rejected', 'revoked'));
-- ----
-- 3. Replace the per-(venue, status) constraint with two partial indexes.
ALTER TABLE public.venue_claims DROP CONSTRAINT IF EXISTS unique_venue_claim;
-- ----
DROP INDEX IF EXISTS public.unique_venue_claim;
-- ----
CREATE UNIQUE INDEX IF NOT EXISTS venue_claims_one_pending_per_venue
  ON public.venue_claims (venue_id) WHERE status = 'pending';
-- ----
CREATE UNIQUE INDEX IF NOT EXISTS venue_claims_one_approved_per_venue
  ON public.venue_claims (venue_id) WHERE status = 'approved';
-- ----
-- 4. Post-check: fail the migration unless the end state is exactly this.
DO $post$
DECLARE
  v_notnull  boolean;
  v_check    text;
  v_pending  text;
  v_approved text;
  v_uniques  int;
BEGIN
  SELECT attnotnull INTO v_notnull FROM pg_attribute
   WHERE attrelid = 'public.venue_claims'::regclass AND attname = 'status';
  SELECT pg_get_constraintdef(oid) INTO v_check FROM pg_constraint
   WHERE conrelid = 'public.venue_claims'::regclass AND conname = 'venue_claims_status_allowed';
  SELECT pg_get_indexdef(indexrelid) INTO v_pending FROM pg_index
   WHERE indexrelid = to_regclass('public.venue_claims_one_pending_per_venue');
  SELECT pg_get_indexdef(indexrelid) INTO v_approved FROM pg_index
   WHERE indexrelid = to_regclass('public.venue_claims_one_approved_per_venue');
  SELECT count(*) INTO v_uniques FROM pg_index
   WHERE indrelid = 'public.venue_claims'::regclass AND indisunique AND NOT indisprimary;

  IF v_notnull IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A7: venue_claims.status is still nullable';
  END IF;
  IF v_check IS NULL OR v_check NOT LIKE '%pending%approved%rejected%revoked%' THEN
    RAISE EXCEPTION 'A7: status CHECK missing or wrong: %', v_check;
  END IF;
  IF v_pending IS NULL OR v_pending NOT LIKE '%(venue_id) WHERE (status = ''pending''::text)' THEN
    RAISE EXCEPTION 'A7: pending index missing or wrong: %', v_pending;
  END IF;
  IF v_approved IS NULL OR v_approved NOT LIKE '%(venue_id) WHERE (status = ''approved''::text)' THEN
    RAISE EXCEPTION 'A7: approved index missing or wrong: %', v_approved;
  END IF;
  IF to_regclass('public.unique_venue_claim') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.venue_claims'::regclass AND conname = 'unique_venue_claim') THEN
    RAISE EXCEPTION 'A7: unique_venue_claim still present';
  END IF;
  IF v_uniques <> 2 THEN
    RAISE EXCEPTION 'A7: expected exactly 2 non-primary unique indexes on venue_claims, found %', v_uniques;
  END IF;
END
$post$;
