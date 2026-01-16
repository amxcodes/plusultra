-- Server-Side Registration Control
-- Enforces registration_enabled setting at database level (bypass-proof)

-- =====================================================
-- FUNCTION: Check if registration is allowed
-- =====================================================

CREATE OR REPLACE FUNCTION check_registration_enabled()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    is_enabled text;
BEGIN
    -- Check app_settings for registration status
    SELECT value INTO is_enabled 
    FROM app_settings 
    WHERE key = 'registration_enabled';
    
    -- Block signup if disabled (or setting doesn't exist = default allow)
    IF is_enabled = 'false' THEN
        RAISE EXCEPTION 'New user registration is currently disabled. Please contact an administrator.'
            USING HINT = 'Registration can be enabled by an admin in the dashboard';
    END IF;
    
    -- Allow registration
    RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER: Enforce on every signup attempt
-- =====================================================

DROP TRIGGER IF EXISTS enforce_registration_setting ON auth.users;

CREATE TRIGGER enforce_registration_setting
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION check_registration_enabled();

-- =====================================================
-- VERIFICATION
-- =====================================================

/*
-- Test 1: Verify trigger exists
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'enforce_registration_setting';

-- Test 2: Try signup when disabled (should fail)
-- First ensure registration is disabled:
UPDATE app_settings SET value = 'false' WHERE key = 'registration_enabled';

-- Then try to signup via SQL (will be blocked):
-- INSERT INTO auth.users (email) VALUES ('test@example.com'); -- Should error

-- Test 3: Enable and try again (should work)
UPDATE app_settings SET value = 'true' WHERE key = 'registration_enabled';
-- INSERT INTO auth.users (email) VALUES ('test@example.com'); -- Should succeed
*/
