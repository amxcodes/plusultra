-- ==============================================================================
-- 🛡️ LINT FIXES & PERFORMANCE HARDENING (V2 - Expanded)
-- ==============================================================================
-- This migration addresses security warnings (search_path) and performance issues (RLS)
-- identified in the Supabase Lint Report.
--
-- ROLLBACK: Run supabase/migrations/rollback_lint_fixes.sql
-- ==============================================================================

-- ==============================================================================
-- 1. SECURITY: FIX SEARCH_PATH MUTABILITY
-- ==============================================================================
ALTER FUNCTION public.like_playlist(p_playlist_id UUID) SET search_path = public;
ALTER FUNCTION public.unlike_playlist(p_playlist_id UUID) SET search_path = public;
ALTER FUNCTION public.track_playlist_view(p_playlist_id UUID) SET search_path = public;
ALTER FUNCTION public.get_playlist_collaboration_stats(p_playlist_id UUID) SET search_path = public;
ALTER FUNCTION public.user_can_view_playlist(p_playlist_id UUID) SET search_path = public;
ALTER FUNCTION public.user_can_edit_playlist(p_playlist_id UUID) SET search_path = public;
ALTER FUNCTION public.is_playlist_collaborator(p_playlist_id UUID, p_user_id UUID) SET search_path = public;
ALTER FUNCTION public.is_playlist_owner(p_playlist_id UUID, p_user_id UUID) SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_watch_history_with_stats'
      AND pg_function_is_visible(oid)
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_watch_history_with_stats(uuid, text, text, int, text[], jsonb) SET search_path = public';
  END IF;
END $$;

ALTER FUNCTION public.update_watch_history_v2(uuid, text, jsonb, text) SET search_path = public;
ALTER FUNCTION public.prune_watch_history() SET search_path = public;
ALTER FUNCTION public.clear_my_watch_history() SET search_path = public;
ALTER FUNCTION public.calculate_taste_compatibility(user_a UUID, user_b UUID) SET search_path = public;
ALTER FUNCTION public.upsert_friend_compatibility(UUID, UUID, INTEGER, JSONB) SET search_path = public;
ALTER FUNCTION public.get_community_stats(uuid) SET search_path = public;
ALTER FUNCTION public.refresh_community_stats_cache() SET search_path = public;

ALTER FUNCTION public.admin_delete_user(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.check_registration_enabled() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_parties() SET search_path = public;
ALTER FUNCTION public.generate_invite_code() SET search_path = public;

ALTER FUNCTION public.handle_reply_vote(UUID, INT) SET search_path = public;
ALTER FUNCTION public.auto_fulfill_request() SET search_path = public;
ALTER FUNCTION public.notify_playlist_invite() SET search_path = public;
ALTER FUNCTION public.increment_server_vote(text, text, int, int, text) SET search_path = public;

-- ==============================================================================
-- 2. PERFORMANCE: OPTIMIZE RLS (Fix auth.uid() re-evaluation)
-- ==============================================================================
-- Replacing `auth.uid()` with `(select auth.uid())` prevents execution per-row.

-- Table: profiles
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (id = (select auth.uid()));

-- Table: playlists
DROP POLICY IF EXISTS "playlists_insert" ON public.playlists; 
DROP POLICY IF EXISTS "playlists_insert_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert_optimized" ON public.playlists;
CREATE POLICY "playlists_insert_optimized" ON public.playlists FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "playlists_delete" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_optimized" ON public.playlists;
CREATE POLICY "playlists_delete_optimized" ON public.playlists FOR DELETE USING (
    user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

-- Table: playlist_likes
DROP POLICY IF EXISTS "Users can like playlists" ON public.playlist_likes;
CREATE POLICY "Users can like playlists" ON public.playlist_likes FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can unlike playlists" ON public.playlist_likes;
CREATE POLICY "Users can unlike playlists" ON public.playlist_likes FOR DELETE USING (user_id = (select auth.uid()));

-- Table: playlist_collaborators
DROP POLICY IF EXISTS "collaborators_view_own" ON public.playlist_collaborators;
CREATE POLICY "collaborators_view_own" ON public.playlist_collaborators FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "collaborators_insert" ON public.playlist_collaborators;
CREATE POLICY "collaborators_insert" ON public.playlist_collaborators FOR INSERT WITH CHECK (is_playlist_owner(playlist_id, (select auth.uid()))); 

DROP POLICY IF EXISTS "collaborators_update" ON public.playlist_collaborators;
CREATE POLICY "collaborators_update" ON public.playlist_collaborators FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "collaborators_delete" ON public.playlist_collaborators;
CREATE POLICY "collaborators_delete" ON public.playlist_collaborators FOR DELETE USING (is_playlist_owner(playlist_id, (select auth.uid())));

-- Table: notifications
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (false);

-- Table: watch_history
DROP POLICY IF EXISTS "Users can view own history" ON public.watch_history;
DROP POLICY IF EXISTS "Admins can view all history" ON public.watch_history;
DROP POLICY IF EXISTS "Users can insert/update own history" ON public.watch_history;
DROP POLICY IF EXISTS "Users can update own history" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_select" ON public.watch_history; 
DROP POLICY IF EXISTS "watch_history_insert_update" ON public.watch_history;

CREATE POLICY "watch_history_select" ON public.watch_history FOR SELECT USING (
    user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);
CREATE POLICY "watch_history_insert_update" ON public.watch_history FOR ALL USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));


