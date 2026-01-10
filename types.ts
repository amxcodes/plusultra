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
  LATEST = 'Latest',
  MY_LIST = 'My List',
  SETTINGS = 'Settings'
}