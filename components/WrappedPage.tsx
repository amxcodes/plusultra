import React, { useEffect, useState } from 'react';
import { X, Film, Flame, RotateCcw, TrendingUp, Clapperboard, Tv, CalendarRange, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';

interface WrappedStats {
    total_movies: number;
    total_shows: number;
    streak_days: number;
    max_streak: number;
    genre_counts: Record<string, number>;
    rewatch_count: number;
    binge_days: number;
    title_rewatch_counts: Record<string, number>;
    monthly_watches: Record<string, number>;
    daily_watch_count?: Record<string, number>;
    first_watch_of_year?: {
        title: string;
        date: string;
        type: string;
    };
    past_years?: Record<string, WrappedStats>;
}

interface CommunityStats {
    avg_total_content: number;
    median_total: number;
    user_percentile: {
        total_content: number;
        streak: number;
        rewatches: number;
    };
    user_stats: {
        total_content: number;
        movies: number;
        shows: number;
        streak: number;
        rewatches: number;
    };
}

type WrappedProfileResponse = {
    stats?: WrappedStats | null;
};

interface PredictiveInsights {
    projected_2027_total: number;
    confidence: 'high' | 'medium' | 'low';
    trending_genre: string | null;
    growth_rate: number;
    next_milestone: {
        type: string;
        target: number;
        remaining: number;
    };
}

interface WrappedPageProps {
    onClose: () => void;
}

type HighlightCardMap = {
    firstWatch?: Movie | null;
    topRewatch?: Movie | null;
    comfortShelf: Movie[];
};

const monthLabel = (monthKey?: string) => {
    if (!monthKey) return 'Unknown';
    const parsed = new Date(`${monthKey}-01`);
    if (Number.isNaN(parsed.getTime())) return monthKey;
    return parsed.toLocaleDateString('en-US', { month: 'long' });
};

const readableDate = (value?: string) => {
    if (!value) return 'Unknown date';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

const dedupeMovies = (items: Array<Movie | null | undefined>) => {
    const seen = new Set<string>();
    return items.filter((movie): movie is Movie => {
        if (!movie) return false;
        const key = String(movie.tmdbId || movie.id || movie.title).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const movieKey = (movie?: Movie | null) => movie ? String(movie.tmdbId || movie.id || movie.title).toLowerCase() : null;

const confidenceTone: Record<PredictiveInsights['confidence'], string> = {
    high: 'text-emerald-300',
    medium: 'text-amber-300',
    low: 'text-zinc-400'
};

const desktopSlideShell = 'px-16 pr-14 pl-36';

const WrappedSpotlight: React.FC<{
    eyebrow: string;
    title: string;
    subtitle: string;
    movie?: Movie | null;
    accent: 'violet' | 'amber';
}> = ({ eyebrow, title, subtitle, movie, accent }) => {
    const accentTone = accent === 'violet'
        ? {
            chip: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
            frame: 'border-violet-400/20',
            glow: 'shadow-[0_40px_120px_rgba(91,33,182,0.2)]',
            fallback: 'from-violet-500/25 via-fuchsia-500/10 to-zinc-950'
        }
        : {
            chip: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
            frame: 'border-amber-400/20',
            glow: 'shadow-[0_40px_120px_rgba(245,158,11,0.16)]',
            fallback: 'from-amber-500/25 via-orange-500/10 to-zinc-950'
        };

    return (
        <div className="grid h-full grid-cols-[1.08fr_0.72fr] gap-10">
            <div className="flex flex-col justify-center">
                <div className={`inline-flex w-fit items-center rounded-full border px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.32em] ${accentTone.chip}`}>
                    {eyebrow}
                </div>
                <h2 className="mt-7 max-w-xl text-6xl font-black leading-[0.9] tracking-tight text-white">
                    {title}
                </h2>
                <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
                    {subtitle}
                </p>
            </div>
            <div className="flex items-center justify-center">
            <div className={`relative aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-[36px] border bg-zinc-950/90 ${accentTone.frame} ${accentTone.glow}`}>
                <div className="absolute inset-0">
                    {movie?.imageUrl ? (
                        <img src={movie.imageUrl} alt={movie.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${accentTone.fallback}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_42%)]" />
                </div>
                <div className="absolute left-6 right-6 top-6 flex items-center justify-between">
                    <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-white/70 backdrop-blur-xl">
                        {movie?.mediaType === 'tv' ? 'Series' : 'Movie'}
                    </div>
                    {movie?.year ? (
                        <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-white/70 backdrop-blur-xl">
                            {movie.year}
                        </div>
                    ) : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6">
                    <div className="rounded-[28px] border border-white/10 bg-black/45 p-6 backdrop-blur-2xl">
                        {movie?.description ? (
                            <p className="line-clamp-4 text-sm leading-7 text-white/65">
                                {movie.description}
                            </p>
                        ) : (
                            <p className="text-sm leading-7 text-white/55">
                                A highlight card from your wrapped stream.
                            </p>
                        )}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export const WrappedPage: React.FC<WrappedPageProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<WrappedStats | null>(null);
    const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
    const [predictions, setPredictions] = useState<PredictiveInsights | null>(null);
    const [highlightCards, setHighlightCards] = useState<HighlightCardMap>({ comfortShelf: [] });
    const [currentSlide, setCurrentSlide] = useState(0);
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        fetchWrappedStats();
    }, []);

    useEffect(() => {
        if (!stats) return;
        hydrateHighlightCards(stats);
    }, [stats]);

    const fetchWrappedStats = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const minLoadTime = new Promise(resolve => setTimeout(resolve, 1800));
            const statsPromise = supabase.rpc('get_private_profile', { p_user_id: user.id }).single();

            const [result] = await Promise.all([statsPromise, minLoadTime]);
            const profile = result.data as WrappedProfileResponse | null;

            if (profile?.stats) {
                setStats(profile.stats);
                setPredictions(calculatePredictions(profile.stats));

                try {
                    const { data: communityData } = await supabase.rpc('get_community_stats', { p_user_id: user.id });
                    if (communityData) setCommunityStats(communityData);
                } catch (err) {
                    console.error('Community stats unavailable:', err);
                }
            }
        } catch (error) {
            console.error('Error fetching wrapped stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const hydrateHighlightCards = async (userStats: WrappedStats) => {
        const firstWatchTitle = userStats.first_watch_of_year?.title?.trim();
        const topRewatchTitle = Object.entries(userStats.title_rewatch_counts || {})
            .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0]?.trim();
        const comfortTitles = Object.entries(userStats.title_rewatch_counts || {})
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .map(([title]) => title?.trim())
            .filter((value): value is string => Boolean(value));

        const lookups: Promise<[Exclude<keyof HighlightCardMap, 'comfortShelf'>, Movie | null]>[] = [];

        if (firstWatchTitle) {
            lookups.push(
                TmdbService.search(firstWatchTitle, { type: userStats.first_watch_of_year?.type === 'tv' ? 'tv' : 'movie' })
                    .then(results => ['firstWatch', results[0] || null] as [Exclude<keyof HighlightCardMap, 'comfortShelf'>, Movie | null])
                    .catch(() => ['firstWatch', null] as [Exclude<keyof HighlightCardMap, 'comfortShelf'>, Movie | null])
            );
        }

        if (topRewatchTitle) {
            lookups.push(
                TmdbService.search(topRewatchTitle, { type: 'multi' })
                    .then(results => ['topRewatch', results[0] || null] as [Exclude<keyof HighlightCardMap, 'comfortShelf'>, Movie | null])
                    .catch(() => ['topRewatch', null] as [Exclude<keyof HighlightCardMap, 'comfortShelf'>, Movie | null])
            );
        }

        if (lookups.length === 0 && comfortTitles.length === 0) return;

        const resolved = lookups.length > 0 ? await Promise.all(lookups) : [];
        const comfortShelf = (await Promise.all(
            comfortTitles.map(title =>
                TmdbService.search(title, { type: 'multi' })
                    .then(results => results[0] || null)
                    .catch(() => null)
            )
        )).filter((movie): movie is Movie => Boolean(movie));

        setHighlightCards(prev => {
            const next = { ...prev };
            resolved.forEach(([key, movie]) => {
                next[key] = movie;
            });
            next.comfortShelf = comfortShelf;
            return next;
        });
    };

    const calculatePredictions = (userStats: WrappedStats): PredictiveInsights => {
        const monthlyData = Object.entries(userStats.monthly_watches || {});
        const totalContent = userStats.total_movies + userStats.total_shows;
        const sortedMonths = monthlyData.sort((a, b) => a[0].localeCompare(b[0]));
        const recentMonths = sortedMonths.slice(-6);
        const earlierMonths = sortedMonths.slice(0, Math.min(6, sortedMonths.length - 6));

        const recentAvg = recentMonths.length > 0
            ? recentMonths.reduce((sum, [, count]) => sum + (count as number), 0) / recentMonths.length
            : 0;
        const earlierAvg = earlierMonths.length > 0
            ? earlierMonths.reduce((sum, [, count]) => sum + (count as number), 0) / earlierMonths.length
            : recentAvg;

        const growthRate = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
        const baseProjection = recentAvg * 12;
        const trendAdjustment = growthRate > 0 ? baseProjection * (growthRate / 100) * 0.5 : 0;
        const projected2027 = Math.round(baseProjection + trendAdjustment);
        const dataCompleteness = monthlyData.length / 12;
        const trendStability = Math.abs(growthRate) < 20 ? 1 : Math.abs(growthRate) < 50 ? 0.7 : 0.4;
        const confidenceScore = dataCompleteness * trendStability;
        const confidence: 'high' | 'medium' | 'low' =
            confidenceScore > 0.7 ? 'high' : confidenceScore > 0.4 ? 'medium' : 'low';

        const trendingGenre = Object.entries(userStats.genre_counts || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || null;
        const milestones = [50, 100, 250, 500, 750, 1000, 1500, 2000];
        const nextMilestoneValue = milestones.find(m => m > totalContent) || totalContent + 100;

        return {
            projected_2027_total: projected2027,
            confidence,
            trending_genre: trendingGenre,
            growth_rate: Math.round(growthRate),
            next_milestone: {
                type: 'total',
                target: nextMilestoneValue,
                remaining: nextMilestoneValue - totalContent
            }
        };
    };

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1);
    };

    const prevSlide = () => {
        if (currentSlide > 0) setCurrentSlide(c => c - 1);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center space-y-8 bg-black">
                <div className="h-24 w-24 rounded-full border border-white/10 bg-white/5" />
                <div className="text-lg font-mono uppercase tracking-[0.28em] text-white/70">
                    Preparing your wrapped
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const totalContent = stats.total_movies + stats.total_shows;
    const nostalgiaScore = totalContent > 0 ? Math.round((stats.rewatch_count / totalContent) * 100) : 0;
    const topGenres = Object.entries(stats.genre_counts || {}).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5);
    const dominantGenre = topGenres[0]?.[0] || '-';
    const peakMonth = Object.entries(stats.monthly_watches || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0];
    const peakMonthName = monthLabel(peakMonth?.[0]);
    const peakMonthCount = Number(peakMonth?.[1] || 0);
    const topRewatch = Object.entries(stats.title_rewatch_counts || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0];
    const moviePercent = totalContent > 0 ? Math.round((stats.total_movies / totalContent) * 100) : 0;
    const showPercent = 100 - moviePercent;
    const topDay = Object.entries(stats.daily_watch_count || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0];
    const topDayDate = topDay?.[0] ? readableDate(topDay[0]) : 'Unknown day';
    const topDayCount = Number(topDay?.[1] || 0);
    const previousYearStats = stats.past_years?.[String(currentYear - 1)];
    const previousYearTotal = previousYearStats ? (previousYearStats.total_movies || 0) + (previousYearStats.total_shows || 0) : 0;
    const yoyDelta = previousYearTotal > 0 ? totalContent - previousYearTotal : 0;
    const viewingStyle = nostalgiaScore >= 15 ? 'Comfort Seeker' : 'Explorer';
    const firstWatchKey = movieKey(highlightCards.firstWatch);
    const topRewatchKey = movieKey(highlightCards.topRewatch);
    const comfortShelf = dedupeMovies(highlightCards.comfortShelf || []).filter(movie => {
        const key = movieKey(movie);
        return key !== firstWatchKey && key !== topRewatchKey;
    });
    const rewatchCountsByTitle = stats.title_rewatch_counts || {};
    const posterMosaic = dedupeMovies(comfortShelf).slice(0, 4);
    const compareCards = dedupeMovies([highlightCards.firstWatch, highlightCards.topRewatch]).slice(0, 2);

    const slides = [
        <div key="intro" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-black" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%)]" />
            <div className="relative z-10 max-w-5xl">
                <div className="text-[10px] font-mono uppercase tracking-[0.36em] text-white/45">Your year in cinema</div>
                <h1 className="mt-8 text-[10vw] font-black leading-[0.82] tracking-tighter text-white">
                    {currentYear}
                    <span className="block bg-gradient-to-b from-white to-white/45 bg-clip-text text-transparent">WRAPPED</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
                    The titles, returns, streaks, and sessions that shaped how your year actually felt.
                </p>
            </div>
        </div>,

        <div key="volume" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/18 via-black to-black" />
            <Film className="absolute -bottom-24 -right-24 h-[32rem] w-[32rem] rotate-12 text-emerald-900/10" />
            <div className="relative z-10 max-w-5xl">
                <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-emerald-300/75">What you put in</div>
                <div className="mt-6 bg-gradient-to-r from-emerald-100 to-emerald-500/50 bg-clip-text text-[12vw] font-black leading-[0.82] tracking-tighter text-transparent">
                    {totalContent}
                </div>
                <div className="mt-4 text-5xl font-light tracking-tight text-zinc-400">qualified sessions made the cut</div>
                <div className="mt-12 grid max-w-3xl grid-cols-2 gap-6">
                    <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
                        <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Movies</div>
                        <div className="mt-3 text-5xl font-black text-white">{stats.total_movies}</div>
                    </div>
                    <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
                        <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Episodes</div>
                        <div className="mt-3 text-5xl font-black text-white">{stats.total_shows}</div>
                    </div>
                </div>
            </div>
        </div>,

        <div key="split" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/14 via-black to-violet-900/10" />
            <div className="relative z-10 grid grid-cols-[0.95fr_1.05fr] gap-12">
                <div className="flex flex-col justify-center">
                    <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-cyan-300/75">How you watched</div>
                    <h2 className="mt-6 text-6xl font-black leading-[0.92] tracking-tight text-white">
                        {moviePercent >= showPercent ? 'Cinema leaned year' : 'Series leaned year'}
                    </h2>
                    <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
                        You spent more of this year {moviePercent >= showPercent ? 'chasing standalone movie nights' : 'living inside episode-to-episode momentum'}.
                    </p>
                </div>
                <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-7">
                    <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-4">
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Split this year</div>
                            <div className="mt-2 text-3xl font-black text-white">{moviePercent}% / {showPercent}%</div>
                        </div>
                        <div className="text-right text-sm leading-6 text-zinc-400">
                            <div>Films vs episodes</div>
                            <div>across every qualified session</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div className="rounded-[24px] border border-white/10 bg-black/35 p-5">
                            <Clapperboard className="mb-4 h-5 w-5 text-white/70" />
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Movies</div>
                            <div className="mt-2 text-4xl font-black text-white">{stats.total_movies}</div>
                            <div className="mt-2 text-sm text-zinc-400">{moviePercent}% of your wrapped</div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-black/35 p-5">
                            <Tv className="mb-4 h-5 w-5 text-white/70" />
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Episodes</div>
                            <div className="mt-2 text-4xl font-black text-white">{stats.total_shows}</div>
                            <div className="mt-2 text-sm text-zinc-400">{showPercent}% of your wrapped</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,

        <div key="first-watch" className={`relative h-full overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/18 via-black to-black" />
            <div className="relative z-10 h-full">
                <WrappedSpotlight
                    eyebrow="Your opener"
                    title={stats.first_watch_of_year?.title || 'No first watch saved'}
                    subtitle={stats.first_watch_of_year ? `${stats.first_watch_of_year.type === 'tv' ? 'Series start' : 'Movie night'} • ${readableDate(stats.first_watch_of_year.date)}` : 'No first watch data captured yet'}
                    movie={highlightCards.firstWatch || undefined}
                    accent="violet"
                />
            </div>
        </div>,

        <div key="genres" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-pink-900/18 via-black to-black" />
            <div className="relative z-10 grid max-w-6xl grid-cols-[0.9fr_1.1fr] gap-12">
                <div className="flex flex-col justify-center">
                    <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-pink-300/75">Your taste map</div>
                    <div className="mt-6 max-w-md text-6xl font-black uppercase leading-[0.9] tracking-tight text-white">
                        {dominantGenre}
                    </div>
                    <p className="mt-5 max-w-md text-lg leading-8 text-zinc-400">
                        This genre showed up more than anything else in the year you built.
                    </p>
                </div>
                <div className="grid gap-4">
                    {topGenres.map(([genre, count], index) => (
                        <div key={genre} className={`flex items-center justify-between rounded-[24px] border px-6 py-5 ${index === 0 ? 'border-pink-400/20 bg-pink-400/10' : 'border-white/10 bg-white/[0.03]'}`}>
                            <div className={`font-black uppercase tracking-tight ${index === 0 ? 'text-3xl text-white' : 'text-xl text-zinc-300'}`}>
                                {genre}
                            </div>
                            <div className={`text-sm font-mono uppercase tracking-[0.24em] ${index === 0 ? 'text-pink-200' : 'text-zinc-500'}`}>
                                {count} sessions
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>,

        <div key="peak-month" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-sky-900/16 via-black to-zinc-950" />
            <div className="relative z-10 grid grid-cols-[0.9fr_1.1fr] gap-12">
                <div className="flex flex-col justify-center">
                    <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-sky-300/75">Your busiest run</div>
                    <div className="mt-6 text-7xl font-black leading-none tracking-tight text-white">{peakMonthName}</div>
                    <p className="mt-5 max-w-md text-lg leading-8 text-zinc-400">
                        This was the stretch where your year really accelerated.
                    </p>
                </div>
                <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-8">
                    <div className="text-[10px] font-mono uppercase tracking-[0.26em] text-zinc-500">Qualified sessions in that month</div>
                    <div className="mt-4 text-[8vw] font-black leading-none tracking-tighter text-white">{peakMonthCount}</div>
                    {previousYearTotal > 0 ? (
                        <div className="mt-8 border-t border-white/10 pt-6">
                            <div className="text-[10px] font-mono uppercase tracking-[0.26em] text-zinc-500">{currentYear - 1} vs {currentYear}</div>
                            <div className="mt-3 text-4xl font-black text-white">
                                {yoyDelta > 0 ? '+' : yoyDelta < 0 ? '-' : ''}{Math.abs(yoyDelta)}
                            </div>
                            <div className="mt-2 text-sm text-zinc-400">
                                sessions compared with last year
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>,

        <div key="habits" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/12 via-black to-blue-900/10" />
            <div className="relative z-10 grid grid-cols-2 gap-7">
                <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-8">
                    <div className="flex items-center gap-3 text-zinc-500">
                        <Flame size={18} className="text-orange-400" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.26em]">You kept showing up</span>
                    </div>
                    <div className="mt-5 text-[7vw] font-black leading-none tracking-tighter text-white">{stats.max_streak}</div>
                    <div className="mt-2 text-2xl font-light text-zinc-400">days in a row</div>
                </div>
                <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-8">
                    <div className="flex items-center gap-3 text-zinc-500">
                        <CalendarRange size={18} className="text-sky-300" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.26em]">Your hardest binge day</span>
                    </div>
                    <div className="mt-5 text-[7vw] font-black leading-none tracking-tighter text-white">{topDayCount || stats.binge_days}</div>
                    <div className="mt-3 text-base leading-7 text-zinc-400">
                        {topDayCount > 0 ? `${topDayDate} was your busiest watch day.` : `${stats.binge_days} binge days crossed the threshold.`}
                    </div>
                </div>
            </div>
        </div>,

        <div key="rewatch" className={`relative h-full overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/16 via-black to-black" />
            <div className="relative z-10 h-full">
                <WrappedSpotlight
                    eyebrow="Your comfort title"
                    title={topRewatch?.[0] || 'No repeat title yet'}
                    subtitle={topRewatch ? `${topRewatch[1]} completed returns • comfort-watch signal` : 'No major rewatch title recorded yet'}
                    movie={highlightCards.topRewatch || undefined}
                    accent="amber"
                />
            </div>
        </div>,

        ...(compareCards.length >= 2 ? [<div key="compare-cards" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-black to-amber-950/16" />
            <div className="relative z-10 grid grid-cols-[0.82fr_1.18fr] gap-12">
                <div className="flex flex-col justify-center">
                    <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-white/45">Two ends of the year</div>
                    <h2 className="mt-6 text-6xl font-black leading-[0.92] tracking-tight text-white">
                        How it opened, and where you kept returning
                    </h2>
                    <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
                        One title kicked the year off. Another became the place you returned to when the year needed something familiar.
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <WrappedPosterMini
                        movie={compareCards[0]}
                        caption="First watch"
                        subcaption={stats.first_watch_of_year ? readableDate(stats.first_watch_of_year.date) : undefined}
                    />
                    <WrappedPosterMini
                        movie={compareCards[1]}
                        caption="Most revisited"
                        subcaption={topRewatch ? `${topRewatch[1]} returns` : undefined}
                    />
                </div>
            </div>
        </div>] : []),

        ...(comfortShelf.length > 0 ? [<div key="comfort-shelf" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-950/22 via-black to-black" />
            <div className="relative z-10">
                <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-amber-200/70">Comfort shelf</div>
                <div className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-white">
                    The posters you kept reaching for
                </div>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
                    These are the titles that held the strongest repeat pull in your wrapped.
                </p>
                <div className="mt-10 flex gap-6">
                    {comfortShelf.slice(0, 3).map((movie, index) => (
                        <WrappedPosterMini
                            key={`${movie.id}-${index}`}
                            movie={movie}
                            caption={`Return ${index + 1}`}
                            subcaption={rewatchCountsByTitle[movie.title] ? `${rewatchCountsByTitle[movie.title]} returns` : undefined}
                        />
                    ))}
                </div>
            </div>
        </div>] : []),

        ...(posterMosaic.length >= 3 ? [<div key="poster-mosaic" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-black to-black" />
            <div className="relative z-10 grid grid-cols-[0.76fr_1.24fr] gap-12">
                <div className="flex flex-col justify-center">
                    <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-white/45">Your year in posters</div>
                    <h2 className="mt-6 text-6xl font-black leading-[0.92] tracking-tight text-white">
                        A quick visual of what your wrapped looked like
                    </h2>
                    <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
                        Not every title, just the cards that best summarize how your year felt on screen.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-5">
                    {posterMosaic.map((movie, index) => (
                        <div key={`${movie.id}-${index}`} className="relative aspect-[2/3] overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950">
                            <img src={movie.imageUrl} alt={movie.title} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-4">
                                <div className="rounded-[16px] border border-white/10 bg-black/45 p-3 backdrop-blur-xl">
                                    <div className="line-clamp-2 text-base font-black leading-tight text-white">{movie.title}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>] : []),

        ...(communityStats ? [
            <div key="community" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/16 via-black to-black" />
                <div className="relative z-10 grid grid-cols-[0.9fr_1.1fr] gap-12">
                    <div className="flex flex-col justify-center">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-400">
                            <Users size={12} className="text-fuchsia-300" />
                            Against everyone else
                        </div>
                        <h2 className="mt-7 text-6xl font-black leading-[0.92] tracking-tight text-white">
                            Top {Math.max(1, 100 - Math.round(communityStats.user_percentile.total_content))}%
                        </h2>
                        <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
                            You logged more qualifying sessions than most people on the platform this year.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">You</div>
                            <div className="mt-3 text-5xl font-black text-white">{communityStats.user_stats.total_content}</div>
                            <div className="mt-2 text-sm text-zinc-400">qualified sessions</div>
                        </div>
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Median</div>
                            <div className="mt-3 text-5xl font-black text-white">{Math.round(communityStats.median_total)}</div>
                            <div className="mt-2 text-sm text-zinc-400">qualified sessions</div>
                        </div>
                    </div>
                </div>
            </div>
        ] : []),

        ...(predictions ? [
            <div key="forecast" className={`relative flex h-full flex-col justify-center overflow-hidden py-16 text-white ${desktopSlideShell}`}>
                <div className="absolute inset-0 bg-zinc-950" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                <div className="absolute right-20 top-12 h-48 w-48 rounded-full bg-cyan-400/6 blur-3xl" />
                <div className="relative z-10 grid grid-cols-[0.84fr_1.16fr] gap-12">
                    <div className="flex flex-col justify-center">
                        <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-cyan-300/75">If this keeps going</div>
                        <h2 className="mt-6 text-6xl font-black leading-[0.92] tracking-tight text-white">The next chapter</h2>
                        <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-400">
                            Your pattern still points toward {predictions.trending_genre || dominantGenre}, and probably with even more volume.
                        </p>
                        <div className="mt-10 border-l border-white/10 pl-6">
                            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">Read on the year</div>
                            <p className="mt-4 max-w-md text-base leading-7 text-zinc-300">
                                {predictions.growth_rate > 0
                                    ? `You are trending upward at ${predictions.growth_rate}% and still orbiting around ${predictions.trending_genre || dominantGenre}.`
                                    : `You are holding fairly steady, with ${predictions.trending_genre || dominantGenre} still defining the shape of your year.`}
                            </p>
                        </div>
                    </div>
                    <div className="rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
                        <div className="flex items-start justify-between gap-8 border-b border-white/8 pb-7">
                            <div>
                                <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Projected total</div>
                                <div className="mt-5 text-[7vw] font-black leading-[0.88] tracking-tighter text-white">{predictions.projected_2027_total}</div>
                                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-zinc-300">
                                    <TrendingUp size={15} className={predictions.growth_rate > 0 ? 'text-emerald-400' : 'text-red-400'} />
                                    <span>{predictions.growth_rate > 0 ? '+' : ''}{predictions.growth_rate}% session growth</span>
                                </div>
                            </div>
                            <div className="min-w-[180px] rounded-[24px] border border-white/8 bg-black/20 p-5">
                                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">Next milestone</div>
                                <div className="mt-4 text-5xl font-black leading-none tracking-tight text-white">{predictions.next_milestone.target}</div>
                                <div className="mt-3 text-sm text-zinc-400">{predictions.next_milestone.remaining} sessions away</div>
                            </div>
                        </div>
                        <div className="mt-7 grid grid-cols-[0.78fr_1.22fr] gap-6">
                            <div className="rounded-[26px] border border-white/8 bg-black/20 p-5">
                                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">Signal</div>
                                <div className={`mt-4 text-sm font-black uppercase tracking-[0.22em] ${confidenceTone[predictions.confidence]}`}>
                                    {predictions.confidence} confidence
                                </div>
                                <div className="mt-6 text-2xl font-black text-white">{viewingStyle}</div>
                                <div className="mt-2 text-sm leading-6 text-zinc-400">
                                    {viewingStyle} energy still looks intact.
                                </div>
                            </div>
                            <div className="rounded-[26px] border border-white/8 bg-black/20 p-5">
                                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">Forecast note</div>
                                <p className="mt-4 text-sm leading-7 text-zinc-300">
                                    If your current pace holds, next year trends toward more <span className="font-bold text-white">{predictions.trending_genre || dominantGenre}</span>, with enough room to clear <span className="font-bold text-white">{predictions.next_milestone.target}</span>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ] : []),

        <div key="summary" className={`relative flex h-full flex-col justify-between overflow-hidden py-16 text-white ${desktopSlideShell}`}>
            <div className="absolute inset-0 bg-zinc-950" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
            <div className="relative z-10">
                <div className="text-[10px] font-mono uppercase tracking-[0.34em] text-zinc-500">StreamWrapp</div>
                <h2 className="mt-5 text-6xl font-black leading-none tracking-tight text-white">{currentYear} recap</h2>
            </div>
            <div className="relative z-10 grid max-w-5xl grid-cols-4 gap-5">
                <div className="rounded-[26px] bg-white/5 p-5">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">Total</div>
                    <div className="mt-3 text-4xl font-black text-white">{totalContent}</div>
                </div>
                <div className="rounded-[26px] bg-white/5 p-5">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">Top vibe</div>
                    <div className="mt-3 text-2xl font-black text-white">{dominantGenre}</div>
                </div>
                <div className="rounded-[26px] bg-white/5 p-5">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">Streak</div>
                    <div className="mt-3 text-4xl font-black text-white">{stats.max_streak}</div>
                </div>
                <div className="rounded-[26px] bg-gradient-to-br from-white/10 to-white/5 p-5">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400">Archetype</div>
                    <div className="mt-3 text-2xl font-black text-white">{viewingStyle}</div>
                </div>
            </div>
            <div className="relative z-10 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                    Based on qualified sessions, not exact embedded-player playback
                </p>
                <button
                    onClick={onClose}
                    className="rounded-full bg-white px-6 py-3 text-xs font-black uppercase tracking-[0.24em] text-black transition-colors hover:bg-zinc-200"
                >
                    Close Wrapped
                </button>
            </div>
        </div>
    ];

    return (
        <div className="fixed inset-0 z-[200] bg-black/92 text-white backdrop-blur-sm">
            <div className="absolute inset-y-4 left-[92px] right-4 overflow-hidden rounded-[36px] border border-white/6 bg-[#09090c] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="pointer-events-none absolute left-8 right-20 top-6 z-50 flex gap-2">
                {slides.map((_, idx) => (
                    <div key={idx} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                        <div className={`h-full rounded-full bg-white/90 transition-all duration-300 ${idx <= currentSlide ? 'w-full' : 'w-0'}`} />
                    </div>
                ))}
            </div>

            <button
                onClick={onClose}
                className="absolute right-6 top-5 z-[60] rounded-full border border-white/10 bg-black/30 p-3 text-white/80 backdrop-blur-md"
            >
                <X size={20} />
            </button>

            <div className="absolute inset-0 z-30 flex">
                <button type="button" aria-label="Previous slide" className="h-full w-1/3 bg-transparent" onClick={prevSlide} />
                <button type="button" aria-label="Next slide" className="h-full w-2/3 bg-transparent" onClick={nextSlide} />
            </div>

            <div className="relative z-20 h-full w-full animate-in fade-in duration-300">
                {slides[currentSlide]}
            </div>
            </div>
        </div>
    );
};

const WrappedPosterMini: React.FC<{
    movie?: Movie | null;
    caption: string;
    subcaption?: string;
}> = ({ movie, caption, subcaption }) => {
    return (
        <div className="w-[220px]">
            <div className="relative aspect-[2/3] overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
                {movie?.imageUrl ? (
                    <img src={movie.imageUrl} alt={movie.title} className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/5" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="rounded-[18px] border border-white/10 bg-black/45 p-3 backdrop-blur-xl">
                        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">{caption}</div>
                        <div className="mt-2 line-clamp-2 text-lg font-black leading-tight text-white">{movie?.title || 'Unknown title'}</div>
                        {subcaption ? <div className="mt-1 text-xs text-zinc-400">{subcaption}</div> : null}
                    </div>
                </div>
            </div>
        </div>
    );
};
