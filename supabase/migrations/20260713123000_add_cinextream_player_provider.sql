INSERT INTO public.player_providers (
  id,
  name,
  render_mode,
  enabled,
  sort_order,
  has_events,
  risk_level,
  tags,
  best_for,
  movie_embed_template,
  tv_embed_template,
  updated_at
)
VALUES (
  'cinextream',
  'CineXtream',
  'embed',
  true,
  4,
  true,
  'low',
  ARRAY['Auto Next', 'Events', 'Vidstack'],
  'Movies & TV',
  'https://cinextream.net/api/embed/movie/{{tmdbId}}?autoplay=false',
  'https://cinextream.net/api/embed/tv/{{tmdbId}}/{{season}}/{{episode}}?autoplay=false',
  now()
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  render_mode = EXCLUDED.render_mode,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order,
  has_events = EXCLUDED.has_events,
  risk_level = EXCLUDED.risk_level,
  tags = EXCLUDED.tags,
  best_for = EXCLUDED.best_for,
  movie_embed_template = EXCLUDED.movie_embed_template,
  tv_embed_template = EXCLUDED.tv_embed_template,
  updated_at = now();
