-- ============================================================================
-- Allow Admins to Update User Profiles
-- ============================================================================

-- Purpose:
-- Grant admins permission to update user profile fields (role, can_stream, etc.)

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- Create new policy: Users can update own profile, admins can update any profile
CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
USING (
    id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
