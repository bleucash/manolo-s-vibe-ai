-- Item 2 (build order): Tier 1 venue claims (the Instagram handshake in
-- ClaimSectorModal.tsx) must be insertable with nothing but an Instagram
-- handle. Two confirmed problems, verified via information_schema on
-- 2026-08-02, not assumed:
--
-- 1. venue_claims has no evidence_link column at all - the full live
--    column list is id, venue_id, user_id, legal_name, business_email,
--    business_phone, position_title, status, created_at. Purely a
--    code-side phantom reference (ClaimSectorModal.tsx sends it, nothing
--    on the table receives it). Fix lives in application code (send
--    instagram_handle instead), this migration adds the real column.
--
-- 2. legal_name and business_email are NOT NULL with no default, but
--    ClaimSectorModal.tsx (Tier 1) never collects either - those are Tier
--    2 (business verification) fields per CLAUDE.md's two-tier design.
--    Every Tier 1 insert would fail on a NOT NULL violation even after
--    fixing (1). Grepped all of src/ first: no component or page reads
--    claim.legal_name or claim.business_email anywhere (only hits are the
--    auto-generated types.ts declarations), so relaxing these to nullable
--    has no blast radius in application code.
--
-- business_phone and position_title were already nullable (confirmed via
-- information_schema, not inferred from the absence of a NOT NULL flag) -
-- no change needed for those two.
--
-- instagram_handle is added nullable, matching the existing Tier 2 columns
-- (business_phone, position_title), rather than adding a new NOT NULL
-- constraint that could block a future Tier-2-only insert path that
-- doesn't go through ClaimSectorModal.
--
-- Pure DDL (ADD COLUMN, DROP NOT NULL) - does not fire row-level triggers,
-- so no disable/enable dance needed here unlike the role_type migration.

ALTER TABLE public.venue_claims ADD COLUMN instagram_handle text;

ALTER TABLE public.venue_claims ALTER COLUMN legal_name DROP NOT NULL;
ALTER TABLE public.venue_claims ALTER COLUMN business_email DROP NOT NULL;
