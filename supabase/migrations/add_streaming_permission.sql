-- ============================================================================
-- Add Streaming Permission to User Profiles
-- ============================================================================

-- Purpose:
-- Add a 'can_stream' permission flag to control who can access streaming features.
-- Users without this permission will see the site as a read-only curation platform.

-- Add can_stream column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_stream BOOLEAN DEFAULT false;

-- Grant streaming access to existing admins by default
UPDATE public.profiles
SET can_stream = true
WHERE role = 'admin';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.can_stream IS 'Permission flag: if false, user cannot access streaming features (Play buttons, Continue Watching, Requests, Player)';
