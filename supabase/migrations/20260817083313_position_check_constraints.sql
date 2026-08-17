-- Type the two position columns without introducing a Postgres enum.
--
-- text + CHECK rather than an enum, deliberately: the generated types are not
-- wired to the Supabase client (createClient is called without the Database
-- generic), so an enum would buy no TypeScript safety today, and app_role in
-- this same schema already shows the cost of enum values that turn out to be
-- wrong: staff, user and venue_manager are all dead and none can be dropped
-- without a type rewrite. This list is expected to churn. A CHECK constraint
-- is a one-line drop-and-recreate; an enum rename is a migration with
-- dependent-column rewrites.
--
-- The value list is duplicated in src/config/positions.ts, which derives the
-- TypeScript union from its own keys. Both must stay in sync; the constraints
-- are named so they are greppable from the config file's comment.
--
-- Existing data needs no mapping: profiles.sub_role is NULL in all 5 rows,
-- and both venue_staff rows hold 'promoter', which is already a valid value.
--
-- Both columns stay nullable. NULL means "not set", which is distinct from
-- any position and is the correct state for an account that has not chosen.

-- venue_staff.staff_role defaulted to 'promoter', so every staff assignment
-- silently became a guest-facing position without a manager ever choosing it.
-- Nothing in the app writes this column, so both existing rows are that
-- default rather than a decision. Dropped: NULL until a manager sets it.
ALTER TABLE public.venue_staff
  ALTER COLUMN staff_role DROP DEFAULT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sub_role_allowed;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sub_role_allowed CHECK (
    sub_role IS NULL OR sub_role IN (
      'host', 'entertainer', 'dj', 'bartender', 'bottle_girl',
      'promoter', 'media', 'security', 'event_staff'
    )
  );

ALTER TABLE public.venue_staff
  DROP CONSTRAINT IF EXISTS venue_staff_staff_role_allowed;

ALTER TABLE public.venue_staff
  ADD CONSTRAINT venue_staff_staff_role_allowed CHECK (
    staff_role IS NULL OR staff_role IN (
      'host', 'entertainer', 'dj', 'bartender', 'bottle_girl',
      'promoter', 'media', 'security', 'event_staff'
    )
  );
