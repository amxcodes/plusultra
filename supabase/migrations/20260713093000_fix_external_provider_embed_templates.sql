-- Normalize externally managed provider templates to the app-supported token syntax.
-- The app replaces {{tmdbId}}, {{season}}, and {{episode}} before loading embeds.

UPDATE public.player_providers AS pp
SET
  movie_embed_template = v.movie_embed_template,
  tv_embed_template = v.tv_embed_template,
  enabled = v.enabled,
  updated_at = now()
FROM (
  VALUES
    (
      'filmu',
      true,
      'https://embed.filmu.in/movie/{{tmdbId}}',
      'https://embed.filmu.in/tv/{{tmdbId}}/{{season}}/{{episode}}'
    ),
    (
      'vidapi.ru',
      true,
      'https://vidapi.ru/embed/movie/{{tmdbId}}',
      'https://vidapi.ru/embed/tv/{{tmdbId}}/{{season}}/{{episode}}'
    ),
    (
      'kimostream',
      true,
      'https://embed.kimostream.eu.org/?id={{tmdbId}}',
      'https://embed.kimostream.eu.org/?id={{tmdbId}}&season={{season}}&episode={{episode}}'
    ),
    (
      'chill',
      false,
      'https://chillflix.pw/embed/movie/{{tmdbId}}?autoplay=true&startAt=120',
      'https://chillflix.pw/embed/tv/{{tmdbId}}/{{season}}/{{episode}}?autoplay=true&autonext=true'
    ),
    (
      'icefy',
      false,
      'https://embed.icefy.top/movie?id={{tmdbId}}',
      'https://embed.icefy.top/tv?id={{tmdbId}}&season={{season}}&episode={{episode}}'
    )
) AS v(id, enabled, movie_embed_template, tv_embed_template)
WHERE pp.id = v.id;
