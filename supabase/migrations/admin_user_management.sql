-- Admin User Management Migration
-- Adds function to delete user profiles (which cascades to related data)
-- Auth records are kept for audit logs

-- =====================================================
-- FUNCTION: Admin Delete User (Profile Only)
-- =====================================================

CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_user jsonb;
    is_admin boolean;
BEGIN
    -- Security: Only admins can call this
    SELECT role = 'admin' INTO is_admin
    FROM profiles WHERE id = auth.uid();
    
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Prevent self-deletion
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;
    
    -- Get user info before deletion (for confirmation/logging)
    SELECT jsonb_build_object(
        'id', id,
        'username', username,
        'role', role,
        'created_at', created_at,
        'deleted_at', now()
    ) INTO deleted_user
    FROM profiles WHERE id = p_user_id;
    
    -- Check if user exists
    IF deleted_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Delete from profiles table
    -- Foreign key CASCADE will handle:
    --   - playlists (user_id FK)
    --   - playlist_items (via playlists cascade)
    --   - watch_party (created_by FK)  
    --   - watch_party_members (user_id FK)
    --   - playlist_likes (user_id FK)
    --   - follows (follower_id/following_id FK)
    DELETE FROM profiles WHERE id = p_user_id;
    
    -- Return deleted user info for audit logging
    RETURN deleted_user;
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

/*
-- Test the function (as admin):
SELECT admin_delete_user('user-uuid-here');

-- Verify foreign key constraints exist:
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
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
    AND rc.delete_rule = 'CASCADE';
*/
