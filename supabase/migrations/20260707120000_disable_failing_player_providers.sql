-- Disable failing player providers while preserving their records for admin review.
-- They remain hidden from normal playback because the app only loads enabled providers.

UPDATE public.player_providers
SET
  enabled = false,
  tags = ARRAY['Disabled', 'Unavailable'],
  best_for = 'Disabled after provider health check',
  updated_at = now()
WHERE id IN ('rive', 'vidora');
