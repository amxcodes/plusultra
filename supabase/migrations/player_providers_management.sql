-- PLAYER PROVIDER MANAGEMENT
-- Admin-managed provider registry for embed and direct playback sources.

CREATE TABLE IF NOT EXISTS public.player_providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  render_mode text NOT NULL CHECK (render_mode IN ('embed', 'direct')),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  has_events boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  best_for text,
  movie_embed_template text,
  tv_embed_template text,
  movie_direct_template text,
  tv_direct_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_providers_sort_order
  ON public.player_providers(sort_order ASC, created_at ASC);

ALTER TABLE public.player_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read enabled providers" ON public.player_providers;
CREATE POLICY "Authenticated users can read enabled providers"
  ON public.player_providers FOR SELECT
  USING (
    enabled = true OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage providers" ON public.player_providers;
CREATE POLICY "Admins can manage providers"
  ON public.player_providers FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

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
  tv_embed_template
)
VALUES
  (
    'zxcplayer',
    'Server 1',
    'embed',
    true,
    10,
    false,
    'low',
    ARRAY['Fast', 'No Ads'],
    'Best Quality',
    'https://zxcstream.xyz/player/movie/{{tmdbId}}/en?autoplay=false&back=true&server=0',
    'https://zxcstream.xyz/player/tv/{{tmdbId}}/{{season}}/{{episode}}/en?autoplay=false&back=true&server=0'
  ),
  (
    'zxcembed',
    'Server 2',
    'embed',
    true,
    20,
    false,
    'low',
    ARRAY['Fast', 'No Ads'],
    'Alternative Player',
    'https://zxcstream.xyz/embed/movie/{{tmdbId}}',
    'https://zxcstream.xyz/embed/tv/{{tmdbId}}/{{season}}/{{episode}}'
  ),
  (
    'cinemaos',
    'Server 3',
    'embed',
    true,
    30,
    false,
    'low',
    ARRAY['Reliable'],
    'Backup',
    'https://zxcstream.xyz/player/movie/{{tmdbId}}/en?autoplay=false&back=true&server=0',
    'https://zxcstream.xyz/player/tv/{{tmdbId}}/{{season}}/{{episode}}/en?autoplay=false&back=true&server=0'
  ),
  (
    'aeon',
    'Server 4',
    'embed',
    true,
    40,
    false,
    'low',
    ARRAY['Reliable'],
    'Backup',
    'https://thisiscinema.pages.dev/?type=movie&version=v3&id={{tmdbId}}',
    'https://thisiscinema.pages.dev/?type=tv&version=v3&id={{tmdbId}}&season={{season}}&episode={{episode}}'
  ),
  (
    'cinezo',
    'Server 5',
    'embed',
    true,
    50,
    false,
    'low',
    ARRAY['Reliable'],
    'Backup',
    'https://api.cinezo.net/embed/tmdb-movie-{{tmdbId}}',
    'https://api.cinezo.net/embed/tmdb-tv-{{tmdbId}}/{{season}}/{{episode}}'
  ),
  (
    'rive',
    'Server 6',
    'embed',
    true,
    60,
    false,
    'high',
    ARRAY['Redirects'],
    'All Content',
    'https://rivestream.org/embed?type=movie&id={{tmdbId}}',
    'https://rivestream.org/embed?type=tv&id={{tmdbId}}&season={{season}}&episode={{episode}}'
  ),
  (
    'vidora',
    'Server 7',
    'embed',
    true,
    70,
    true,
    'high',
    ARRAY['Redirects'],
    'All Content',
    'https://vidora.su/movie/{{tmdbId}}?autoplay=false',
    'https://vidora.su/tv/{{tmdbId}}/{{season}}/{{episode}}?autoplay=false'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  render_mode = EXCLUDED.render_mode,
  sort_order = EXCLUDED.sort_order,
  has_events = EXCLUDED.has_events,
  risk_level = EXCLUDED.risk_level,
  tags = EXCLUDED.tags,
  best_for = EXCLUDED.best_for,
  movie_embed_template = EXCLUDED.movie_embed_template,
  tv_embed_template = EXCLUDED.tv_embed_template,
  updated_at = now();
