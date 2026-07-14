import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Clapperboard, Play } from 'lucide-react';
import { Movie } from '../../../types';
import { TmdbService } from '../../../services/tmdb';
import { StudioButton } from '../system/StudioButton';
import { StudioMediaCard } from '../media/StudioMediaCard';
import { StudioSkeleton } from '../system/StudioSkeleton';
import { StudioProviderMark, studioProviders } from '../system/StudioProviderBrand';

interface StudioNewsPageProps {
  onMovieSelect: (movie: Movie) => void;
}

const posterFor = (movie: Movie) => movie.posterUrl || movie.imageUrl || movie.backdropUrl;

export const StudioNewsPage: React.FC<StudioNewsPageProps> = ({ onMovieSelect }) => {
  const [activeProvider, setActiveProvider] = useState(studioProviders[0]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [hero, setHero] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void TmdbService.getByProvider(activeProvider.id)
      .then(async (results) => {
        if (cancelled) return;
        setMovies(results);
        if (!results[0]) {
          setHero(null);
          return;
        }

        const detailed = await TmdbService.getDetails(results[0].id.toString(), results[0].mediaType || 'movie');
        if (!cancelled) setHero(detailed as Movie);
      })
      .catch(() => {
        if (!cancelled) {
          setMovies([]);
          setHero(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProvider]);

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-20 md:px-8 md:pt-28">
      <header className="mb-8 flex flex-col gap-5 border-b border-white/[0.08] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-normal text-white md:text-5xl">What&apos;s new</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/52">Fresh arrivals and current picks from the services you follow.</p>
        </div>
        <div className="studio-row-mask -mx-1 overflow-hidden pb-1 pt-1 lg:max-w-[58%]">
          <div className="flex w-max gap-2 px-1">
            {studioProviders.map((provider) => {
              const selected = activeProvider.id === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setActiveProvider(provider)}
                  aria-pressed={selected}
                  className={`studio-news-provider ${selected ? 'studio-news-provider--selected' : ''}`}
                >
                  <StudioProviderMark provider={provider} />
                  <span>{provider.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
          <StudioSkeleton className="aspect-[16/8]" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            <StudioSkeleton className="aspect-[2/3]" />
            <StudioSkeleton className="aspect-[2/3]" />
          </div>
        </div>
      ) : hero ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
          <article
            className="group relative isolate min-h-[400px] cursor-pointer overflow-hidden rounded-[var(--studio-radius-lg)] border border-white/[0.09] bg-white/[0.035] shadow-[0_24px_70px_rgba(0,0,0,0.44)] md:min-h-[470px]"
            onClick={() => onMovieSelect(hero)}
          >
            <img src={hero.backdropUrl || posterFor(hero)} alt={hero.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0.12)_78%),linear-gradient(to_top,rgba(0,0,0,0.82),transparent_55%)]" />
            <div className="relative flex h-full min-h-[400px] max-w-xl flex-col justify-end p-6 md:min-h-[470px] md:p-9">
              <span className="studio-news-provider-tag">Now on {activeProvider.name}</span>
              <h2 className="mt-4 line-clamp-2 text-3xl font-black leading-[1.02] tracking-normal text-white md:text-5xl">{hero.title}</h2>
              <p className="mt-3 line-clamp-3 max-w-lg text-sm leading-6 text-white/70 md:text-base md:leading-7">{hero.description || 'A new pick ready for your next watch.'}</p>
              <div className="mt-6">
                <StudioButton type="button" variant="glass" size="lg" onClick={(event) => { event.stopPropagation(); onMovieSelect(hero); }}>
                  <Play size={16} fill="currentColor" /> Open title
                </StudioButton>
              </div>
            </div>
          </article>

          <aside className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            {movies.slice(1, 3).map((movie) => (
              <button key={movie.id} type="button" onClick={() => onMovieSelect(movie)} className="studio-news-spotlight group text-left">
                <img src={posterFor(movie)} alt={movie.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="relative mt-auto p-4">
                  <div className="line-clamp-2 text-sm font-bold leading-5 text-white">{movie.title}</div>
                  <div className="mt-1 text-xs text-white/54">{movie.year || 'Now streaming'}</div>
                </div>
              </button>
            ))}
          </aside>
        </div>
      ) : (
        <div className="rounded-[var(--studio-radius-lg)] border border-white/[0.08] bg-white/[0.035] px-6 py-16 text-center text-sm text-white/48">No arrivals are available from this service right now.</div>
      )}

      {!loading && movies.length > 1 && (
        <div className="mt-12">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-white"><Clapperboard size={18} /> Latest arrivals</div>
              <div className="mt-1 text-sm text-white/45">More from {activeProvider.name}</div>
            </div>
            <div className="hidden items-center gap-1 text-sm font-semibold text-white/48 sm:flex">Browse titles <ArrowUpRight size={15} /></div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {movies.slice(1).map((movie) => (
              <div key={`${movie.mediaType || 'movie'}-${movie.id}`} className="min-w-0">
                <StudioMediaCard movie={movie} onSelect={onMovieSelect} />
                <button type="button" onClick={() => onMovieSelect(movie)} className="mt-2 w-full truncate text-left text-sm font-semibold text-white/88 transition-colors hover:text-white">
                  {movie.title}
                </button>
                <div className="mt-0.5 text-xs text-white/42">{movie.year || activeProvider.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
