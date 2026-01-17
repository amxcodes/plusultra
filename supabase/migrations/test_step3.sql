-- ============================================================================
-- STEP 3 TEST SUITE
-- ============================================================================
-- Run these tests BEFORE and AFTER running Step 3 migration
-- Compare results to ensure nothing breaks
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION TESTS (Run with RLS disabled)
-- ============================================================================

-- TEST 1: Count all playlists
SELECT 'TEST 1: Total playlists' as test_name, COUNT(*) as result
FROM playlists;

-- TEST 2: Count public playlists
SELECT 'TEST 2: Public playlists' as test_name, COUNT(*) as result
FROM playlists
WHERE is_public = true;

-- TEST 3: Count featured playlists
SELECT 'TEST 3: Featured playlists' as test_name, COUNT(*) as result
FROM playlists
WHERE is_featured = true;

-- TEST 4: Count your own playlists (replace with your user_id)
-- SELECT 'TEST 4: My playlists' as test_name, COUNT(*) as result
-- FROM playlists
-- WHERE user_id = '<YOUR_USER_ID>';

-- TEST 5: Count all playlist items
SELECT 'TEST 5: Total playlist items' as test_name, COUNT(*) as result
FROM playlist_items;

-- TEST 6: Check RLS status (should be false before migration)
SELECT 'TEST 6: RLS Status - playlists' as test_name, 
       CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as result
FROM pg_tables
WHERE tablename = 'playlists';

SELECT 'TEST 6: RLS Status - playlist_items' as test_name,
       CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as result
FROM pg_tables
WHERE tablename = 'playlist_items';

-- TEST 7: Count existing policies
SELECT 'TEST 7: Policy count - playlists' as test_name, COUNT(*) as result
FROM pg_policies
WHERE tablename = 'playlists';

SELECT 'TEST 7: Policy count - playlist_items' as test_name, COUNT(*) as result
FROM pg_policies
WHERE tablename = 'playlist_items';

-- ============================================================================
-- POST-MIGRATION TESTS (Run with RLS enabled)
-- ============================================================================

-- After running Step 3, run the same tests above and compare:
--
-- EXPECTED CHANGES:
-- - TEST 1: Number should be SAME OR LESS (you now only see accessible playlists)
-- - TEST 2: Number should be SAME (public playlists still visible)
-- - TEST 3: Number should be SAME (featured playlists still visible)
-- - TEST 4: Number should be SAME (your playlists still visible)
-- - TEST 5: May be LESS (only items from accessible playlists)
-- - TEST 6: Should show "ENABLED" for both
-- - TEST 7: playlists = 10 policies, playlist_items = 7 policies
--
-- CRITICAL: If TEST 2, 3, or 4 show ZERO, ROLLBACK IMMEDIATELY!
-- ============================================================================

-- ============================================================================
-- FUNCTIONAL TESTS (Run AFTER migration)
-- ============================================================================

-- TEST 8: Can you create a new playlist?
-- (Replace <YOUR_USER_ID> with auth.uid() or your actual user ID)
/*
INSERT INTO playlists (user_id, name, description, is_public)
VALUES (auth.uid(), 'RLS Test Playlist', 'Created after Step 3', false)
RETURNING id, name, user_id;
-- Expected: Returns the new playlist
-- If this fails: ROLLBACK IMMEDIATELY
*/

-- TEST 9: Can you add an item to your playlist?
-- (Replace <PLAYLIST_ID> and <TMDB_ID> with actual values)
/*
INSERT INTO playlist_items (playlist_id, tmdb_id, media_type, metadata, added_by_user_id)
VALUES ('<PLAYLIST_ID>', '550', 'movie', '{"title": "Fight Club"}'::jsonb, auth.uid())
RETURNING id;
-- Expected: Returns the new item
-- If this fails: ROLLBACK IMMEDIATELY
*/

-- TEST 10: Can you delete your own playlist?
-- (Replace <PLAYLIST_ID> with the ID from TEST 8)
/*
DELETE FROM playlists WHERE id = '<PLAYLIST_ID>';
-- Expected: Succeeds
-- If this fails: ROLLBACK IMMEDIATELY
*/

-- ============================================================================
-- PERFORMANCE TEST (Optional)
-- ============================================================================

-- Check query performance before and after
EXPLAIN ANALYZE
SELECT *
FROM playlists
WHERE is_public = true
LIMIT 10;

-- Expected: Execution time should be similar (within 2x)
-- If much slower: Consider adding indexes or reviewing policies

-- ============================================================================
-- CLEANUP
-- ============================================================================
-- Remember to clean up any test data you created!
-- ============================================================================
