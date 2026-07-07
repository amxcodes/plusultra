-- Restore desktop-capable providers. The browser app filters its own safer provider set,
-- while Electron relies on stricter shell-level popup and ad request blocking.

UPDATE public.player_providers
SET
  enabled = true,
  tags = CASE id
    WHEN 'cinesrc' THEN ARRAY['Auto Next', 'Events']
    ELSE ARRAY['Reliable']
  END,
  best_for = CASE id
    WHEN 'cinesrc' THEN 'Movies & TV'
    ELSE 'Backup'
  END,
  updated_at = now()
WHERE id IN ('cinesrc', 'aeon', 'cinezo');
