-- ===============================================
-- NEON DATABASE - COMPLETE SCHEMA MIGRATION
-- ===============================================
-- This file contains the complete schema for Neon PostgreSQL
-- Run this FIRST in your Neon SQL Editor
-- ===============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===============================================
-- TABLE: app_settings
-- ===============================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('site_url', ''),
  ('donation_url', ''),
  ('registration_enabled', 'true'),
  ('clear_history_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ===============================================
-- TABLE: profiles
-- ===============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  watch_history JSONB DEFAULT '{}'::jsonb,
  stats JSONB DEFAULT '{}'::jsonb,
  recent_searches JSONB DEFAULT '[]'::jsonb,
  last_seen_announcements TIMESTAMPTZ DEFAULT NOW(),
  last_seen_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ===============================================
-- TABLE: playlists
-- ===============================================
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  type TEXT DEFAULT 'custom' CHECK (type IN ('custom', 'watch_later', 'favorites', 'curated')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON public.playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_is_public ON public.playlists(is_public);
CREATE INDEX IF NOT EXISTS idx_playlists_is_featured ON public.playlists(is_featured) WHERE is_featured = TRUE;

-- ===============================================
-- TABLE: playlist_items
-- ===============================================
CREATE TABLE IF NOT EXISTS public.playlist_items (
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
  tmdb_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  metadata JSONB,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playlist_id, tmdb_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON public.playlist_items(playlist_id);

-- ===============================================
-- TABLE: announcements
-- ===============================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id UUID REFERENCES public.profiles(id) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

-- ===============================================
-- TABLE: featured_sections
-- ===============================================
CREATE TABLE IF NOT EXISTS public.featured_sections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_featured_sections_display_order ON public.featured_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_featured_sections_is_active ON public.featured_sections(is_active) WHERE is_active = TRUE;

-- ===============================================
-- TABLE: featured_movies
-- ===============================================
CREATE TABLE IF NOT EXISTS public.featured_movies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  section_id UUID REFERENCES public.featured_sections(id) ON DELETE CASCADE NOT NULL,
  tmdb_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  metadata JSONB NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_featured_movies_section_id ON public.featured_movies(section_id);
CREATE INDEX IF NOT EXISTS idx_featured_movies_display_order ON public.featured_movies(display_order);

-- ===============================================
-- TABLE: upcoming_events
-- ===============================================
CREATE TABLE IF NOT EXISTS public.upcoming_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  tmdb_id TEXT,
  media_type TEXT CHECK (media_type IN ('movie', 'tv')),
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upcoming_events_event_date ON public.upcoming_events(event_date);
CREATE INDEX IF NOT EXISTS idx_upcoming_events_is_active ON public.upcoming_events(is_active) WHERE is_active = TRUE;

-- ===============================================
-- TABLE: follows
-- ===============================================
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);

-- ===============================================
-- TABLE: watch_parties
-- ===============================================
CREATE TABLE IF NOT EXISTS public.watch_parties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES public.profiles(id) NOT NULL,
  tmdb_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  season INTEGER,
  episode INTEGER,
  join_code TEXT UNIQUE NOT NULL,
  state JSONB DEFAULT '{}'::jsonb,
  max_participants INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watch_parties_join_code ON public.watch_parties(join_code);
CREATE INDEX IF NOT EXISTS idx_watch_parties_host_id ON public.watch_parties(host_id);
CREATE INDEX IF NOT EXISTS idx_watch_parties_is_active ON public.watch_parties(is_active) WHERE is_active = TRUE;

-- ===============================================
-- TABLE: party_participants
-- ===============================================
CREATE TABLE IF NOT EXISTS public.party_participants (
  party_id UUID REFERENCES public.watch_parties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (party_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_party_participants_party_id ON public.party_participants(party_id);
CREATE INDEX IF NOT EXISTS idx_party_participants_user_id ON public.party_participants(user_id);

-- ===============================================
-- TABLE: server_votes
-- ===============================================
CREATE TABLE IF NOT EXISTS public.server_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tmdb_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  season INTEGER DEFAULT 1,
  episode INTEGER DEFAULT 1,
  provider_id TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tmdb_id, media_type, season, episode, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_server_votes_lookup ON public.server_votes(tmdb_id, media_type, season, episode);

-- ===============================================
-- TABLE: community_stats
-- ===============================================
CREATE TABLE IF NOT EXISTS public.community_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  trending_daily JSONB DEFAULT '[]'::jsonb,
  trending_weekly JSONB DEFAULT '[]'::jsonb,
  most_watched_all_time JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.community_stats (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ===============================================
-- FUNCTION: update_watch_history
-- ===============================================
CREATE OR REPLACE FUNCTION update_watch_history(
  p_user_id UUID,
  p_tmdb_id TEXT,
  p_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  current_stats JSONB;
  current_history JSONB;
  is_new_item BOOLEAN;
  media_type TEXT;
  previous_last_watched TIMESTAMPTZ;
  days_since_last_watch INT;
  current_streak INT;
  genres JSONB;
  genre_name TEXT;
  current_month TEXT;
  current_year INT;
BEGIN
  -- 1. Fetch current data
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

  -- 2. Initialize stats with Wrapped fields
  IF current_stats IS NULL THEN 
    current_stats := jsonb_build_object(
      'total_movies', 0,
      'total_shows', 0,
      'streak_days', 0,
      'max_streak', 0,
      'genre_counts', '{}'::jsonb,
      'monthly_watches', '{}'::jsonb,
      'first_watch_of_year', null,
      'year', extract(year from now())
    );
  END IF;
  
  IF current_history IS NULL THEN 
    current_history := '{}'::jsonb; 
  END IF;

  -- Ensure all wrapped fields exist
  IF current_stats->'genre_counts' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{genre_counts}', '{}'::jsonb);
  END IF;
  IF current_stats->'max_streak' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', '0'::jsonb);
  END IF;
  IF current_stats->'monthly_watches' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{monthly_watches}', '{}'::jsonb);
  END IF;
  IF current_stats->'year' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{year}', to_jsonb(extract(year from now())::int));
  END IF;

  -- 3. Extract metadata
  media_type := p_data->>'type';
  genres := p_data->'genres';
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- 4. Update watch history
  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

  -- 5. Update counters if new item
  IF is_new_item THEN
    IF media_type = 'movie' THEN
      current_stats := jsonb_set(current_stats, '{total_movies}', 
        ((current_stats->>'total_movies')::int + 1)::text::jsonb);
    ELSIF media_type = 'tv' THEN
      current_stats := jsonb_set(current_stats, '{total_shows}', 
        ((current_stats->>'total_shows')::int + 1)::text::jsonb);
    END IF;

    -- Update genre counts
    IF genres IS NOT NULL AND jsonb_typeof(genres) = 'array' THEN
      FOR genre_name IN SELECT jsonb_array_elements_text(genres)
      LOOP
        current_stats := jsonb_set(
          current_stats,
          array['genre_counts', genre_name],
          (COALESCE((current_stats->'genre_counts'->>genre_name)::int, 0) + 1)::text::jsonb
        );
      END LOOP;
    END IF;
  END IF;

  -- 6. Calculate streak
  previous_last_watched := (current_stats->>'last_watched')::timestamptz;
  current_streak := COALESCE((current_stats->>'streak_days')::int, 0);
  
  IF previous_last_watched IS NULL THEN
    current_streak := 1;
  ELSE
    days_since_last_watch := CURRENT_DATE - DATE(previous_last_watched);
    
    IF days_since_last_watch = 0 THEN
      current_streak := current_streak;
    ELSIF days_since_last_watch = 1 THEN
      current_streak := current_streak + 1;
    ELSE
      current_streak := 1;
    END IF;
  END IF;
  
  current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb);
  current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()));

  -- 7. Track max streak
  IF current_streak > COALESCE((current_stats->>'max_streak')::int, 0) THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', current_streak::text::jsonb);
  END IF;

  -- 8. Track monthly watches
  current_month := to_char(now(), 'YYYY-MM');
  current_stats := jsonb_set(
    current_stats, 
    array['monthly_watches', current_month], 
    (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb
  );

  -- 9. Track first watch of year
  current_year := extract(year from now());
  IF current_stats->'first_watch_of_year' IS NULL OR
     COALESCE((current_stats->'first_watch_of_year'->>'year')::int, 0) < current_year THEN
    current_stats := jsonb_set(current_stats, '{first_watch_of_year}', jsonb_build_object(
      'tmdb_id', p_tmdb_id,
      'title', p_data->>'title',
      'date', current_date::text,
      'type', media_type,
      'year', current_year
    ));
  END IF;

  -- 10. Update year tracker
  IF COALESCE((current_stats->>'year')::int, 0) < current_year THEN
    current_stats := jsonb_set(current_stats, '{year}', current_year::text::jsonb);
  END IF;

  -- 11. Save
  UPDATE public.profiles
  SET 
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;
END;
$$;

-- ===============================================
-- FUNCTION: increment_server_vote
-- ===============================================
CREATE OR REPLACE FUNCTION increment_server_vote(
  p_tmdb_id TEXT,
  p_media_type TEXT,
  p_season INTEGER,
  p_episode INTEGER,
  p_provider_id TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.server_votes (tmdb_id, media_type, season, episode, provider_id, vote_count)
  VALUES (p_tmdb_id, p_media_type, p_season, p_episode, p_provider_id, 1)
  ON CONFLICT (tmdb_id, media_type, season, episode, provider_id)
  DO UPDATE SET 
    vote_count = server_votes.vote_count + 1,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- ✅ SCHEMA MIGRATION COMPLETE
-- ===============================================
