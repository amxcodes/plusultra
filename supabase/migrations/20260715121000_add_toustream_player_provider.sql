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
  'toustream',
  'TouStream',
  'embed',
  true,
  5,
  true,
  'medium',
  ARRAY['Auto Next', 'Movies', 'TV'],
  'Movies & TV',
  'https://toustream.xyz/tou/movies/{{tmdbId}}',
  'https://toustream.xyz/tou/tv/{{tmdbId}}/{{season}}/{{episode}}',
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
