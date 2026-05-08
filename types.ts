export interface Movie {
  id: number;
  title: string;
  year?: number;
  match: number;
  imageUrl: string;
  posterUrl?: string; // Poster image URL
  backdropUrl?: string; // New
  description?: string;
  trailerKey?: string;
  trailerSite?: string;
  trailerName?: string;
  genre?: string[];
  duration?: string | number; // Can be string for display or number for progress calc
  director?: string;
  cast?: string[];
  tagline?: string;
  mediaType?: 'movie' | 'tv';
  tmdbId?: number;
  seasons?: { id: number; name: string; season_number: number; episode_count: number; poster_path?: string }[]; // Updated
  screenshots?: string[]; // New
  genreIds?: number[]; // For filtering
  popularity?: number; // For sorting
  addedBy?: {
    username: string;
    avatarUrl?: string;
  };
  addedByUserId?: string; // ID of the user who added this
  // Watch progress properties
  time?: number; // Current position in seconds
  progress?: number; // Progress percentage (0-100)
  timeLeft?: number; // Time remaining in seconds
  season?: number;
  episode?: number;
}

export interface OfflineDownloadEntry {
  id: string;
  tmdbId: number;
  title: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  year?: number;
  imageUrl: string;
  backdropUrl?: string;
  description?: string;
  genre?: string[];
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  sourceUrl: string;
  status: 'downloading' | 'completed' | 'failed' | 'cancelled';
  providerId?: string;
  providerName?: string;
  createdAt: string;
  completedAt?: string;
  bytesReceived?: number;
  totalBytes?: number;
}

export interface SharedMoviePayload {
  tmdbId: number;
  title: string;
  mediaType: 'movie' | 'tv';
  year?: number;
  imageUrl: string;
  backdropUrl?: string;
  description?: string;
}

export interface DirectConversation {
  id: string;
  participantIds: [string, string];
  otherProfile: Profile;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message_preview?: string | null;
  last_message_sender_id?: string | null;
  unread_count: number;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'text' | 'movie_share';
  body?: string | null;
  shared_movie?: SharedMoviePayload | null;
  created_at: string;
  read_at?: string | null;
  reply_to_message_id?: string | null;
  reply_preview?: DirectMessageReplyPreview | null;
  reactions?: DirectMessageReaction[];
}

export interface DirectMessageReplyPreview {
  id: string;
  sender_id: string;
  body?: string | null;
  message_type: 'text' | 'movie_share';
  shared_movie_title?: string | null;
}

