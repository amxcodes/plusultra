-- ===============================================
-- SUPABASE DATA EXPORT FOR NEON MIGRATION
-- ===============================================
-- Run these queries in your Supabase SQL Editor
-- Copy the results and use them for the import script
-- ===============================================

-- ===============================================
-- 1. EXPORT PROFILES DATA
-- ===============================================
SELECT 
  id,
  username,
  avatar_url,
  role,
  watch_history,
  stats,
  recent_searches,
  last_seen_announcements,
  last_seen_activity,
  created_at
FROM public.profiles
ORDER BY created_at;

-- SAVE THIS AS: profiles_export.json
-- ===============================================

-- ===============================================
-- 2. EXPORT PLAYLISTS DATA
-- ===============================================
SELECT 
  id,
  user_id,
  name,
  description,
  is_public,
  is_featured,
  type,
  created_at
FROM public.playlists
ORDER BY created_at;

-- SAVE THIS AS: playlists_export.json
-- ===============================================

-- ===============================================
-- 3. EXPORT PLAYLIST ITEMS DATA
-- ===============================================
SELECT 
  playlist_id,
  tmdb_id,
  media_type,
  metadata,
  added_at
FROM public.playlist_items
ORDER BY playlist_id, added_at;

-- SAVE THIS AS: playlist_items_export.json
-- ===============================================

-- ===============================================
-- 4. EXPORT ANNOUNCEMENTS DATA
-- ===============================================
SELECT 
  id,
  title,
  content,
  type,
  is_active,
  created_at
FROM public.announcements
ORDER BY created_at DESC;

-- SAVE THIS AS: announcements_export.json
-- ===============================================

-- ===============================================
-- 5. EXPORT FEATURED SECTIONS DATA
-- ===============================================
SELECT 
  id,
  title,
  description,
  content_type,
  display_order,
  is_active,
  items,
  created_at
FROM public.featured_sections
ORDER BY display_order;

-- SAVE THIS AS: featured_sections_export.json
-- ===============================================

-- ===============================================
-- 6. EXPORT FEATURED MOVIES DATA
-- ===============================================
SELECT 
  id,
  tmdb_id,
  media_type,
  metadata,
  created_at
FROM public.featured_movies
ORDER BY created_at;

-- SAVE THIS AS: featured_movies_export.json
-- ===============================================

-- ===============================================
-- 7. EXPORT UPCOMING EVENTS DATA
-- ===============================================
SELECT 
  id,
  title,
  description,
  poster_url,
  starts_at,
  tmdb_id,
  media_type,
  is_active,
  created_at
FROM public.upcoming_events
ORDER BY starts_at;

-- SAVE THIS AS: upcoming_events_export.json
-- ===============================================

-- ===============================================
-- 8. EXPORT FOLLOWS DATA
-- ===============================================
SELECT 
  follower_id,
  following_id,
  created_at
FROM public.follows
ORDER BY created_at;

-- SAVE THIS AS: follows_export.json
-- ===============================================

-- ===============================================
-- 9. EXPORT WATCH PARTIES DATA
-- ===============================================
SELECT 
  id,
  host_id,
  tmdb_id,
  media_type,
  season,
  episode,
  current_server,
  invite_code,
  created_at,
  expires_at,
  max_participants
FROM public.watch_parties
WHERE expires_at > NOW()
ORDER BY created_at DESC;

-- SAVE THIS AS: watch_parties_export.json
-- ===============================================

-- ===============================================
-- 10. EXPORT APP SETTINGS DATA
-- ===============================================
SELECT 
  key,
  value
FROM public.app_settings;

-- SAVE THIS AS: app_settings_export.json
-- ===============================================

-- ===============================================
-- 11. EXPORT PLAYLIST LIKES DATA
-- ===============================================
SELECT 
  user_id,
  playlist_id,
  created_at
FROM public.playlist_likes
ORDER BY created_at;

-- SAVE THIS AS: playlist_likes_export.json
-- ===============================================

-- ===============================================
-- 12. EXPORT SERVER VOTES DATA (if exists)
-- ===============================================
SELECT 
  id,
  tmdb_id,
  media_type,
  season,
  episode,
  provider_id,
  vote_count,
  last_updated
FROM public.server_votes
ORDER BY vote_count DESC;

-- SAVE THIS AS: server_votes_export.json
-- ===============================================

-- ===============================================
-- 13. EXPORT COMMUNITY STATS DATA (if exists)
-- ===============================================
SELECT 
  id,
  trending_daily,
  trending_weekly,
  most_watched_all_time,
  updated_at
FROM public.community_stats;

-- SAVE THIS AS: community_stats_export.json
-- ===============================================

-- ===============================================
-- QUICK STATS CHECK
-- ===============================================
SELECT 
  'profiles' as table_name,
  COUNT(*) as row_count
FROM public.profiles
UNION ALL
SELECT 
  'playlists' as table_name,
  COUNT(*) as row_count
FROM public.playlists
UNION ALL
SELECT 
  'playlist_items' as table_name,
  COUNT(*) as row_count
FROM public.playlist_items
UNION ALL
SELECT 
  'announcements' as table_name,
  COUNT(*) as row_count
FROM public.announcements
UNION ALL
SELECT 
  'follows' as table_name,
  COUNT(*) as row_count
FROM public.follows
UNION ALL
SELECT 
  'watch_parties' as table_name,
  COUNT(*) as row_count
FROM public.watch_parties
UNION ALL
SELECT 
  'app_settings' as table_name,
  COUNT(*) as row_count
FROM public.app_settings;

-- ===============================================
-- NOTES FOR DATA IMPORT TO NEON:
-- ===============================================
-- 
-- 1. Run each SELECT query above in Supabase SQL Editor
-- 2. Export results as JSON
-- 3. Save each with the suggested filename
-- 4. Use a script (Node.js/Python) to insert into Neon
--    OR manually craft INSERT statements from the JSON
--
-- IMPORTANT: 
-- - User IDs (UUIDs) must be preserved exactly
-- - watch_history and stats are JSONB - ensure proper formatting
-- - Dates are TIMESTAMPTZ - maintain timezone info
-- - Foreign key relationships must be maintained:
--   * playlists.user_id -> profiles.id
--   * playlist_items.playlist_id -> playlists.id
--   * follows.follower_id/following_id -> profiles.id
--
-- RECOMMENDED IMPORT ORDER:
-- 1. profiles (no dependencies)
-- 2. app_settings (no dependencies)
-- 3. playlists (depends on profiles)
-- 4. playlist_items (depends on playlists)
-- 5. follows (depends on profiles)
-- 6. announcements (no user dependencies)
-- 7. featured_sections, featured_movies, upcoming_events
-- 8. watch_parties
-- 9. playlist_likes
-- 10. server_votes, community_stats
--
-- ===============================================
