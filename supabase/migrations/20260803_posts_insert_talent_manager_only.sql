-- Build order item 5: guests do not post at launch (CLAUDE.md decision,
-- full stop, not conditional). Preemptive close, not a live fix: nothing in
-- the repo currently inserts into posts, CreatePostDialog.tsx is still a
-- setTimeout stub and Index.tsx only reads. Nothing breaks either way.
--
-- Verified live before writing (2026-08-03):
--   - RLS was ALREADY enabled on posts (relrowsecurity = true), unlike
--     venue_claims. This migration does not enable it, only replaces a policy.
--   - An INSERT policy already existed: "Authenticated users can post",
--     TO public, WITH CHECK (auth.uid() = user_id). Self-scoped but with no
--     role requirement at all, so any authenticated user including a guest
--     could post.
--   - The author column is `user_id` (uuid, NOT NULL). Confirmed against
--     information_schema, not assumed.
--
-- Role check goes through the existing SECURITY DEFINER has_role_type()
-- helper rather than a direct subquery on profiles. profiles currently has
-- a permissive `USING (true)` SELECT policy so a subquery would work today,
-- but it would silently start denying every insert the moment anyone
-- tightens profiles SELECT. The helper is immune to that and is the pattern
-- already established in this DB.
--
-- Scope note: posts still has no UPDATE or DELETE policy (users cannot edit
-- or delete their own posts). Pre-existing, already logged in CLAUDE.md,
-- deliberately out of scope here.

DROP POLICY IF EXISTS "Authenticated users can post" ON public.posts;

CREATE POLICY "Talent and managers can post"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role_type(auth.uid(), 'talent')
    OR public.has_role_type(auth.uid(), 'manager')
  )
);
