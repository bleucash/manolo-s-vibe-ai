-- A31 step 2: venues column grants. The seven private commercial columns stop
-- being readable by anon and authenticated; every other column stays readable.
--
-- WHY (owner decisions, 2026-09-28, recorded in A31)
-- Since A8 every venues row is public by design, so the column layer is the only
-- boundary left on this table. These seven columns are a venue's commercial
-- terms, read by no client, and are revoked from anon and authenticated:
--   commission_rate, standard_commission, subscription_tier, ticketing_enabled,
--   base_price, settings, table_min_spend
-- The other 21 columns stay readable, including owner_id (read as the caller by
-- 21 policies, notify_on_scan and six client sites), entry_price and vip_price
-- (A37: the owner's price editor and create-checkout-session read them as the
-- caller) and business_verified (read by four cross-table policies).
--
-- WHAT IT DOES: SELECT only. Revoke table-level SELECT from anon and
-- authenticated, grant SELECT back on the 21 public columns by name, and revoke
-- the seven private columns by name. INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES and TRIGGER are not touched (A39 is its own task), so an owner still
-- writes a price: the update needs UPDATE on the price columns, which is
-- unchanged, and SELECT on id for its WHERE and RETURNING, which is granted.
-- postgres and service_role are untouched and still read every column.
--
-- calculate_ticket_commission IS DELIBERATELY LEFT AS IT IS (owner decision; it
-- reached this session on 2026-10-14). It is the BEFORE INSERT trigger on
-- tickets and reads venues.standard_commission with the caller's rights. After
-- this migration, a ticket inserted directly as authenticated fails with 42501.
-- The only legitimate ticket inserter is stripe-webhook as service_role, which
-- keeps full SELECT and is unaffected. Measured 2026-10-14: no INSERT INTO
-- tickets from any role in pg_stat_statements since its last reset on
-- 2026-07-28, and the newest ticket was created 2026-02-22.
-- SIDE EFFECT, NOT AN A26 FIX: A26's direct-insert hole now fails with 42501
-- instead of succeeding, which also stops it exposing standard_commission
-- through the inserted row's commission_earned (price_paid times
-- standard_commission when there is no promoter rate). A26 stays open: the
-- tickets INSERT policy still admits the insert, and the failure comes only
-- from the trigger's read of a revoked column.
--
-- PREREQUISITE: a514da3 (A31 step 1) narrowed the four select("*") call sites.
-- A browser tab still running an older bundle sends select=* and fails with
-- 42501 until it reloads (CLAUDE.md: a migration that revokes a grant breaks every
-- client still running the previous bundle).
--
-- IDEMPOTENT, per A16. Revoking table-level SELECT also revokes every
-- column-level SELECT on the table, so it runs only while table-level SELECT is
-- still held; an isolated re-run then cannot strip a column granted later by
-- another migration. The GRANT is a no-op when already held, and the column
-- revoke of the seven re-asserts this file's intent. The post-check raises and
-- aborts if the end state is not exactly what this header describes.
--
-- types.ts: unchanged. Generated types describe columns, not grants.
-- New columns on venues are NOT readable by anon or authenticated until granted
-- by name. That is the cost of this boundary, and it fails loudly with 42501.

DO $a31_revoke$
BEGIN
  IF has_table_privilege('anon', 'public.venues', 'SELECT')
     OR has_table_privilege('authenticated', 'public.venues', 'SELECT') THEN
    REVOKE SELECT ON TABLE public.venues FROM anon, authenticated;
  END IF;
END
$a31_revoke$;

GRANT SELECT (
  id, created_at, name, location, address, description, image_url, website,
  capacity, is_active, category, owner_id, entry_price, vip_price, venue_type,
  hero_reel_url, event_flyer_url, general_description, vip_description,
  active_at, business_verified
) ON TABLE public.venues TO anon, authenticated;

REVOKE SELECT (
  commission_rate, standard_commission, subscription_tier, ticketing_enabled,
  base_price, settings, table_min_spend
) ON TABLE public.venues FROM anon, authenticated;

-- ================================================================== POST-CHECK
DO $a31_check$
DECLARE
  c_private constant text[] := ARRAY['commission_rate','standard_commission','subscription_tier',
                                     'ticketing_enabled','base_price','settings','table_min_spend'];
  c_public  constant text[] := ARRAY['id','created_at','name','location','address','description',
                                     'image_url','website','capacity','is_active','category','owner_id',
                                     'entry_price','vip_price','venue_type','hero_reel_url','event_flyer_url',
                                     'general_description','vip_description','active_at','business_verified'];
  r text;
  c text;
  bad text[] := '{}';
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(r, 'public.venues', 'SELECT') THEN
      bad := bad || (r || ': still holds table-level SELECT');
    END IF;
    FOREACH c IN ARRAY c_private LOOP
      IF has_column_privilege(r, 'public.venues', c, 'SELECT') THEN
        bad := bad || (r || ': can still read private column ' || c);
      END IF;
    END LOOP;
    FOREACH c IN ARRAY c_public LOOP
      IF NOT has_column_privilege(r, 'public.venues', c, 'SELECT') THEN
        bad := bad || (r || ': cannot read public column ' || c);
      END IF;
    END LOOP;
  END LOOP;

  FOREACH r IN ARRAY ARRAY['postgres', 'service_role'] LOOP
    IF NOT has_table_privilege(r, 'public.venues', 'SELECT') THEN
      bad := bad || (r || ': lost table-level SELECT');
    END IF;
  END LOOP;

  IF array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION 'A31 step 2 post-check failed: %', array_to_string(bad, '; ');
  END IF;
END
$a31_check$;
