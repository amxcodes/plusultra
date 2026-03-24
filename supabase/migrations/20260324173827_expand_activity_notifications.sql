ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('playlist_invite', 'system', 'follow', 'playlist_liked', 'follower_new_playlist'));

CREATE OR REPLACE FUNCTION public.notify_playlist_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_name text;
  inviter_name text;
BEGIN
  SELECT name INTO p_name FROM public.playlists WHERE id = NEW.playlist_id;
  SELECT split_part(username, '@', 1) INTO inviter_name
  FROM public.profiles
  WHERE id = (SELECT user_id FROM public.playlists WHERE id = NEW.playlist_id);

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'playlist_invite',
    'Playlist Invitation',
    COALESCE(inviter_name, 'Someone') || ' invited you to collaborate on "' || COALESCE(p_name, 'Untitled') || '"',
    jsonb_build_object('playlist_id', NEW.playlist_id, 'invite_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_playlist_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  playlist_owner_id uuid;
  playlist_name text;
  liker_name text;
BEGIN
  SELECT user_id, name
  INTO playlist_owner_id, playlist_name
  FROM public.playlists
  WHERE id = NEW.playlist_id;

  IF playlist_owner_id IS NULL OR playlist_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT split_part(username, '@', 1)
  INTO liker_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    playlist_owner_id,
    'playlist_liked',
    'Playlist Liked',
    COALESCE(liker_name, 'Someone') || ' liked your playlist "' || COALESCE(playlist_name, 'Untitled') || '"',
    jsonb_build_object(
      'playlist_id', NEW.playlist_id,
      'playlist_name', playlist_name,
      'actor_id', NEW.user_id,
      'actor_username', liker_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_playlist_like_notification ON public.playlist_likes;
CREATE TRIGGER on_playlist_like_notification
AFTER INSERT ON public.playlist_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_playlist_like();

CREATE OR REPLACE FUNCTION public.notify_followers_of_public_playlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_name text;
BEGIN
  IF NEW.is_public IS DISTINCT FROM true OR NEW.type NOT IN ('custom', 'curated') THEN
    RETURN NEW;
  END IF;

  SELECT split_part(username, '@', 1)
  INTO creator_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT
    follows.follower_id,
    'follower_new_playlist',
    'New Playlist',
    COALESCE(creator_name, 'Someone') || ' created a new playlist "' || COALESCE(NEW.name, 'Untitled') || '"',
    jsonb_build_object(
      'playlist_id', NEW.id,
      'playlist_name', NEW.name,
      'actor_id', NEW.user_id,
      'actor_username', creator_name
    )
  FROM public.follows
  WHERE follows.following_id = NEW.user_id
    AND follows.follower_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_public_playlist_created_notification ON public.playlists;
CREATE TRIGGER on_public_playlist_created_notification
AFTER INSERT ON public.playlists
FOR EACH ROW
EXECUTE FUNCTION public.notify_followers_of_public_playlist();