-- Table: movie_requests
DROP POLICY IF EXISTS "Users can create requests" ON public.movie_requests;
CREATE POLICY "Users can create requests" ON public.movie_requests FOR INSERT WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update requests" ON public.movie_requests;
CREATE POLICY "Admins can update requests" ON public.movie_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can delete requests" ON public.movie_requests;
CREATE POLICY "Admins can delete requests" ON public.movie_requests FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

-- Table: request_replies
DROP POLICY IF EXISTS "Users can add replies" ON public.request_replies;
CREATE POLICY "Users can add replies" ON public.request_replies FOR INSERT WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can delete replies" ON public.request_replies;
CREATE POLICY "Admins can delete replies" ON public.request_replies FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

-- Table: reply_votes
DROP POLICY IF EXISTS "Users can vote" ON public.reply_votes;
CREATE POLICY "Users can vote" ON public.reply_votes FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can change their vote" ON public.reply_votes;
CREATE POLICY "Users can change their vote" ON public.reply_votes FOR UPDATE USING (user_id = (select auth.uid()));

-- Table: announcements
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "announcements_manage_admin" ON public.announcements;
CREATE POLICY "announcements_manage_admin" ON public.announcements FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

-- Table: featured_sections
DROP POLICY IF EXISTS "Admins can manage sections" ON public.featured_sections;
DROP POLICY IF EXISTS "featured_sections_manage_admin" ON public.featured_sections;
CREATE POLICY "featured_sections_manage_admin" ON public.featured_sections FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

-- Table: upcoming_events
DROP POLICY IF EXISTS "Admins can manage events" ON public.upcoming_events;
DROP POLICY IF EXISTS "upcoming_events_manage_admin" ON public.upcoming_events;
CREATE POLICY "upcoming_events_manage_admin" ON public.upcoming_events FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

-- Table: follows
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (follower_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (follower_id = (select auth.uid()));

-- Table: featured_movies
DROP POLICY IF EXISTS "Admins can manage featured movies" ON public.featured_movies;
DROP POLICY IF EXISTS "featured_movies_manage_admin" ON public.featured_movies;
CREATE POLICY "featured_movies_manage_admin" ON public.featured_movies FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
);

-- Table: watch_parties
DROP POLICY IF EXISTS "Users can create parties" ON public.watch_parties;
CREATE POLICY "Users can create parties" ON public.watch_parties FOR INSERT WITH CHECK (host_id = (select auth.uid()));

