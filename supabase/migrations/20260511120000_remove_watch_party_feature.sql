-- Remove the abandoned database-backed watch-party feature.
-- Future watch-party work should start from a cleaner realtime architecture.

DO $$
BEGIN
  DELETE FROM public.notifications
  WHERE type = 'watch_party_invite';

  DROP FUNCTION IF EXISTS public.accept_watch_party_room_invite(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.cleanup_stale_watch_party_rooms(integer) CASCADE;
  DROP FUNCTION IF EXISTS public.create_watch_party_room(text, text, integer, integer, text) CASCADE;
  DROP FUNCTION IF EXISTS public.create_watch_party_room_invites(uuid, uuid[]) CASCADE;
  DROP FUNCTION IF EXISTS public.decline_watch_party_room_invite(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.end_my_active_watch_party_rooms() CASCADE;
  DROP FUNCTION IF EXISTS public.end_watch_party_room(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.generate_watch_party_room_code() CASCADE;
  DROP FUNCTION IF EXISTS public.get_user_active_watch_party_room_id(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.get_watch_party_room(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.is_watch_party_room_active_member(uuid, uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.join_watch_party_room(text) CASCADE;
  DROP FUNCTION IF EXISTS public.join_watch_party_room_by_id(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.leave_watch_party_room(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.list_public_profile_presence(uuid[]) CASCADE;
  DROP FUNCTION IF EXISTS public.list_watch_party_host_presence(uuid[]) CASCADE;
  DROP FUNCTION IF EXISTS public.list_watch_party_room_invites(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.list_watch_party_room_members(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.list_watch_party_room_messages(uuid, integer) CASCADE;
  DROP FUNCTION IF EXISTS public.list_watch_party_source_candidates(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.revoke_watch_party_room_invite(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.send_watch_party_room_message(uuid, text) CASCADE;
  DROP FUNCTION IF EXISTS public.set_watch_party_member_ready(uuid, boolean) CASCADE;
  DROP FUNCTION IF EXISTS public.start_watch_party_countdown(uuid, integer) CASCADE;
  DROP FUNCTION IF EXISTS public.touch_watch_party_candidate_updated_at() CASCADE;
  DROP FUNCTION IF EXISTS public.touch_watch_party_member_presence(uuid) CASCADE;
  DROP FUNCTION IF EXISTS public.touch_watch_party_room_updated_at() CASCADE;
  DROP FUNCTION IF EXISTS public.update_watch_party_playback(uuid, double precision, boolean, text) CASCADE;
  DROP FUNCTION IF EXISTS public.update_watch_party_selected_source(uuid, text, text, text, text, jsonb, text, text) CASCADE;
  DROP FUNCTION IF EXISTS public.upsert_watch_party_source_candidate(uuid, text, text, text, text, text, text, text, text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS public.upsert_watch_party_source_candidate(uuid, text, text, text, text, text, text, text, text, jsonb, text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS public.upsert_watch_party_source_candidate(uuid, text, text, text, text, text, text, text, text, jsonb, timestamp with time zone, text, text, text) CASCADE;

  DROP TABLE IF EXISTS public.watch_party_room_messages CASCADE;
  DROP TABLE IF EXISTS public.watch_party_room_invites CASCADE;
  DROP TABLE IF EXISTS public.watch_party_source_candidates CASCADE;
  DROP TABLE IF EXISTS public.watch_party_room_members CASCADE;
  DROP TABLE IF EXISTS public.watch_party_rooms CASCADE;

  DROP TABLE IF EXISTS public.watch_parties CASCADE;
  DROP FUNCTION IF EXISTS public.cleanup_expired_parties() CASCADE;
  DROP FUNCTION IF EXISTS public.generate_invite_code() CASCADE;
END $$;
