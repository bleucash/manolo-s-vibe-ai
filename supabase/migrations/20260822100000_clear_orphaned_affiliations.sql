-- Remove affiliations at venues with no owner.
--
-- One row exists: talent affiliated 'active' at Tangra since 2026-02-21,
-- while Tangra has never been claimed. Nobody can approve, remove or invite
-- there without an owner, so the row could not be managed from either side of
-- the app. Worse, an 'active' affiliation still satisfies
-- profiles_enforce_check_in, so that talent could keep tapping in at a venue
-- no one controls.
--
-- Deleted rather than downgraded, unlike the revoke path in admin-actions.
-- This row predates the request flow entirely: there is no owner who approved
-- it and none who ever will until the venue is claimed fresh, so there is no
-- relationship worth preserving as a pending request. The talent's state is
-- cleared and Tangra is claimable with nothing attached.
--
-- Not urgent when found: Build 3's DELETE policy is auth.uid() = user_id with
-- no status restriction, and TalentDashboard renders Leave on every
-- affiliation, so the talent could already have walked out unilaterally.
--
-- Recurrence is handled separately: revoke_venue_claim now downgrades active
-- affiliations to pending instead of stranding them, and the venue page no
-- longer offers a work request at an unowned venue.
DELETE FROM public.venue_staff vs
 USING public.venues v
 WHERE v.id = vs.venue_id
   AND v.owner_id IS NULL;
