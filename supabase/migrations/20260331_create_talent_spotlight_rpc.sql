-- RPC: Get top talent for spotlight
-- Returns talent profiles ordered by some score metric (e.g., charge_score, activity)
CREATE OR REPLACE FUNCTION public.get_talent_spotlight(limit_count integer DEFAULT 3)
RETURNS TABLE (
  talent_id text,
  display_name text,
  avatar_url text,
  hero_reel_url text,
  sub_role text,
  venue_id text,
  is_active boolean,
  charge_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS talent_id,
    p.display_name,
    p.avatar_url,
    p.hero_reel_url,
    p.sub_role,
    p.current_venue_id AS venue_id,
    p.is_active,
    COALESCE((
      SELECT COUNT(*)
      FROM post_likes pl
      WHERE pl.post_id IN (
        SELECT id FROM posts WHERE user_id = p.id
      )
    ), 0) AS charge_score
  FROM profiles p
  WHERE p.role_type = 'talent'
    AND p.is_active = true
  ORDER BY charge_score DESC, p.updated_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
