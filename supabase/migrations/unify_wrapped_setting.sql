-- UNIFY WRAPPED FEATURE FLAG
-- Keep the flag the app actually uses: wrapped_enabled.
-- If a legacy wrapped_2026_enabled value exists, merge it into wrapped_enabled once
-- and remove the duplicate key to avoid future confusion.

INSERT INTO public.app_settings (key, value)
VALUES (
  'wrapped_enabled',
  COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'wrapped_2026_enabled'),
    'false'
  )
)
ON CONFLICT (key) DO UPDATE
SET value = CASE
  WHEN public.app_settings.value = 'true' THEN 'true'
  ELSE COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'wrapped_2026_enabled'),
    EXCLUDED.value
  )
END;

DELETE FROM public.app_settings
WHERE key = 'wrapped_2026_enabled';
