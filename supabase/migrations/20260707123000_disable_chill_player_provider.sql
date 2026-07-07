-- Disable Chillflix after ads started escaping the embedded player sandbox.

UPDATE public.player_providers
SET
  enabled = false,
  tags = ARRAY['Disabled', 'Ads'],
  best_for = 'Disabled because ads are escaping',
  updated_at = now()
WHERE id = 'chill';
