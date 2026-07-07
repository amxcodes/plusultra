-- Keep the browser player on providers that do not rely on Brave-style popup blocking.
-- Desktop/admin can re-enable these later if they are verified clean.

UPDATE public.player_providers
SET
  enabled = false,
  tags = ARRAY['Disabled', 'Browser Ads'],
  best_for = 'Disabled for browser no-ads mode',
  updated_at = now()
WHERE id IN ('cinesrc', 'aeon', 'cinezo');
