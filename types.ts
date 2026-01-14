export interface Movie {
  id: number;
  title: string;
  year: number;
  match: number;
  imageUrl: string;
  backdropUrl?: string; // New
  description?: string;
  genre?: string[];
  duration?: string;
  director?: string;
  cast?: string[];
  tagline?: string;
  mediaType?: 'movie' | 'tv';
  tmdbId?: number;
  seasons?: { id: number; name: string; season_number: number; episode_count: number; poster_path?: string }[]; // Updated
  screenshots?: string[]; // New
  genreIds?: number[]; // For filtering
  popularity?: number; // For sorting
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
  MOVIES = 'Movies',
  SERIES = 'Series',
  ANIME = 'Anime',
  ASIAN_DRAMA = 'Asian Drama',
  FOR_YOU = 'For You',
  MY_LIST = 'My List',
  SETTINGS = 'Settings',
  PROFILE = 'Profile',
  ADMIN = 'Admin',
  ANNOUNCEMENTS = 'Announcements',
  ACTIVITY = 'Activity',
  PLAYLISTS = 'Playlists'
}

export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  role: 'user' | 'admin' | 'moderator';
  recent_searches?: string[];
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
  likes_count?: number;
  analytics?: {
    total_views: number;
    weekly_views: number;
    monthly_views: number;
  };
}