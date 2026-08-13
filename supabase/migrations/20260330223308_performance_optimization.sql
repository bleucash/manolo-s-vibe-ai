-- =====================================================
-- Performance Optimization Indexes
-- Migration: Add indexes for feed queries
-- Date: 2026-03-30
-- =====================================================

-- UP MIGRATION (apply indexes)
-- =====================================================

-- Posts table indexes
-- -------------------
-- Composite index for follower feed queries (WHERE user_id, ORDER BY created_at)
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);

-- Index for general chronological ordering
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- Composite index for user + venue queries
CREATE INDEX IF NOT EXISTS idx_posts_user_venue ON posts(user_id, venue_id);

-- Index for status filtering (published vs draft)
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- Index for venue_id joins
CREATE INDEX IF NOT EXISTS idx_posts_venue_id ON posts(venue_id);

-- Followers table indexes
-- -----------------------
-- Composite index for checking if a user follows another user
CREATE INDEX IF NOT EXISTS idx_followers_follower_following ON followers(follower_id, following_id);

-- Single-column indexes for backward compatibility / alternative queries
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);

-- Venue followers table indexes
-- -----------------------------
CREATE INDEX IF NOT EXISTS idx_venue_followers_follower_venue ON venue_followers(follower_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_followers_follower_id ON venue_followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_venue_followers_venue_id ON venue_followers(venue_id);

-- Venues table indexes
-- --------------------
-- Composite index for Discovery page: order by active, filter by category
CREATE INDEX IF NOT EXISTS idx_venues_is_active_category ON venues(is_active, category);

-- Index for category filtering with ilike (supports text search)
-- Using GIN index with trigram ops for pattern matching performance
CREATE INDEX IF NOT EXISTS idx_venues_category_gin ON venues USING gin(category gin_trgm_ops);

-- Index for location search
CREATE INDEX IF NOT EXISTS idx_venues_location_gin ON venues USING gin(location gin_trgm_ops);

-- Profiles table indexes
-- ----------------------
-- Composite index for Discovery talent spotlight: WHERE role_type, ORDER BY is_active
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON profiles(role_type, is_active DESC);

-- Index for role_type filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role_type ON profiles(role_type);

-- Post likes table indexes (charge/energy system)
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_post_likes_user_post ON post_likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);

-- Interactions table indexes (passive charging tracking)
-- ------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_interactions_user_target ON interactions(user_id, target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_interactions_target ON interactions(target_id, target_type);

-- =====================================================
-- DOWN MIGRATION (rollback - remove indexes)
-- =====================================================
-- Run this section to remove all indexes created above
-- =====================================================

/*
-- Posts table indexes
DROP INDEX IF EXISTS idx_posts_user_created;
DROP INDEX IF EXISTS idx_posts_created_at;
DROP INDEX IF EXISTS idx_posts_user_venue;
DROP INDEX IF EXISTS idx_posts_status;
DROP INDEX IF EXISTS idx_posts_venue_id;

-- Followers table indexes
DROP INDEX IF EXISTS idx_followers_follower_following;
DROP INDEX IF EXISTS idx_followers_follower_id;
DROP INDEX IF EXISTS idx_followers_following_id;

-- Venue followers table indexes
DROP INDEX IF EXISTS idx_venue_followers_follower_venue;
DROP INDEX IF EXISTS idx_venue_followers_follower_id;
DROP INDEX IF EXISTS idx_venue_followers_venue_id;

-- Venues table indexes
DROP INDEX IF EXISTS idx_venues_is_active_category;
DROP INDEX IF EXISTS idx_venues_category_gin;
DROP INDEX IF EXISTS idx_venues_location_gin;

-- Profiles table indexes
DROP INDEX IF EXISTS idx_profiles_role_active;
DROP INDEX IF EXISTS idx_profiles_role_type;

-- Post likes table indexes
DROP INDEX IF EXISTS idx_post_likes_user_post;
DROP INDEX IF EXISTS idx_post_likes_post_id;

-- Interactions table indexes
DROP INDEX IF EXISTS idx_interactions_user_target;
DROP INDEX IF EXISTS idx_interactions_target;
*/
