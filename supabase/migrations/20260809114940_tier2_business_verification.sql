-- Build order item 6: Tier 2 business verification, per-venue.
--
-- Before this, Tier 2 was undefinable in query terms: no flag, the four
-- business columns on venue_claims were nullable and NULL on every live row,
-- and nothing in src/ or supabase/functions/ read or wrote them. So there was
-- nothing to enforce against. This adds the state first, then the enforcement.
--
-- WHY A TRIGGER FOR venues AND NOT A POLICY PREDICATE:
-- RLS is row-level. One UPDATE policy on venues governs every column at once,
-- so gating that policy on business_verified would also block
-- venues.hero_reel_url, which InteractiveHeroReel.tsx writes from the client
-- and which Tier 1 explicitly grants ("presence, profile, hero reel,
-- posting"). Column granularity requires a trigger. This is the third use of
-- a pattern already proven here twice: prevent_profile_privilege_escalation
-- guards columns on profiles, prevent_venue_owner_change guards owner_id.
-- venue_staff and payout_history have no such conflict, everything their
-- manager policies guard is Tier 2 by definition, so those are gated in the
-- policy directly.
--
-- BLAST RADIUS AT TIME OF WRITING: 17 venues, 16 active, but only 1 has an
-- owner at all and 0 are both active and owned. No existing manager loses a
-- toggle they are currently using. This gets materially more disruptive once
-- venue onboarding scales, which is the argument for doing it now.
--
-- WARNING for future migrations: venues_require_business_verified blocks
-- is_active/active_at/entry_price/vip_price/business_verified changes unless
-- auth.role() = 'service_role'. Per the documented blocker, auth.role()
-- returns NULL over a direct migration connection, never 'service_role', so
-- ANY future migration touching those columns must wrap itself in
-- ALTER TABLE public.venues DISABLE TRIGGER venues_require_business_verified;
-- ... ENABLE TRIGGER ... in the same file. Same rule already in force for
-- profiles_prevent_privilege_escalation.

-- ---------------------------------------------------------------------------
-- 1. State: the flag, and the application table
-- ---------------------------------------------------------------------------

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS business_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.venue_business_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  business_email text NOT NULL,
  business_phone text NOT NULL,
  position_title text NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- At most one open application per VENUE (not per user): verification is
-- per-venue, and a venue can change hands. Approved/rejected history stays
-- unconstrained so a rejected venue can re-apply, same reasoning as
-- talent_applications and deliberately unlike venue_claims' broken
-- UNIQUE (venue_id, status).
CREATE UNIQUE INDEX IF NOT EXISTS venue_business_applications_one_pending_per_venue
ON public.venue_business_applications (venue_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS venue_business_applications_status_created_idx
ON public.venue_business_applications (status, created_at DESC);

ALTER TABLE public.venue_business_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Applicants read own business applications" ON public.venue_business_applications;
CREATE POLICY "Applicants read own business applications"
ON public.venue_business_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- Self-scoped and pinned to 'pending', mirroring talent_applications, PLUS a
-- venue-ownership requirement. Flagged as a deliberate addition beyond the
-- talent_applications shape: verification is per-venue, and by the time Tier 2
-- is applied for, Tier 1 approval has already set venues.owner_id, so this
-- never blocks the legitimate flow. Without it any authenticated user could
-- file business applications against venues they have nothing to do with.
DROP POLICY IF EXISTS "Owners create own pending business applications" ON public.venue_business_applications;
CREATE POLICY "Owners create own pending business applications"
ON public.venue_business_applications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND venue_id IN (SELECT id FROM public.venues WHERE owner_id = auth.uid())
);

-- No UPDATE or DELETE policy, deliberately. Status transitions run only
-- through admin-actions on the service role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- 2. venues: add the missing WITH CHECK, and gate Tier 2 columns by trigger
-- ---------------------------------------------------------------------------

-- The existing policy had USING but no WITH CHECK, so a caller passing the
-- check could rewrite the row to any value. Also tightened TO public ->
-- TO authenticated (behaviourally equivalent, auth.uid() is NULL for anon).
DROP POLICY IF EXISTS "Managers can update their own venue" ON public.venues;
CREATE POLICY "Managers can update their own venue"
ON public.venues
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.venues_require_business_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- business_verified is never client-writable. Without this an owner could
  -- simply set it true themselves through the UPDATE policy above and grant
  -- themselves every Tier 2 operation.
  IF NEW.business_verified IS DISTINCT FROM OLD.business_verified THEN
    RAISE EXCEPTION 'Not authorized to change business_verified';
  END IF;

  -- Verified venues proceed unrestricted. hero_reel_url and other Tier 1
  -- columns are never checked here, verified or not.
  IF OLD.business_verified THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Business verification required to change is_active';
  END IF;
  IF NEW.active_at IS DISTINCT FROM OLD.active_at THEN
    RAISE EXCEPTION 'Business verification required to change active_at';
  END IF;
  IF NEW.entry_price IS DISTINCT FROM OLD.entry_price THEN
    RAISE EXCEPTION 'Business verification required to change entry_price';
  END IF;
  IF NEW.vip_price IS DISTINCT FROM OLD.vip_price THEN
    RAISE EXCEPTION 'Business verification required to change vip_price';
  END IF;

  RETURN NEW;
END;
$$;

-- Fires alongside the existing venues_prevent_owner_change; both are
-- BEFORE UPDATE, both RETURN NEW, order between them does not matter.
DROP TRIGGER IF EXISTS venues_require_business_verified ON public.venues;
CREATE TRIGGER venues_require_business_verified
BEFORE UPDATE ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.venues_require_business_verified();

-- ---------------------------------------------------------------------------
-- 3. venue_staff: one gated manager UPDATE policy, duplicate dropped
-- ---------------------------------------------------------------------------

-- There were two permissive manager UPDATE policies expressing the same rule
-- two different ways, and permissive policies OR together, so gating one
-- would have been theatre while the other stayed open. "Managers update venue
-- staff" also had no WITH CHECK at all, letting a manager reassign venue_id
-- to a venue they do not own. Both dropped, replaced by one gated policy.
-- The two talent-self UPDATE policies are deliberately left alone: a talent
-- accepting a venue invite is not a Tier 2 operation.
DROP POLICY IF EXISTS "Managers update venue staff" ON public.venue_staff;
DROP POLICY IF EXISTS "Managers can update staff for their owned venues" ON public.venue_staff;
CREATE POLICY "Managers can update staff for their owned venues"
ON public.venue_staff
FOR UPDATE
TO authenticated
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_id = auth.uid() AND business_verified)
)
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_id = auth.uid() AND business_verified)
);

-- ---------------------------------------------------------------------------
-- 4. payout_history: INSERT policy, none existed
-- ---------------------------------------------------------------------------

-- RLS was on with only a SELECT policy, so PayoutsPanel's insert was denied by
-- default and failing silently (the code never checks the returned error).
-- This makes the write possible for the first time, and gates it on Tier 2.
DROP POLICY IF EXISTS "Managers insert payouts for verified venues" ON public.payout_history;
CREATE POLICY "Managers insert payouts for verified venues"
ON public.payout_history
FOR INSERT
TO authenticated
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_id = auth.uid() AND business_verified)
);
