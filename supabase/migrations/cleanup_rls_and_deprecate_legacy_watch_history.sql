-- CLEAN UP REMAINING RLS POLICY SPRAWL
-- Also deprecates the unused legacy public.watch_history table so it no longer
-- looks active in audits while the app continues to use profiles.watch_history.

ALTER FUNCTION public.reset_viewing_stats(jsonb, boolean) SET search_path = public;

-- Shared admin check is repeated inline to avoid introducing another helper just
-- for policy expressions.

-- profiles
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE
USING (
  id = (select auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
)
WITH CHECK (
  id = (select auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- playlists
DROP POLICY IF EXISTS "playlists_select" ON public.playlists;
DROP POLICY IF EXISTS "playlists_select_policy" ON public.playlists;
DROP POLICY IF EXISTS "Public playlists are viewable by everyone." ON public.playlists;
DROP POLICY IF EXISTS "Users can view their own private playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can view all playlists." ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert" ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert_optimized" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update_policy" ON public.playlists;
DROP POLICY IF EXISTS "Users can update own playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can update all playlists." ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_optimized" ON public.playlists;
DROP POLICY IF EXISTS "Users can delete own playlists." ON public.playlists;

CREATE POLICY "playlists_select"
ON public.playlists FOR SELECT
USING (
  is_public = true
  OR is_featured = true
  OR user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
  OR (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.playlist_collaborators pc
      WHERE pc.playlist_id = playlists.id
        AND pc.user_id = (select auth.uid())
        AND pc.status = 'accepted'
    )
  )
);

CREATE POLICY "playlists_insert"
ON public.playlists FOR INSERT
WITH CHECK (
  (select auth.uid()) IS NOT NULL
  AND user_id = (select auth.uid())
);

CREATE POLICY "playlists_update"
ON public.playlists FOR UPDATE
USING (user_can_edit_playlist(id))
WITH CHECK (user_can_edit_playlist(id));

CREATE POLICY "playlists_delete"
ON public.playlists FOR DELETE
USING (
  user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- playlist_likes
DROP POLICY IF EXISTS "Anyone can view likes" ON public.playlist_likes;
DROP POLICY IF EXISTS "likes_select" ON public.playlist_likes;
DROP POLICY IF EXISTS "playlist_likes_select_public" ON public.playlist_likes;
DROP POLICY IF EXISTS "Users can like playlists" ON public.playlist_likes;
DROP POLICY IF EXISTS "likes_insert" ON public.playlist_likes;
DROP POLICY IF EXISTS "Users can unlike playlists" ON public.playlist_likes;
DROP POLICY IF EXISTS "likes_delete" ON public.playlist_likes;

CREATE POLICY "playlist_likes_select_public"
ON public.playlist_likes FOR SELECT
USING (true);

CREATE POLICY "playlist_likes_insert_own"
ON public.playlist_likes FOR INSERT
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "playlist_likes_delete_own"
ON public.playlist_likes FOR DELETE
USING (user_id = (select auth.uid()));

-- playlist_collaborators
DROP POLICY IF EXISTS "View own collaborations" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Playlist owners manage collaborators" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Playlist owners delete collaborators" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Accept own invites" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_select_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_select_as_owner" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_select_policy" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_view_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_insert" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_update" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_update_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_delete" ON public.playlist_collaborators;

CREATE POLICY "collaborators_select"
ON public.playlist_collaborators FOR SELECT
USING (
  user_id = (select auth.uid())
  OR is_playlist_owner(playlist_id, (select auth.uid()))
  OR is_playlist_collaborator(playlist_id, (select auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "collaborators_insert"
ON public.playlist_collaborators FOR INSERT
WITH CHECK (
  is_playlist_owner(playlist_id, (select auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "collaborators_update"
ON public.playlist_collaborators FOR UPDATE
USING (
  user_id = (select auth.uid())
  OR is_playlist_owner(playlist_id, (select auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
)
WITH CHECK (
  user_id = (select auth.uid())
  OR is_playlist_owner(playlist_id, (select auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "collaborators_delete"
ON public.playlist_collaborators FOR DELETE
USING (
  user_id = (select auth.uid())
  OR is_playlist_owner(playlist_id, (select auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- announcements
DROP POLICY IF EXISTS "Announcements are viewable by everyone" ON public.announcements;
DROP POLICY IF EXISTS "announcements_select_public" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "announcements_manage_admin" ON public.announcements;

CREATE POLICY "announcements_select_public"
ON public.announcements FOR SELECT
USING (true);

CREATE POLICY "announcements_admin_insert"
ON public.announcements FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "announcements_admin_update"
ON public.announcements FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "announcements_admin_delete"
ON public.announcements FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- app_settings
DROP POLICY IF EXISTS "Settings viewable by everyone" ON public.app_settings;
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public read access" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_select_public" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;

CREATE POLICY "app_settings_select_public"
ON public.app_settings FOR SELECT
USING (true);

CREATE POLICY "app_settings_admin_insert"
ON public.app_settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "app_settings_admin_update"
ON public.app_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "app_settings_admin_delete"
ON public.app_settings FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- community_stats_cache
DROP POLICY IF EXISTS "Community stats cache readable by everyone" ON public.community_stats_cache;
DROP POLICY IF EXISTS "Only system can update cache" ON public.community_stats_cache;

CREATE POLICY "community_stats_cache_select_public"
ON public.community_stats_cache FOR SELECT
USING (true);

-- featured_movies
DROP POLICY IF EXISTS "Featured movies viewable by everyone" ON public.featured_movies;
DROP POLICY IF EXISTS "featured_movies_select_public" ON public.featured_movies;
DROP POLICY IF EXISTS "Admins can manage featured movies" ON public.featured_movies;
DROP POLICY IF EXISTS "featured_movies_manage_admin" ON public.featured_movies;

CREATE POLICY "featured_movies_select_public"
ON public.featured_movies FOR SELECT
USING (true);

CREATE POLICY "featured_movies_admin_insert"
ON public.featured_movies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "featured_movies_admin_update"
ON public.featured_movies FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "featured_movies_admin_delete"
ON public.featured_movies FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- featured_sections
DROP POLICY IF EXISTS "Featured sections viewable by everyone" ON public.featured_sections;
DROP POLICY IF EXISTS "featured_sections_select_public" ON public.featured_sections;
DROP POLICY IF EXISTS "Admins can manage sections" ON public.featured_sections;
DROP POLICY IF EXISTS "featured_sections_manage_admin" ON public.featured_sections;

CREATE POLICY "featured_sections_select_public"
ON public.featured_sections FOR SELECT
USING (
  is_active = true
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "featured_sections_admin_insert"
ON public.featured_sections FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "featured_sections_admin_update"
ON public.featured_sections FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "featured_sections_admin_delete"
ON public.featured_sections FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- friend_compatibility
DROP POLICY IF EXISTS "Users can view their own compatibility" ON public.friend_compatibility;
DROP POLICY IF EXISTS "Users can insert/update their own compatibility" ON public.friend_compatibility;
DROP POLICY IF EXISTS "Users can update their own compatibility" ON public.friend_compatibility;
DROP POLICY IF EXISTS "friend_compatibility_manage_own" ON public.friend_compatibility;

CREATE POLICY "friend_compatibility_select_own"
ON public.friend_compatibility FOR SELECT
USING (
  user_a = (select auth.uid())
  OR user_b = (select auth.uid())
);

CREATE POLICY "friend_compatibility_insert_own"
ON public.friend_compatibility FOR INSERT
WITH CHECK (
  user_a = (select auth.uid())
  OR user_b = (select auth.uid())
);

CREATE POLICY "friend_compatibility_update_own"
ON public.friend_compatibility FOR UPDATE
USING (
  user_a = (select auth.uid())
  OR user_b = (select auth.uid())
)
WITH CHECK (
  user_a = (select auth.uid())
  OR user_b = (select auth.uid())
);

CREATE POLICY "friend_compatibility_delete_own"
ON public.friend_compatibility FOR DELETE
USING (
  user_a = (select auth.uid())
  OR user_b = (select auth.uid())
);

-- upcoming_events
DROP POLICY IF EXISTS "Events viewable by everyone" ON public.upcoming_events;
DROP POLICY IF EXISTS "upcoming_events_select_public" ON public.upcoming_events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.upcoming_events;
DROP POLICY IF EXISTS "upcoming_events_manage_admin" ON public.upcoming_events;

CREATE POLICY "upcoming_events_select_public"
ON public.upcoming_events FOR SELECT
USING (
  is_active = true
  OR EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "upcoming_events_admin_insert"
ON public.upcoming_events FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "upcoming_events_admin_update"
ON public.upcoming_events FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

CREATE POLICY "upcoming_events_admin_delete"
ON public.upcoming_events FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (select auth.uid())
      AND admin_profile.role = 'admin'
  )
);

-- legacy watch_history table
DROP POLICY IF EXISTS "Users can view own history" ON public.watch_history;
DROP POLICY IF EXISTS "Admins can view all history" ON public.watch_history;
DROP POLICY IF EXISTS "Users can insert/update own history" ON public.watch_history;
DROP POLICY IF EXISTS "Users can update own history" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_select" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_insert_update" ON public.watch_history;

REVOKE ALL ON TABLE public.watch_history FROM anon;
REVOKE ALL ON TABLE public.watch_history FROM authenticated;

COMMENT ON TABLE public.watch_history IS
  'LEGACY / DEPRECATED. The app now stores history in profiles.watch_history and session-based tracking in public.view_sessions. This table is retained only for archival compatibility.';
