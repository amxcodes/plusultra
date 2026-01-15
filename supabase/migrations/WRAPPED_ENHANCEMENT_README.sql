-- ===============================================
-- WRAPPED STATS ENHANCEMENT - READY TO RUN
-- ===============================================
-- Run this in Supabase SQL Editor
-- This updates your update_watch_history function with enhanced Wrapped tracking
-- ===============================================

-- Just run the entire COMPLETE_WRAPPED_MIGRATION.sql file!
-- It now includes:
-- ✅ Rewatch tracking
-- ✅ Binge day detection (3+ watches per day)
-- ✅ Per-title rewatch counts
-- ✅ Automatic cleanup of old daily counts (30 days)

-- After running, test with these queries:

-- 1. Check your current stats structure
SELECT stats FROM profiles WHERE id = auth.uid();

-- Expected structure:
-- {
--   "total_movies": 0,
--   "total_shows": 0,
--   "rewatch_count": 0,      ← NEW
--   "binge_days": 0,          ← NEW
--   "daily_watch_count": {},  ← NEW
--   "title_rewatch_counts": {} ← NEW
--   ...
-- }

-- 2. Simulate a watch (trigger the function)
-- This will be done automatically by your frontend when users watch content

-- 3. Check if binge tracking works
-- Watch 3+ episodes in a day, then run:
SELECT 
  stats->>'binge_days' as binge_days,
  stats->'daily_watch_count' as today_count
FROM profiles 
WHERE id = auth.uid();

-- 4. Check rewatch tracking
SELECT 
  stats->>'rewatch_count' as total_rewatches,
  stats->'title_rewatch_counts' as by_title
FROM profiles 
WHERE id = auth.uid();

-- ===============================================
-- WHAT CHANGED
-- ===============================================
-- 
-- NEW FIELDS ADDED TO stats:
-- 1. rewatch_count (int)        - Total rewatches across all titles
-- 2. binge_days (int)            - Days with 3+ watches
-- 3. daily_watch_count (object)  - Tracks today's watch count
-- 4. title_rewatch_counts (obj)  - Per-title rewatch tracking
--
-- NEW LOGIC:
-- 1. Detects rewatches when tmdb_id already exists
-- 2. Increments binge_days when 3rd watch happens in a day
-- 3. Auto-cleans daily_watch_count older than 30 days
--
-- BACKWARD COMPATIBLE:
-- ✅ Existing users get new fields on next watch
-- ✅ No data loss
-- ✅ No breaking changes
--
-- ===============================================
