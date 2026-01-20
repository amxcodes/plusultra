-- ============================================================================
-- Enable Realtime SELECT Policy for Profiles
-- ============================================================================

-- Purpose:
-- Allow users to SELECT their own profile so realtime subscriptions can work.
-- Without this, the postgres_changes won't broadcast to the user.

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Combined policy: Users can read own profile, admins can read all
CREATE POLICY "profiles_select_policy"
ON public.profiles
FOR SELECT
USING (
    id = auth.uid()
    OR role = 'admin'
);
