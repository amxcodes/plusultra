-- Fix Chillflix templates to use the app-supported {{token}} syntax.
-- The app interpolates tmdbId, season, episode, and mediaType only.

UPDATE public.player_providers
SET
  enabled = true,
  tags = ARRAY['Reliable', 'Backup'],
  best_for = 'Backup',
  movie_embed_template = 'https://chillflix.pw/embed/movie/{{tmdbId}}?autoplay=true&startAt=120',
  tv_embed_template = 'https://chillflix.pw/embed/tv/{{tmdbId}}/{{season}}/{{episode}}?autoplay=true&autonext=true',
  updated_at = now()
WHERE id = 'chill';
