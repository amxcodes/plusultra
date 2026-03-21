-- ==============================================================================
-- 🔙 ROLLBACK: LINT FIXES (V2 - Expanded)
-- ==============================================================================
-- Reverts security settings, RLS optimizations, and policy consolidations.
-- ==============================================================================

-- 1. REVERT SERIALIZABLE SEARCH_PATH
ALTER FUNCTION public.like_playlist(p_playlist_id UUID) RESET search_path;
ALTER FUNCTION public.unlike_playlist(p_playlist_id UUID) RESET search_path;
ALTER FUNCTION public.track_playlist_view(p_playlist_id UUID) RESET search_path;
ALTER FUNCTION public.get_playlist_collaboration_stats(p_playlist_id UUID) RESET search_path;
ALTER FUNCTION public.user_can_view_playlist(p_playlist_id UUID) RESET search_path;
ALTER FUNCTION public.user_can_edit_playlist(p_playlist_id UUID) RESET search_path;
ALTER FUNCTION public.is_playlist_collaborator(p_playlist_id UUID, p_user_id UUID) RESET search_path;
ALTER FUNCTION public.is_playlist_owner(p_playlist_id UUID, p_user_id UUID) RESET search_path;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_watch_history_with_stats'
      AND pg_function_is_visible(oid)
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_watch_history_with_stats(uuid, text, text, int, text[], jsonb) RESET search_path';
  END IF;
END $$;

ALTER FUNCTION public.update_watch_history_v2(uuid, text, jsonb, text) RESET search_path;
ALTER FUNCTION public.prune_watch_history() RESET search_path;
ALTER FUNCTION public.clear_my_watch_history() RESET search_path;
ALTER FUNCTION public.calculate_taste_compatibility(user_a UUID, user_b UUID) RESET search_path;
ALTER FUNCTION public.upsert_friend_compatibility(UUID, UUID, INTEGER, JSONB) RESET search_path;
ALTER FUNCTION public.get_community_stats(uuid) RESET search_path;
ALTER FUNCTION public.refresh_community_stats_cache() RESET search_path;

ALTER FUNCTION public.admin_delete_user(uuid) RESET search_path;
ALTER FUNCTION public.handle_new_user() RESET search_path;
ALTER FUNCTION public.check_registration_enabled() RESET search_path;
ALTER FUNCTION public.cleanup_expired_parties() RESET search_path;
ALTER FUNCTION public.generate_invite_code() RESET search_path;

ALTER FUNCTION public.handle_reply_vote(UUID, INT) RESET search_path;
ALTER FUNCTION public.auto_fulfill_request() RESET search_path;
ALTER FUNCTION public.notify_playlist_invite() RESET search_path;
ALTER FUNCTION public.increment_server_vote(text, text, int, int, text) RESET search_path;


-- 2. REVERT RLS POLICIES (Re-create originals)

-- Profiles
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Playlists
DROP POLICY IF EXISTS "playlists_insert_optimized" ON public.playlists;
CREATE POLICY "playlists_insert" ON public.playlists FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "playlists_delete_optimized" ON public.playlists;
CREATE POLICY "playlists_delete" ON public.playlists FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Playlist Likes
DROP POLICY IF EXISTS "Users can like playlists" ON public.playlist_likes;
CREATE POLICY "Users can like playlists" ON public.playlist_likes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can unlike playlists" ON public.playlist_likes;
CREATE POLICY "Users can unlike playlists" ON public.playlist_likes FOR DELETE USING (user_id = auth.uid());

-- Playlist Collaborators
DROP POLICY IF EXISTS "collaborators_view_own" ON public.playlist_collaborators;
CREATE POLICY "collaborators_view_own" ON public.playlist_collaborators FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "collaborators_insert" ON public.playlist_collaborators;
CREATE POLICY "collaborators_insert" ON public.playlist_collaborators FOR INSERT WITH CHECK (is_playlist_owner(playlist_id, auth.uid()));
DROP POLICY IF EXISTS "collaborators_update" ON public.playlist_collaborators;
CREATE POLICY "collaborators_update" ON public.playlist_collaborators FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "collaborators_delete" ON public.playlist_collaborators;
CREATE POLICY "collaborators_delete" ON public.playlist_collaborators FOR DELETE USING (is_playlist_owner(playlist_id, auth.uid()));

-- Notifications
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true);

