-- ============================================================================
-- Allow anonymous guest sign-ins when normal registration is disabled
-- ============================================================================
-- Guest access links rely on Supabase anonymous auth. The existing
-- check_registration_enabled() trigger blocks every auth.users insert when
-- registration_enabled = false, which unintentionally blocks anonymous users too.

CREATE OR REPLACE FUNCTION public.check_registration_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_enabled text;
BEGIN
    -- Anonymous guest sessions should still be allowed even when public
    -- registration is disabled for standard users.
    IF COALESCE(NEW.is_anonymous, false) THEN
        RETURN NEW;
    END IF;

    SELECT value INTO is_enabled
    FROM public.app_settings
    WHERE key = 'registration_enabled';

    IF is_enabled = 'false' THEN
        RAISE EXCEPTION 'New user registration is currently disabled. Please contact an administrator.'
            USING HINT = 'Registration can be enabled by an admin in the dashboard';
    END IF;

    RETURN NEW;
END;
$$;
