export interface Movie {
  id: number;
  title: string;
  year?: number;
  match: number;
  imageUrl: string;
  posterUrl?: string; // Poster image URL
  backdropUrl?: string; // New
  description?: string;
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
  type: 'playlist_invite' | 'system' | 'follow' | 'playlist_liked' | 'follower_new_playlist';
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
