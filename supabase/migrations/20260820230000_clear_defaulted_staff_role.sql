-- Clear the staff_role that the dropped default assigned.
--
-- venue_staff.staff_role carried DEFAULT 'promoter' until Build 1 dropped it.
-- Nothing in the app wrote the column at the time, so rows created before that
-- hold 'promoter' because Postgres put it there, not because anyone chose it.
-- Build 1 dropped the default but left those rows alone, so the displays are
-- faithfully showing a meaningless value.
--
-- Scoped by date rather than by value: a row legitimately set to 'promoter'
-- through the Build 2 request flow must not be wiped. The picker did not exist
-- before 2026-08-17, so anything older with 'promoter' is the default.
--
-- Null renders safely everywhere. positionLabel returns null, and each surface
-- already has a fallback: "Requesting Entry"/"Verified Connection" in the
-- approval panel, "Linked" on the talent dashboard, "Confirmed" on the venue
-- page.
UPDATE public.venue_staff
   SET staff_role = NULL
 WHERE staff_role = 'promoter'
   AND created_at < '2026-08-17';
