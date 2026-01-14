import { Movie, HeroMovie } from '../types';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

// Helper to map TMDB result to our Movie interface
const mapTmdbToMovie = (item: any, forcedType?: 'movie' | 'tv'): Movie => {
    // Priority: Explicit force > API provided > Inference
    const type = forcedType || item.media_type || (item.name ? 'tv' : 'movie');

    return {
        id: item.id,
        title: item.title || item.name, // Movie has title, TV has name
        year: new Date(item.release_date || item.first_air_date || Date.now()).getFullYear(),
        match: Math.round(item.vote_average * 10), // Convert 8.5 to 85%
        imageUrl: item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : 'https://placehold.co/400x600?text=No+Image',
        backdropUrl: item.backdrop_path
            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
            : undefined,
        genre: [], // Populated separately or via genre map if needed
        genreIds: item.genre_ids,
        popularity: item.popularity,
        duration: '', // Not available in list view, requires detail fetch
        director: '', // Not available in list view
        description: item.overview,
        cast: [],
        mediaType: type
    };
};

export const requests = {
    fetchTrending: `/trending/all/week?api_key=${API_KEY}&language=en-US`,
    fetchNetflixOriginals: `/discover/tv?api_key=${API_KEY}&with_networks=213`,
    fetchTopRated: `/movie/top_rated?api_key=${API_KEY}&language=en-US`,
    fetchActionMovies: `/discover/movie?api_key=${API_KEY}&with_genres=28`,
    fetchComedyMovies: `/discover/movie?api_key=${API_KEY}&with_genres=35`,
    fetchHorrorMovies: `/discover/movie?api_key=${API_KEY}&with_genres=27`,
    fetchRomanceMovies: `/discover/movie?api_key=${API_KEY}&with_genres=10749`,
    fetchDocumentaries: `/discover/movie?api_key=${API_KEY}&with_genres=99`,
    fetchTvPopular: `/tv/popular?api_key=${API_KEY}&language=en-US`, // New
    fetchNowPlaying: `/movie/now_playing?api_key=${API_KEY}&language=en-US`,
    fetchUpcoming: `/movie/upcoming?api_key=${API_KEY}&language=en-US`,
    fetchAnimeTrending: `/discover/tv?api_key=${API_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc`,
    fetchAnimeMovies: `/discover/movie?api_key=${API_KEY}&with_genres=16&with_origin_country=JP&sort_by=vote_average.desc&vote_count.gte=200`,
    fetchAnimeAction: `/discover/tv?api_key=${API_KEY}&with_genres=16,28&with_origin_country=JP&sort_by=popularity.desc`,
    fetchAnimeRomance: `/discover/tv?api_key=${API_KEY}&with_genres=16,10749&sort_by=popularity.desc`,
    fetchAsianDramas: `/discover/tv?api_key=${API_KEY}&with_original_language=ko|zh|ja&with_genres=18&sort_by=popularity.desc`,
    fetchKDramas: `/discover/tv?api_key=${API_KEY}&with_original_language=ko&with_genres=18&sort_by=popularity.desc`,
    fetchCDramas: `/discover/tv?api_key=${API_KEY}&with_original_language=zh&with_genres=18&sort_by=popularity.desc`,
    fetchJDramas: `/discover/tv?api_key=${API_KEY}&with_original_language=ja&with_genres=18&without_genres=16&sort_by=popularity.desc`,
};

