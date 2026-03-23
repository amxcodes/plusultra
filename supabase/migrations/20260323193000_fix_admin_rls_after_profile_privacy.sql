-- Fix admin-aware RLS after profile privacy hardening.
-- Several policies still read public.profiles.role directly, which now breaks
-- after role/can_stream access was revoked from normal table reads.

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO service_role;

CREATE OR REPLACE FUNCTION public.is_playlist_collaborator(p_playlist_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.playlist_collaborators
    WHERE playlist_id = p_playlist_id
      AND user_id = p_user_id
      AND status = 'accepted'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_playlist_owner(p_playlist_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.playlists
    WHERE id = p_playlist_id
      AND user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_playlist(p_playlist_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_public boolean;
  v_is_featured boolean;
  v_owner_id uuid;
BEGIN
  SELECT is_public, is_featured, user_id
  INTO v_is_public, v_is_featured, v_owner_id
  FROM public.playlists
  WHERE id = p_playlist_id;

  RETURN (
    v_is_public = true
    OR v_is_featured = true
    OR v_owner_id = v_user_id
    OR public.is_current_user_admin()
    OR public.is_playlist_collaborator(p_playlist_id, v_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_playlist(p_playlist_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_is_editor boolean;
BEGIN
  SELECT user_id
  INTO v_owner_id
  FROM public.playlists
  WHERE id = p_playlist_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.playlist_collaborators
    WHERE playlist_id = p_playlist_id
      AND user_id = v_user_id
      AND status = 'accepted'
      AND role = 'editor'
  )
  INTO v_is_editor;

  RETURN (
    v_owner_id = v_user_id
    OR public.is_current_user_admin()
    OR v_is_editor
  );
END;
$$;

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE
USING (
  id = (select auth.uid())
  OR public.is_current_user_admin()
)
WITH CHECK (
  id = (select auth.uid())
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "playlists_select" ON public.playlists;
CREATE POLICY "playlists_select"
ON public.playlists FOR SELECT
USING (public.user_can_view_playlist(id));

DROP POLICY IF EXISTS "playlists_delete" ON public.playlists;
CREATE POLICY "playlists_delete"
ON public.playlists FOR DELETE
USING (
  user_id = (select auth.uid())
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "collaborators_select" ON public.playlist_collaborators;
CREATE POLICY "collaborators_select"
ON public.playlist_collaborators FOR SELECT
USING (
  user_id = (select auth.uid())
  OR public.is_playlist_owner(playlist_id, (select auth.uid()))
  OR public.is_playlist_collaborator(playlist_id, (select auth.uid()))
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "collaborators_insert" ON public.playlist_collaborators;
CREATE POLICY "collaborators_insert"
ON public.playlist_collaborators FOR INSERT
WITH CHECK (
  public.is_playlist_owner(playlist_id, (select auth.uid()))
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "collaborators_update" ON public.playlist_collaborators;
CREATE POLICY "collaborators_update"
ON public.playlist_collaborators FOR UPDATE
USING (
  user_id = (select auth.uid())
  OR public.is_playlist_owner(playlist_id, (select auth.uid()))
  OR public.is_current_user_admin()
)
WITH CHECK (
  user_id = (select auth.uid())
  OR public.is_playlist_owner(playlist_id, (select auth.uid()))
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "collaborators_delete" ON public.playlist_collaborators;
CREATE POLICY "collaborators_delete"
ON public.playlist_collaborators FOR DELETE
USING (
  user_id = (select auth.uid())
  OR public.is_playlist_owner(playlist_id, (select auth.uid()))
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "announcements_admin_insert" ON public.announcements;
CREATE POLICY "announcements_admin_insert"
ON public.announcements FOR INSERT
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "announcements_admin_update" ON public.announcements;
CREATE POLICY "announcements_admin_update"
ON public.announcements FOR UPDATE
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "announcements_admin_delete" ON public.announcements;
CREATE POLICY "announcements_admin_delete"
ON public.announcements FOR DELETE
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "app_settings_admin_insert" ON public.app_settings;
CREATE POLICY "app_settings_admin_insert"
ON public.app_settings FOR INSERT
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "app_settings_admin_update" ON public.app_settings;
CREATE POLICY "app_settings_admin_update"
ON public.app_settings FOR UPDATE
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "app_settings_admin_delete" ON public.app_settings;
CREATE POLICY "app_settings_admin_delete"
ON public.app_settings FOR DELETE
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "featured_movies_admin_insert" ON public.featured_movies;
CREATE POLICY "featured_movies_admin_insert"
ON public.featured_movies FOR INSERT
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "featured_movies_admin_update" ON public.featured_movies;
CREATE POLICY "featured_movies_admin_update"
ON public.featured_movies FOR UPDATE
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "featured_movies_admin_delete" ON public.featured_movies;
CREATE POLICY "featured_movies_admin_delete"
ON public.featured_movies FOR DELETE
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "featured_sections_select_public" ON public.featured_sections;
CREATE POLICY "featured_sections_select_public"
ON public.featured_sections FOR SELECT
USING (
  is_active = true
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "featured_sections_admin_insert" ON public.featured_sections;
CREATE POLICY "featured_sections_admin_insert"
ON public.featured_sections FOR INSERT
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "featured_sections_admin_update" ON public.featured_sections;
CREATE POLICY "featured_sections_admin_update"
ON public.featured_sections FOR UPDATE
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "featured_sections_admin_delete" ON public.featured_sections;
CREATE POLICY "featured_sections_admin_delete"
ON public.featured_sections FOR DELETE
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "upcoming_events_select_public" ON public.upcoming_events;
CREATE POLICY "upcoming_events_select_public"
ON public.upcoming_events FOR SELECT
USING (
  is_active = true
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "upcoming_events_admin_insert" ON public.upcoming_events;
CREATE POLICY "upcoming_events_admin_insert"
ON public.upcoming_events FOR INSERT
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "upcoming_events_admin_update" ON public.upcoming_events;
CREATE POLICY "upcoming_events_admin_update"
ON public.upcoming_events FOR UPDATE
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "upcoming_events_admin_delete" ON public.upcoming_events;
CREATE POLICY "upcoming_events_admin_delete"
ON public.upcoming_events FOR DELETE
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Authenticated users can read enabled providers" ON public.player_providers;
CREATE POLICY "Authenticated users can read enabled providers"
ON public.player_providers FOR SELECT
USING (
  (select auth.uid()) IS NOT NULL
  AND (
    enabled = true
    OR public.is_current_user_admin()
  )
);

DROP POLICY IF EXISTS "Admins can manage providers" ON public.player_providers;
CREATE POLICY "Admins can manage providers"
ON public.player_providers FOR ALL
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());
