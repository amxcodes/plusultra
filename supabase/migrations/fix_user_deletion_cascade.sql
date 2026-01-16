-- Fix Foreign Key Cascade for User Deletion
-- This migration updates foreign key constraints to properly cascade delete when user is removed

-- =====================================================
-- FIX: playlists.user_id CASCADE
-- =====================================================

-- Drop existing constraint
ALTER TABLE playlists 
DROP CONSTRAINT IF EXISTS playlists_user_id_fkey;

-- Recreate with CASCADE
ALTER TABLE playlists
ADD CONSTRAINT playlists_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- =====================================================
-- FIX: watch_history.user_id CASCADE (if table exists)
-- =====================================================

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'watch_history') THEN
        ALTER TABLE watch_history DROP CONSTRAINT IF EXISTS watch_history_user_id_fkey;
        ALTER TABLE watch_history ADD CONSTRAINT watch_history_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- FIX: playlist_likes.user_id CASCADE (if table exists)
-- =====================================================

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playlist_likes') THEN
        ALTER TABLE playlist_likes DROP CONSTRAINT IF EXISTS playlist_likes_user_id_fkey;
        ALTER TABLE playlist_likes ADD CONSTRAINT playlist_likes_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- FIX: follows.follower_id and follows.following_id CASCADE (if table exists)
-- =====================================================

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'follows') THEN
        ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
        ALTER TABLE follows ADD CONSTRAINT follows_follower_id_fkey 
            FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;
            
        ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
        ALTER TABLE follows ADD CONSTRAINT follows_following_id_fkey 
            FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

/*
-- Verify CASCADE is set correctly:
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'profiles'
ORDER BY tc.table_name;

Expected: All rows should show delete_rule = 'CASCADE'
*/