export const TmdbService = {
    getTrending: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            const res = await fetch(`${BASE_URL}${requests.fetchTrending}`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i));
        } catch (e) {
            console.error("TMDB Fetch Error", e);
            return [];
        }
    },

    getNowPlaying: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            const res = await fetch(`${BASE_URL}${requests.fetchNowPlaying}`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'movie'));
        } catch (e) {
            return [];
        }
    },

    getUpcoming: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            const res = await fetch(`${BASE_URL}${requests.fetchUpcoming}`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'movie'));
        } catch (e) {
            return [];
        }
    },

    getCategory: async (url: string, forcedType?: 'movie' | 'tv'): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            const res = await fetch(`${BASE_URL}${url}`);
            const data = await res.json();
            let results = data.results;

            if (forcedType) {
                // If strict type is requested, filter mixed results (like trending/all)
                // Note: 'discover' endpoints usually only return one type anyway, but this is safe for mixed lists.
                // However, endpoints like 'discover/movie' WON'T have media_type property on items usually.
                // So we only filter if media_type IS present and doesn't match.
                results = results.filter((i: any) => !i.media_type || i.media_type === forcedType);
            }

            return results.map((i: any) => mapTmdbToMovie(i, forcedType));
        } catch (e) {
            console.error("TMDB Fetch Error", e);
            return [];
        }
    },

    getDetails: async (id: string, type: 'movie' | 'tv'): Promise<Partial<Movie> & { numberOfSeasons?: number }> => {
        if (!API_KEY) return {};
        try {
            const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=credits,videos,images&include_image_language=en,null`);
            const data = await res.json();

            // Extract director / creator
            let director = '';
            if (type === 'movie') {
                director = data.credits?.crew?.find((p: any) => p.job === 'Director')?.name;
            } else {
                // For TV, use 'created_by'
                director = data.created_by?.map((c: any) => c.name).join(', ');
            }

            // Extract top 3 cast
            const cast = data.credits?.cast?.slice(0, 5).map((p: any) => p.name);

            // Extract Genres
            const genre = data.genres?.map((g: any) => g.name) || [];

            // Extract Screenshots (Backdrops)
            const screenshots = data.images?.backdrops?.slice(0, 6).map((img: any) => img.file_path) || [];

            // Extract duration / seasons
            const duration = type === 'movie'
                ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`
                : `${data.number_of_seasons} ${data.number_of_seasons === 1 ? 'Season' : 'Seasons'}`;

            // Sort seasons: Regular seasons first, then Specials (Season 0) at the end
            const seasons = data.seasons
                ? data.seasons.sort((a: any, b: any) => {
                    if (a.season_number === 0) return 1; // Move Season 0 to end
                    if (b.season_number === 0) return -1;
                    return a.season_number - b.season_number;
                })
                : [];

            return {
                ...mapTmdbToMovie(data),
                director,
                cast,
                duration,
                genre,
                screenshots, // Return screenshots
                numberOfSeasons: data.number_of_seasons,
                seasons: seasons // Return sorted list
            };
        } catch (e) {
            console.error("Details Error", e);
            return {};
        }
    },

    getSeasonDetails: async (tvId: string, seasonNumber: number): Promise<{ seasonId: number; episodes: { episode_number: number; id: number; name: string; overview: string; still_path: string | null; air_date: string; vote_average: number; runtime?: number }[] } | null> => {
        if (!API_KEY) return null;
        try {
            const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`);
            const data = await res.json();
            return {
                seasonId: data.id,
                episodes: data.episodes.map((e: any) => ({
                    episode_number: e.episode_number,
                    id: e.id,
                    name: e.name,
                    overview: e.overview,
                    still_path: e.still_path,
                    air_date: e.air_date ? e.air_date.split('-')[0] : '', // Just year
                    vote_average: e.vote_average,
                    runtime: e.runtime // Check if available
                }))
            };
        } catch (e) {
            console.error("Season Details Error", e);
            return null;
        }
    },

    getEpisodeDetails: async (tvId: string, season: number, episode: number): Promise<{ name: string; still_path: string | null; overview: string } | null> => {
        if (!API_KEY) return null;
        try {
            const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${season}/episode/${episode}?api_key=${API_KEY}`);
            const data = await res.json();
            return {
                name: data.name,
                still_path: data.still_path,
                overview: data.overview
            };
        } catch (e) {
            console.error("Episode Details Error", e);
            return null;
        }
    },

    getSimilar: async (id: string, type: 'movie' | 'tv'): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            const res = await fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${API_KEY}`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, type));
        } catch (e) {
            console.error("Similar Fetch Error", e);
            return [];
        }
    },

    getRecommendations: async (id: string, type: 'movie' | 'tv'): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            const res = await fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, type));
        } catch (e) {
            console.error("Recommendations Fetch Error", e);
            return [];
        }
    },

    search: async (query: string, filters?: { type?: 'movie' | 'tv' | 'multi'; year?: string; page?: number }): Promise<Movie[]> => {
        if (!API_KEY || !query) return [];
        try {
            // Default to multi search
            const type = filters?.type || 'multi';
            const page = filters?.page || 1;
            let url = `${BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&page=${page}`;

            // Append Year Filter if present
            if (filters?.year) {
                if (type === 'movie') {
                    url += `&primary_release_year=${filters.year}`;
                } else if (type === 'tv') {
                    url += `&first_air_date_year=${filters.year}`;
                }
                // Note: 'multi' search does not support strict year filtering in TMDB API V3
            }

            // Handle "All" (multi) with Year filter manually if needed, or split-fetch
            // For now, if 'multi' and year is set, we'll try to fetch both movie/tv specific endpoints to honor the year
            if (type === 'multi' && filters?.year) {
                const [movies, tv] = await Promise.all([
                    TmdbService.search(query, { type: 'movie', year: filters.year, page }),
                    TmdbService.search(query, { type: 'tv', year: filters.year, page })
                ]);
                // Interleave results for basic mixing
                const mixed: Movie[] = [];
                const maxLength = Math.max(movies.length, tv.length);
                for (let i = 0; i < maxLength; i++) {
                    if (movies[i]) mixed.push(movies[i]);
                    if (tv[i]) mixed.push(tv[i]);
                }
                return mixed;
            }

            const res = await fetch(url);
            const data = await res.json();

            let results = data.results;

            // If using 'multi', filter to only movie/tv
            if (type === 'multi') {
                results = results.filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv');
            }

            return results.map((i: any) => mapTmdbToMovie(i, type === 'multi' ? undefined : (type as 'movie' | 'tv')));
        } catch (e) {
            console.error("Search Fetch Error", e);
            return [];
        }
    },



    getAsianDramas: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Filter by original languages: Korean (ko), Chinese (zh), Japanese (ja) and Genre: Drama (18)
            const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=ko|zh|ja&with_genres=18&sort_by=popularity.desc`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'tv'));
        } catch (e) {
            return [];
        }
    },

    getAnime: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Genre 16: Animation. Origin Country: JP (Japan). Sort by popularity.
            const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'tv'));
        } catch (e) {
            return [];
        }
    },

    getAnimeMovies: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Top Rated Anime Movies (Genre 16 from JP)
            const res = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=16&with_origin_country=JP&sort_by=vote_average.desc&vote_count.gte=200`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'movie'));
        } catch (e) {
            return [];
        }
    },

    getActionAnime: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Action (28) + Animation (16) + Japan (JP)
            const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16,28&with_origin_country=JP&sort_by=popularity.desc`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'tv'));
        } catch (e) {
            return [];
        }
    },

    getRomanceAnime: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Romance (10749) + Animation (16) + Japan (JP)
            const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16,10749&with_origin_country=JP&sort_by=popularity.desc`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'tv'));
        } catch (e) {
            return [];
        }
    },

    getKDramas: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Korean Dramas: Language ko, Genre 18 (Drama)
            const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=ko&with_genres=18&sort_by=popularity.desc`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'tv'));
        } catch (e) {
            return [];
        }
    },

    getCDramas: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Chinese Dramas: Language zh, Genre 18 (Drama)
            const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=zh&with_genres=18&sort_by=popularity.desc`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'tv'));
        } catch (e) {
            return [];
        }
    },

    getJDramas: async (): Promise<Movie[]> => {
        if (!API_KEY) return [];
        try {
            // Japanese Dramas (Live Action): Language ja, Genre 18 (Drama), EXCLUDE Animation (16) to avoid anime appearing here
            const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=ja&with_genres=18&without_genres=16&sort_by=popularity.desc`);
            const data = await res.json();
            return data.results.map((i: any) => mapTmdbToMovie(i, 'tv'));
        } catch (e) {
            return [];
        }
    },

    getTmdbIdByTitle: async (title: string, year?: number): Promise<string | null> => {
        if (!API_KEY || !title) return null;
        try {
            // Search for TV show first (Anime is usually TV)
            const query = encodeURIComponent(title);
            const res = await fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&query=${query}`);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                // If year is provided, try to match closely, otherwise return first
                if (year) {
                    const match = data.results.find((m: any) =>
                        m.first_air_date && m.first_air_date.startsWith(year.toString())
                    );
                    return match ? match.id.toString() : data.results[0].id.toString();
                }
                return data.results[0].id.toString();
            }
            return null;
        } catch (e) {
            console.error("Error resolving TMDB ID", e);
            return null;
        }
    }
};
