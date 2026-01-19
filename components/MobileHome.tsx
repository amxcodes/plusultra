import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { HeroMovie, Movie, Playlist, NavItem } from '../types';
import { MobileHero } from './MobileHero';
import { MobileRow } from './MobileRow';
import { PlaylistRow } from './PlaylistRow';
import { requests } from '../services/tmdb';
import { LibraryBig } from 'lucide-react';

interface MobileHomeProps {
    heroMovie: HeroMovie | null;
    featuredMovies: Movie[];
    featuredPlaylists: Playlist[];
    continueWatching: Movie[];
    myList: Movie[];
    activeTab: NavItem;
    viewAllCategory: any; // Using exact type from App used is complex, any for simplicity in this separation
    onPlay: (movie: Movie) => void;
    onMovieSelect: (movie: Movie) => void;
    onPlaylistSelect: (playlist: Playlist) => void;
    onAddToPlaylist: (movie: Movie) => void;
    onViewAll: (category: any) => void;
}

export const MobileHome: React.FC<MobileHomeProps> = ({
    heroMovie,
    featuredMovies,
    featuredPlaylists,
    continueWatching,
    myList,
    activeTab,
    viewAllCategory,
    onPlay,
    onMovieSelect,
    onPlaylistSelect,
    onAddToPlaylist,
    onViewAll
}) => {
    const { profile } = useAuth();
    const canStream = profile?.can_stream || profile?.role === 'admin';


    const renderDashboard = () => (
        <>
            <MobileHero
                movie={heroMovie || {
                    id: 0,
                    title: "Loading...",
                    year: 2024,
                    match: 0,
                    imageUrl: "",
                    backdropUrl: "",
                    description: ""
                } as HeroMovie}
                onPlay={(m) => onPlay(m as Movie)}
                onAddToPlaylist={(m) => onAddToPlaylist(m as Movie)}
            />

            <div className="flex flex-col gap-2 pb-24">
                {continueWatching.length > 0 && canStream && (
                    <MobileRow
                        title="Continue Watching"
                        movies={continueWatching}
                        onMovieSelect={onMovieSelect}
                        variant="continue-watching"
                        onViewAll={() => onViewAll({ title: "Continue Watching", movies: continueWatching })}
                    />
                )}

                {featuredMovies.length > 0 && (
                    <MobileRow
                        title="Featured Movies"
                        movies={featuredMovies}
                        onMovieSelect={onMovieSelect}
                        onViewAll={() => onViewAll({ title: "Featured Movies", movies: featuredMovies })}
                    />
                )}

                {featuredPlaylists.length > 0 && (
                    <PlaylistRow
                        title="Featured Playlists"
                        playlists={featuredPlaylists}
                        onPlaylistSelect={onPlaylistSelect}
                    />
                )}

                <MobileRow title="Trending Now" fetchUrl={requests.fetchTrending} onMovieSelect={onMovieSelect} isLarge onViewAll={() => onViewAll({ title: "Trending Now", fetchUrl: requests.fetchTrending })} />
                <MobileRow title="Top Rated" fetchUrl={requests.fetchTopRated} onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Top Rated", fetchUrl: requests.fetchTopRated })} />
                <MobileRow title="Action Blockbusters" fetchUrl={requests.fetchActionMovies} onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Action Blockbusters", fetchUrl: requests.fetchActionMovies })} />
                <MobileRow title="Comedy Hits" fetchUrl={requests.fetchComedyMovies} onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Comedy Hits", fetchUrl: requests.fetchComedyMovies })} />
                <MobileRow title="Scary Movies" fetchUrl={requests.fetchHorrorMovies} onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Scary Movies", fetchUrl: requests.fetchHorrorMovies })} />
                <MobileRow title="Romance" fetchUrl={requests.fetchRomanceMovies} onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Romance", fetchUrl: requests.fetchRomanceMovies })} />
                <MobileRow title="Documentaries" fetchUrl={requests.fetchDocumentaries} onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Documentaries", fetchUrl: requests.fetchDocumentaries })} />
            </div>
        </>
    );

    const renderMoviesOnly = () => (
        <div className="pt-20 pb-24 flex flex-col gap-4">
            <MobileRow title="Trending Movies" fetchUrl={requests.fetchTrending} forcedMediaType='movie' onMovieSelect={onMovieSelect} isLarge onViewAll={() => onViewAll({ title: "Trending Movies", fetchUrl: requests.fetchTrending, forcedMediaType: 'movie' })} />
            <MobileRow title="Top Rated Movies" fetchUrl={requests.fetchTopRated} forcedMediaType='movie' onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Top Rated Movies", fetchUrl: requests.fetchTopRated, forcedMediaType: 'movie' })} />
            <MobileRow title="Action" fetchUrl={requests.fetchActionMovies} forcedMediaType='movie' onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Action", fetchUrl: requests.fetchActionMovies, forcedMediaType: 'movie' })} />
            <MobileRow title="Comedy" fetchUrl={requests.fetchComedyMovies} forcedMediaType='movie' onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Comedy", fetchUrl: requests.fetchComedyMovies, forcedMediaType: 'movie' })} />
            <MobileRow title="Horror" fetchUrl={requests.fetchHorrorMovies} forcedMediaType='movie' onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Horror", fetchUrl: requests.fetchHorrorMovies, forcedMediaType: 'movie' })} />
        </div>
    );

    const renderSeriesOnly = () => (
        <div className="pt-20 pb-24 flex flex-col gap-4">
            <MobileRow title="Trending TV" fetchUrl={requests.fetchNetflixOriginals} forcedMediaType='tv' onMovieSelect={onMovieSelect} isLarge onViewAll={() => onViewAll({ title: "Trending TV", fetchUrl: requests.fetchNetflixOriginals, forcedMediaType: 'tv' })} />
            <MobileRow title="Top Rated TV" fetchUrl={requests.fetchTopRated} forcedMediaType='tv' onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Top Rated TV", fetchUrl: requests.fetchTopRated, forcedMediaType: 'tv' })} />
            <MobileRow title="Action & Adventure" fetchUrl={requests.fetchActionMovies} forcedMediaType='tv' onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Action & Adventure", fetchUrl: requests.fetchActionMovies, forcedMediaType: 'tv' })} />
            <MobileRow title="Comedy Series" fetchUrl={requests.fetchComedyMovies} forcedMediaType='tv' onMovieSelect={onMovieSelect} onViewAll={() => onViewAll({ title: "Comedy Series", fetchUrl: requests.fetchComedyMovies, forcedMediaType: 'tv' })} />
        </div>
    );

    // Simplified My List for Mobile
    const renderMyList = () => (
        <div className="px-4 pt-20 pb-24">
            <h2 className="text-xl font-bold mb-4">My List</h2>
            {myList.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                    {myList.map(movie => (
                        <div key={movie.id} onClick={() => onMovieSelect(movie)} className="cursor-pointer">
                            <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-zinc-800">
                                <img src={movie.imageUrl} alt={movie.title} className="w-full h-full object-cover" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <LibraryBig size={40} className="text-zinc-500 mb-4" />
                    <p className="text-sm text-zinc-400">Your list is empty.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f1014] text-white">
            {activeTab === NavItem.DASHBOARD && !viewAllCategory && renderDashboard()}
            {activeTab === NavItem.MOVIES && !viewAllCategory && renderMoviesOnly()}
            {activeTab === NavItem.SERIES && !viewAllCategory && renderSeriesOnly()}
            {activeTab === NavItem.MY_LIST && renderMyList()}
            {/* Other tabs handled by main App conditional rendering for now if they are shared components like ProfilePage */}
        </div>
    );
};