-- Watch History
DROP POLICY IF EXISTS "watch_history_select" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_insert_update" ON public.watch_history;
CREATE POLICY "Users can view own history" ON public.watch_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all history" ON public.watch_history FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can insert/update own history" ON public.watch_history FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Movie Requests
DROP POLICY IF EXISTS "Users can create requests" ON public.movie_requests;
CREATE POLICY "Users can create requests" ON public.movie_requests FOR INSERT WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Admins can update requests" ON public.movie_requests;
CREATE POLICY "Admins can update requests" ON public.movie_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete requests" ON public.movie_requests;
CREATE POLICY "Admins can delete requests" ON public.movie_requests FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Request Replies
DROP POLICY IF EXISTS "Users can add replies" ON public.request_replies;
CREATE POLICY "Users can add replies" ON public.request_replies FOR INSERT WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Admins can delete replies" ON public.request_replies;
CREATE POLICY "Admins can delete replies" ON public.request_replies FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Reply Votes
DROP POLICY IF EXISTS "Users can vote" ON public.reply_votes;
CREATE POLICY "Users can vote" ON public.reply_votes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can change their vote" ON public.reply_votes;
CREATE POLICY "Users can change their vote" ON public.reply_votes FOR UPDATE USING (user_id = auth.uid());

-- Announcements
DROP POLICY IF EXISTS "announcements_manage_admin" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Featured Sections
DROP POLICY IF EXISTS "featured_sections_manage_admin" ON public.featured_sections;
CREATE POLICY "Admins can manage sections" ON public.featured_sections FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Upcoming Events
DROP POLICY IF EXISTS "upcoming_events_manage_admin" ON public.upcoming_events;
CREATE POLICY "Admins can manage events" ON public.upcoming_events FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Follows
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (follower_id = auth.uid());

-- Featured Movies
DROP POLICY IF EXISTS "featured_movies_manage_admin" ON public.featured_movies;
CREATE POLICY "Admins can manage featured movies" ON public.featured_movies FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Watch Parties
DROP POLICY IF EXISTS "Users can create parties" ON public.watch_parties;
CREATE POLICY "Users can create parties" ON public.watch_parties FOR INSERT WITH CHECK (host_id = auth.uid());
DROP POLICY IF EXISTS "Host can update party" ON public.watch_parties;
CREATE POLICY "Host can update party" ON public.watch_parties FOR UPDATE USING (host_id = auth.uid());
DROP POLICY IF EXISTS "Host can delete party" ON public.watch_parties;
CREATE POLICY "Host can delete party" ON public.watch_parties FOR DELETE USING (host_id = auth.uid());

-- Server Votes
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.server_votes;
CREATE POLICY "Authenticated users can vote" ON public.server_votes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Friend Compatibility
DROP POLICY IF EXISTS "Users can view their own compatibility" ON public.friend_compatibility;
CREATE POLICY "Users can view their own compatibility" ON public.friend_compatibility FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
DROP POLICY IF EXISTS "friend_compatibility_manage_own" ON public.friend_compatibility;
CREATE POLICY "Users can insert/update their own compatibility" ON public.friend_compatibility FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Users can update their own compatibility" ON public.friend_compatibility FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Playlist Items
DROP POLICY IF EXISTS "playlist_items_select_optimized" ON public.playlist_items;
-- Note: Reverting to complex legacy policy logic might be tricky without full query, assuming "playlist_items_select" was the original name or similar.
-- Logic was: exists ( select 1 from public.playlists p where p.id = playlist_items.playlist_id and (p.is_public = true or p.user_id = auth.uid()) )
CREATE POLICY "playlist_items_select" ON public.playlist_items FOR SELECT USING (
  exists ( select 1 from public.playlists p where p.id = playlist_items.playlist_id and (p.is_public = true or p.user_id = auth.uid()) )
);


-- 3. REVERT REDUNDANT POLICIES (Re-add them)

-- app_settings
DROP POLICY IF EXISTS "app_settings_select_public" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;
CREATE POLICY "Settings are viewable by everyone" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can update settings" ON public.app_settings FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- announcements
DROP POLICY IF EXISTS "announcements_select_public" ON public.announcements;
CREATE POLICY "Announcements are viewable by everyone" ON public.announcements FOR SELECT USING (true);

-- featured_movies
DROP POLICY IF EXISTS "featured_movies_select_public" ON public.featured_movies;
CREATE POLICY "Featured movies viewable by everyone" ON public.featured_movies FOR SELECT USING (true);

-- featured_sections
DROP POLICY IF EXISTS "featured_sections_select_public" ON public.featured_sections;
CREATE POLICY "Featured sections viewable by everyone" ON public.featured_sections FOR SELECT USING (is_active = true);

-- upcoming_events
DROP POLICY IF EXISTS "upcoming_events_select_public" ON public.upcoming_events;
CREATE POLICY "Events viewable by everyone" ON public.upcoming_events FOR SELECT USING (is_active = true);

-- playlist_likes
DROP POLICY IF EXISTS "playlist_likes_select_public" ON public.playlist_likes;
CREATE POLICY "Anyone can view likes" ON public.playlist_likes FOR SELECT USING (true);

-- profiles
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
