-- Lightweight Instagram ownership check for talent applications.
--
-- Problem: an applicant types any handle they like. Nothing proves they own
-- it, so someone can enter a real performer's handle and be approved as them.
-- Fix: the DB issues a short code on insert, the applicant DMs that exact
-- code from the handle they claimed, and the reviewer looks for it before
-- approving. Owning the handle is the thing being proven, so the DM has to
-- originate from it.
--
-- DB-side default, deliberately, not client-generated: the code must be
-- stable if the applicant closes and reopens the modal, and a client-side
-- value would be trivially swappable by whoever is being verified.
--
-- 6 chars, uppercase alphanumeric minus look-alikes. This gets read off one
-- screen and typed into another by a human, so 0/O and 1/I/L are removed
-- rather than trusted. 32^6 is ~1.07 billion, which is far past sufficient:
-- the code only needs to be unguessable within one manually reviewed queue,
-- not to be a secret at rest.
--
-- Review aid only. approve_talent is unchanged and this adds no automated
-- gate, no required checkbox, no verified-status column. A reviewer can still
-- approve or reject exactly as before.

CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1),
    ''
  )
  FROM generate_series(1, 6);
$$;

ALTER TABLE public.talent_applications
  ADD COLUMN IF NOT EXISTS verification_code text NOT NULL DEFAULT public.generate_verification_code();
