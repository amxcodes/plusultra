-- ============================================================================
-- Enable Realtime for Profiles Table
-- ============================================================================

-- Purpose:
-- Allow clients to receive real-time updates when profile data changes.
-- This enables instant permission updates when admin toggles can_stream.

-- Set REPLICA IDENTITY to FULL (required for filtered realtime subscriptions)
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