DROP POLICY IF EXISTS "Host can update party" ON public.watch_parties;
CREATE POLICY "Host can update party" ON public.watch_parties FOR UPDATE USING (host_id = (select auth.uid()));

DROP POLICY IF EXISTS "Host can delete party" ON public.watch_parties;
CREATE POLICY "Host can delete party" ON public.watch_parties FOR DELETE USING (host_id = (select auth.uid()));

-- Table: server_votes
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.server_votes;
CREATE POLICY "Authenticated users can vote" ON public.server_votes FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Table: friend_compatibility
DROP POLICY IF EXISTS "Users can view their own compatibility" ON public.friend_compatibility;
CREATE POLICY "Users can view their own compatibility" ON public.friend_compatibility FOR SELECT USING (user_a = (select auth.uid()) OR user_b = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert/update their own compatibility" ON public.friend_compatibility;
DROP POLICY IF EXISTS "Users can update their own compatibility" ON public.friend_compatibility;
DROP POLICY IF EXISTS "friend_compatibility_manage_own" ON public.friend_compatibility;
CREATE POLICY "friend_compatibility_manage_own" ON public.friend_compatibility FOR ALL USING (user_a = (select auth.uid()) OR user_b = (select auth.uid())) WITH CHECK (user_a = (select auth.uid()) OR user_b = (select auth.uid()));

-- Table: playlist_items
DROP POLICY IF EXISTS "playlist_items_select" ON public.playlist_items; 
DROP POLICY IF EXISTS "playlist_items_select_optimized" ON public.playlist_items;
CREATE POLICY "playlist_items_select_optimized" ON public.playlist_items FOR SELECT USING (user_can_view_playlist(playlist_id));


-- ==============================================================================
-- 3. CLEANUP: REMOVE REDUNDANT POLICIES (Consolidation)
-- ==============================================================================

-- app_settings
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public read access" ON public.app_settings; 
DROP POLICY IF EXISTS "app_settings_select_public" ON public.app_settings; -- Drop self if exists
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings; -- Drop self if exists

CREATE POLICY "app_settings_select_public" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_admin_all" ON public.app_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin'));

-- announcements
DROP POLICY IF EXISTS "Announcements are viewable by everyone" ON public.announcements;
DROP POLICY IF EXISTS "announcements_select_public" ON public.announcements;
CREATE POLICY "announcements_select_public" ON public.announcements FOR SELECT USING (true);

-- featured_movies
DROP POLICY IF EXISTS "Featured movies viewable by everyone" ON public.featured_movies;
DROP POLICY IF EXISTS "featured_movies_select_public" ON public.featured_movies;
CREATE POLICY "featured_movies_select_public" ON public.featured_movies FOR SELECT USING (true);

-- featured_sections
DROP POLICY IF EXISTS "Featured sections viewable by everyone" ON public.featured_sections;
DROP POLICY IF EXISTS "featured_sections_select_public" ON public.featured_sections;
CREATE POLICY "featured_sections_select_public" ON public.featured_sections FOR SELECT USING (is_active = true);

-- upcoming_events
DROP POLICY IF EXISTS "Events viewable by everyone" ON public.upcoming_events;
DROP POLICY IF EXISTS "upcoming_events_select_public" ON public.upcoming_events;
CREATE POLICY "upcoming_events_select_public" ON public.upcoming_events FOR SELECT USING (is_active = true);

-- playlist_likes
DROP POLICY IF EXISTS "Anyone can view likes" ON public.playlist_likes;
DROP POLICY IF EXISTS "playlist_likes_select_public" ON public.playlist_likes;
CREATE POLICY "playlist_likes_select_public" ON public.playlist_likes FOR SELECT USING (true);

-- profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);


-- ==============================================================================
-- 4. CLEANUP: DUPLICATE INDEXES
-- ==============================================================================
DROP INDEX IF EXISTS public.idx_playlist_items_playlist;