export interface DirectMessageReaction {
  message_id: string;
  conversation_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface DirectTypingPresence {
  conversation_id: string;
  user_id: string;
  started_at: string;
  updated_at: string;
}

export type WatchPartySourceState = 'pending' | 'portable' | 'guest_recheck' | 'host_only';
export type WatchPartyRoomStatus = 'setup' | 'ready' | 'live' | 'ended';

export interface WatchPartySelectedSource {
  providerId: string;
  providerLabel: string;
  serverId?: string | null;
  serverLabel?: string | null;
  candidateId: string;
  resolvedUrl: string;
  sourceType: 'mp4' | 'm3u8' | 'mpd' | 'unknown';
  qualityLabel?: string | null;
  requiredHeaders?: Record<string, string> | null;
  expiresAt?: string | null;
  portability: WatchPartySourceState;
  note?: string | null;
  resolvedAt: string;
}

export interface WatchPartyRoom {
  id: string;
  room_code: string;
  host_id: string;
  tmdb_id: string;
  media_type: 'movie' | 'tv';
  season?: number | null;
  episode?: number | null;
  title?: string | null;
  provider_id?: string | null;
  provider_label?: string | null;
  server_id?: string | null;
  server_label?: string | null;
  selected_source?: WatchPartySelectedSource | null;
  source_state: WatchPartySourceState;
  status: WatchPartyRoomStatus;
  current_time_seconds: number;
  is_paused: boolean;
  countdown_started_at?: string | null;
  countdown_seconds?: number | null;
  playback_updated_at?: string | null;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
}

export interface WatchPartyMember {
  room_id: string;
  user_id: string;
  role: 'host' | 'guest';
  state: 'joined' | 'ready' | 'left';
  joined_at: string;
  ready_at?: string | null;
  last_seen_at?: string | null;
  profile?: Profile;
}

export interface WatchPartySourceCandidate {
  room_id: string;
  candidate_id: string;
  provider_id: string;
  provider_label?: string | null;
  server_id?: string | null;
  server_label?: string | null;
  resolved_url: string;
  source_type: 'mp4' | 'm3u8' | 'mpd' | 'unknown';
  quality_label?: string | null;
  required_headers?: Record<string, string> | null;
  expires_at?: string | null;
  portability: WatchPartySourceState;
  status: 'discovered' | 'selected' | 'failed';
  note?: string | null;
  discovered_by: string;
  created_at: string;
  updated_at: string;
}

export interface WatchPartyRoomMessage {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
}

export interface WatchPartyInvite {
  id: string;
  room_id: string;
  sender_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string;
  responded_at?: string | null;
  recipient_profile?: Profile;
}

export interface WatchPartyHostPresence {
  host_id: string;
  room_id: string;
  room_code: string;
  title?: string | null;
  media_type: 'movie' | 'tv';
  season?: number | null;
  episode?: number | null;
  status: WatchPartyRoomStatus;
  started_at: string;
}

export type PublicPresenceState = 'hosting' | 'watching' | 'online' | 'idle' | 'offline';

export interface PublicProfilePresence {
  user_id: string;
  state: PublicPresenceState;
  last_seen_at?: string | null;
  activity_mode?: string | null;
  room_id?: string | null;
  room_code?: string | null;
  room_title?: string | null;
  room_media_type?: 'movie' | 'tv' | null;
  room_season?: number | null;
  room_episode?: number | null;
  room_status?: WatchPartyRoomStatus | null;
  watch_title?: string | null;
  viewer_is_following: boolean;
  viewer_has_pending_invite: boolean;
  viewer_is_room_member: boolean;
  is_joinable: boolean;
}

export interface HeroMovie extends Movie {
  tagline?: string;
  genre?: string[];
  duration?: string;
  director?: string;
  cast?: string[];
}

export enum NavItem {
  DASHBOARD = 'Dashboard',
  DOWNLOAD_QUEST = 'Download Quest',
  MESSAGES = 'Messages',
  MOVIES = 'Movies',
  SERIES = 'Series',
  ANIME = 'Anime',
  ASIAN_DRAMA = 'Asian Drama',
  FOR_YOU = 'For You',
  CURATOR = 'Curator Lab',
  MY_LIST = 'My List',
  SETTINGS = 'Settings',
  PROFILE = 'Profile',
  ADMIN = 'Admin',
  ANNOUNCEMENTS = 'Announcements',
  ACTIVITY = 'Activity',
  PLAYLISTS = 'Playlists',
  STATS = 'Stats',
  NEWS = 'News',
  REQUESTS = 'Requests'
}

export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  role?: 'user' | 'admin' | 'moderator';
  account_kind?: 'standard' | 'guest';
  guest_expires_at?: string | null;
  guest_created_by?: string | null;
  guest_secured_at?: string | null;
  guest_link_id?: string | null;
  is_guest_hidden?: boolean;
  recent_searches?: string[];
  can_stream?: boolean; // Permission to access streaming features
  likes_count?: number; // Total likes received
  created_at?: string; // When user joined
  stats?: {
    total_movies?: number;
    total_shows?: number;
    watch_time?: number;
  };
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  is_featured?: boolean;
  type: 'custom' | 'watch_later' | 'favorites' | 'curated';
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string;
  };
  items?: { metadata?: { poster_path?: string } }[]; // Sneak peek items
  items_count?: number; // Number of items in playlist
  likes_count?: number;
  analytics?: {
    total_views: number;
    weekly_views: number;
    monthly_views: number;
  };
}

export interface PlaylistCollaborator {
  id: string;
  playlist_id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'playlist_invite' | 'watch_party_invite' | 'system' | 'follow' | 'playlist_liked' | 'follower_new_playlist' | 'direct_message';
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

export interface TasteCompatibility {
  score: number;
  shared: string[];
  message?: string;
}

export interface CollaborationStats {
  user_id: string;
  username: string;
  avatar_url: string;
  items_added: number;
  role: 'owner' | 'editor' | 'viewer';
}
