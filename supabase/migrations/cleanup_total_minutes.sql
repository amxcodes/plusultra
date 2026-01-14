-- ==============================================================================
-- 🧹 CLEANUP: Remove total_minutes from existing stats
-- ==============================================================================
-- Run this AFTER stats_system.sql to clean up the old field
-- ==============================================================================

-- Remove total_minutes from all existing user stats
UPDATE public.profiles
SET stats = stats - 'total_minutes'
WHERE stats ? 'total_minutes';

-- Verify cleanup
SELECT id, stats FROM public.profiles WHERE stats IS NOT NULL LIMIT 5;
