-- ============================================================================
-- Add Unique Constraint for Movie Requests
-- ============================================================================

-- Purpose:
-- Prevents duplicate movie/tv requests by enforcing uniqueness at the database level.
-- This enables atomic duplicate prevention without race conditions.

-- Add unique constraint on tmdb_id + media_type combination
-- Use IF NOT EXISTS pattern for idempotent migrations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'movie_requests_tmdb_media_unique'
    ) THEN
        ALTER TABLE public.movie_requests 
        ADD CONSTRAINT movie_requests_tmdb_media_unique 
        UNIQUE (tmdb_id, media_type);
    END IF;
END $$;
