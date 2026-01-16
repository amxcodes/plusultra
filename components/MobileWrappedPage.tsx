
import React, { useState, useEffect } from 'react';
import { X, Film, Flame, RotateCcw, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
    first_watch_of_year?: {
        title: string;
        date: string;
        type: string;
    };
    past_years?: Record<string, WrappedStats>;
}

interface CommunityStats {
    avg_total_content: number;
    avg_movies: number;
    avg_shows: number;
    avg_streak: number;
    avg_rewatch_count: number;
    median_total: number;
    median_streak: number;
    total_users: number;
    user_percentile: {
        total_content: number;
        streak: number;
        rewatches: number;
    };
    top_community_genres: Array<{ genre: string; count: number }>;
    user_stats: {
        total_content: number;
        movies: number;
        shows: number;
        streak: number;
        rewatches: number;
    };
}

interface PredictiveInsights {
    projected_2027_total: number;
    confidence: 'high' | 'medium' | 'low';
    trending_genre: string | null;
    genre_trend_direction: 'increasing' | 'stable' | 'decreasing';
    growth_rate: number;
    next_milestone: {
        type: string;
        target: number;
        remaining: number;
    };
}

interface MobileWrappedPageProps {
    onClose: () => void;
}

export const MobileWrappedPage: React.FC<MobileWrappedPageProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<WrappedStats | null>(null);
    const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
    const [predictions, setPredictions] = useState<PredictiveInsights | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        fetchWrappedStats();
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const fetchWrappedStats = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Enforce minimum loading time of 2.5s to show animation
            const minLoadTime = new Promise(resolve => setTimeout(resolve, 2500));

            // Fetch user stats
            const statsPromise = supabase
                .from('profiles')
                .select('stats')
                .eq('id', user.id)
                .single();

            const [result] = await Promise.all([statsPromise, minLoadTime]);
            const { data } = result;

            if (data?.stats) {
                setStats(data.stats);

                // Calculate predictions from user stats
                const predictions = calculatePredictions(data.stats);
                setPredictions(predictions);

                // Fetch community stats
                try {
                    const { data: communityData, error: communityError } = await supabase
                        .rpc('get_community_stats', { p_user_id: user.id });

                    if (communityError) {
                        console.error('Error fetching community stats:', communityError);
                    } else if (communityData) {
                        setCommunityStats(communityData);
                    }
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

    const calculatePredictions = (userStats: WrappedStats): PredictiveInsights => {
        const monthlyData = Object.entries(userStats.monthly_watches || {});
        const totalContent = userStats.total_movies + userStats.total_shows;

        // Calculate trend (last 6 months vs first 6 months)
        const sortedMonths = monthlyData.sort((a, b) => a[0].localeCompare(b[0]));
        const recentMonths = sortedMonths.slice(-6);
        const earlierMonths = sortedMonths.slice(0, Math.min(6, sortedMonths.length - 6));

        const recentAvg = recentMonths.length > 0
            ? recentMonths.reduce((sum, [, count]) => sum + (count as number), 0) / recentMonths.length
            : 0;
        const earlierAvg = earlierMonths.length > 0
            ? earlierMonths.reduce((sum, [, count]) => sum + (count as number), 0) / earlierMonths.length
            : recentAvg;

        // Calculate growth rate
        const growthRate = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;

        // Project 2027 (12 months * recent average with growth adjustment)
        const baseProjection = recentAvg * 12;
        const trendAdjustment = growthRate > 0 ? baseProjection * (growthRate / 100) * 0.5 : 0;
        const projected2027 = Math.round(baseProjection + trendAdjustment);

        // Confidence based on data completeness
        const dataCompleteness = monthlyData.length / 12;
        const trendStability = Math.abs(growthRate) < 20 ? 1 : Math.abs(growthRate) < 50 ? 0.7 : 0.4;
        const confidenceScore = dataCompleteness * trendStability;

        const confidence: 'high' | 'medium' | 'low' =
            confidenceScore > 0.7 ? 'high' : confidenceScore > 0.4 ? 'medium' : 'low';

        // Find trending genre (comparing Q4 vs Q1)
        let trendingGenre: string | null = null;
        let genreTrendDirection: 'increasing' | 'stable' | 'decreasing' = 'stable';

        if (userStats.genre_counts) {
            const genres = Object.entries(userStats.genre_counts);
            if (genres.length > 0) {
                trendingGenre = genres.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
                genreTrendDirection = growthRate > 10 ? 'increasing' : growthRate < -10 ? 'decreasing' : 'stable';
            }
        }

        // Calculate next milestone
        const milestones = [50, 100, 250, 500, 750, 1000, 1500, 2000];
        const nextMilestoneValue = milestones.find(m => m > totalContent) || totalContent + 100;

        return {
            projected_2027_total: projected2027,
            confidence,
            trending_genre: trendingGenre,
            genre_trend_direction: genreTrendDirection,
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

    if (loading) return (
        <div className="fixed inset-0 bg-[#0f1014] z-[100] flex flex-col items-center justify-center space-y-8">
            <div className="relative animate-bounce-slow">
                {/* Mobile Optimized Ghost */}
                <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                    <path d="M50 10 C 25 10 10 35 15 65 C 18 80 25 85 30 85 C 35 85 40 80 45 80 C 50 80 55 85 60 85 C 65 85 75 80 85 65 C 90 35 75 10 50 10 Z" fill="white" />
                    <ellipse cx="40" cy="42" rx="6" ry="8" fill="#1a1a1a" />
                    <ellipse cx="60" cy="42" rx="6" ry="8" fill="#1a1a1a" />
                    <circle cx="42" cy="38" r="2.5" fill="white" />
                    <circle cx="62" cy="38" r="2.5" fill="white" />
                    <ellipse cx="38" cy="52" rx="4" ry="2" fill="#FFB7B2" opacity="0.6" />
                    <ellipse cx="62" cy="52" rx="4" ry="2" fill="#FFB7B2" opacity="0.6" />
                    <path d="M45 50 Q 50 54 55 50" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M28 22 C 28 22, 10 5, 45 5" stroke="#EF4444" strokeWidth="0" fill="#EF4444" />
                    <path d="M25 20 C 25 20, 45 -5, 75 20 Z" fill="#EF4444" />
                    <circle cx="78" cy="20" r="7" fill="white" />
                    <path d="M22 22 H 78 Q 50 32 22 22 Z" fill="white" />
                </svg>
            </div>
            <div className="flex flex-col items-center gap-2">
                <span className="text-white text-base font-mono tracking-widest uppercase animate-pulse">
                    Loading 2026 Wrapped...
                </span>
            </div>
        </div>
    );

    if (!stats) return null;

    // Derived Stats
    const totalContent = stats.total_movies + stats.total_shows;
    const nostalgiaScore = totalContent > 0 ? Math.round((stats.rewatch_count / totalContent) * 100) : 0;
    const movieRatio = totalContent > 0 ? stats.total_movies / totalContent : 0;
    const viewingStyle = nostalgiaScore >= 15 ? "Comfort Seeker" : "Explorer";
    const peakMonth = Object.entries(stats.monthly_watches || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0];
    const peakMonthName = peakMonth ? new Date(peakMonth[0] + '-01').toLocaleDateString('en-US', { month: 'long' }) : 'Unknown';
    const peakMonthCount = peakMonth ? peakMonth[1] : 0;
    const topRewatch = Object.entries(stats.title_rewatch_counts || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0];

    const slides = [
        // Slide 1: Intro (Mobile)
        <div key="intro" className="h-full flex flex-col justify-center items-center p-8 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-black animate-pulse-slow" />
            <h1 className="text-8xl font-black tracking-tighter text-center flex flex-col items-center z-10 leading-none">
                <span className="animate-slide-up-fade delay-300">2026</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 animate-slide-up-fade delay-700">WRAPPED</span>
            </h1>
            <p className="mt-8 text-xs text-white/50 font-mono tracking-[0.4em] uppercase z-10 animate-fade-in delay-1000">
                Your Year in Cinema
            </p>
        </div>,

        // Slide 2: The Volume
        <div key="volume" className="h-full flex flex-col justify-center items-start p-8 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-bl from-emerald-900/20 via-black to-black" />
            <Film className="absolute -bottom-10 -right-10 w-64 h-64 text-emerald-900/10 rotate-12" />

            <h2 className="text-emerald-500/80 text-[10px] font-bold tracking-[0.3em] uppercase mb-8 z-10">The Volume</h2>

            <div className="relative z-10 w-full">
                <span className="block text-[25vw] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-emerald-600/50 pb-2">
                    {totalContent}
                </span>
                <span className="block text-2xl font-light text-zinc-400 tracking-tight mt-2">
                    Titles Watched
                </span>
            </div>

            <div className="mt-16 flex flex-col gap-6 relative z-10 w-full">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <span className="text-sm text-zinc-500 uppercase tracking-widest">Movies</span>
                    <span className="text-3xl font-bold text-white">{stats.total_movies}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <span className="text-sm text-zinc-500 uppercase tracking-widest">Shows</span>
                    <span className="text-3xl font-bold text-white">{stats.total_shows}</span>
                </div>
            </div>
        </div>,

        // Slide 3: The Vibe
        <div key="vibe" className="h-full flex flex-col justify-center items-start p-8 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-900/20 via-black to-black" />
            <h2 className="text-pink-500/80 text-[10px] font-bold tracking-[0.3em] uppercase mb-12 z-10">The Vibe</h2>

            <div className="flex flex-col gap-4 relative z-10 w-full">
                {Object.entries(stats.genre_counts || {})
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 5)
                    .map(([genre, count], index) => {
                        const isTop = index === 0;
                        return (
                            <div key={genre} className={`flex items-baseline justify-between ${isTop ? 'mb-4' : ''}`}>
                                <span className={`font-black tracking-tighter uppercase ${isTop ? 'text-5xl text-white pl-3 border-l-4 border-pink-500' : 'text-2xl text-zinc-600'}`}>
                                    {genre}
                                </span>
                                {isTop && <span className="text-xl font-mono text-pink-400">{count}</span>}
                            </div>
                        );
                    })}
            </div>
        </div>,

        // Slide 4: Habits
        <div key="habits" className="h-full flex flex-col justify-center items-start p-8 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/10 via-black to-blue-900/10" />
            <h2 className="text-zinc-500/80 text-[10px] font-bold tracking-[0.3em] uppercase mb-16 z-10">Habits</h2>

            <div className="flex flex-col gap-12 relative z-10 w-full">
                <div>
                    <span className="block text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-200 to-orange-600/50 mb-2">
                        {stats.max_streak} DAYS
                    </span>
                    <div className="flex items-center gap-2 text-zinc-500">
                        <Flame size={16} className="text-orange-500" />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Longest Streak</span>
                    </div>
                </div>

                <div>
                    <span className="block text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-600/50 mb-2">
                        {stats.rewatch_count} TITLES
                    </span>
                    <div className="flex items-center gap-2 text-zinc-500">
                        <RotateCcw size={16} className="text-blue-500" />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Rewatched</span>
                    </div>
                </div>
            </div>
        </div>,

        // Slide 5: Predictive Insights (Mobile)
        ...(predictions ? [
            <div key="predictions" className="h-full flex flex-col justify-center items-start p-8 bg-zinc-950 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />
                <div className="absolute top-10 right-0 opacity-10 font-black text-9xl text-white rotate-90 origin-top-right">2027</div>

                <div className="relative z-10 w-full h-full flex flex-col justify-center gap-12">
                    <div>
                        <h2 className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-1">Future Forecast</h2>
                        <h1 className="text-3xl font-black text-white uppercase leading-none">The Next Chapter</h1>
                    </div>

                    <div className="grid gap-8">
                        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">Projected Total</span>
                            <span className="text-6xl font-black text-white">{predictions.projected_2027_total}</span>
                            <div className="mt-2 flex items-center gap-2">
                                <TrendingUp size={14} className={predictions.growth_rate > 0 ? 'text-green-500' : 'text-red-500'} />
                                <span className="text-xs text-zinc-400 font-bold">{predictions.growth_rate > 0 ? '+' : ''}{predictions.growth_rate}% Growth</span>
                            </div>
                        </div>

                        {predictions.next_milestone && (
                            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">Next Milestone</span>
                                <span className="text-5xl font-black text-white">{predictions.next_milestone.target}</span>
                                <span className="text-xs text-zinc-400 block mt-2">{predictions.next_milestone.remaining} titles away</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        ] : []),

        // Slide 6: Summary (Mobile)
        <div key="summary" className="h-full flex flex-col justify-between p-8 pt-16 pb-12 bg-zinc-950 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />

            {/* Header */}
            <div className="relative z-10 text-center">
                <h2 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] mb-2">StreamWrapp</h2>
                <h1 className="text-4xl font-black tracking-tighter text-white uppercase">2026 Recap</h1>
            </div>

            {/* Stats Grid */}
            <div className="relative z-10 grid grid-cols-2 gap-4 gap-y-8 w-full">
                <div className="flex flex-col items-center text-center p-4 bg-white/5 rounded-2xl">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Total</span>
                    <span className="text-3xl font-black text-white">{stats.total_movies + stats.total_shows}</span>
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-white/5 rounded-2xl">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Streak</span>
                    <span className="text-3xl font-black text-white">{stats.streak_days}</span>
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-white/5 rounded-2xl col-span-2">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Top Vibe</span>
                    <span className="text-3xl font-black text-white uppercase leading-none break-all">
                        {Object.entries(stats.genre_counts || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || '-'}
                    </span>
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl col-span-2 border border-white/10">
                    <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Archetype</span>
                    <span className="text-3xl font-black text-white uppercase">{viewingStyle}</span>
                </div>
            </div>

            {/* Close Action */}
            <button
                onClick={onClose}
                className="relative z-20 w-full py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-zinc-200 transition-colors"
            >
                Close Wrapped
            </button>
        </div>
    ];

    return (
        <div className="fixed inset-0 z-[200] bg-black text-white touch-none">

            {/* Safe Area Top Spacing */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-black z-[60]" />

            {/* Progress Bar */}
            <div className="absolute top-4 left-4 right-4 z-50 flex gap-1.5 pt-safe">
                {slides.map((_, idx) => (
                    <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-white transition-all duration-300 ${idx < currentSlide ? 'w-full' : idx === currentSlide ? 'w-full' : 'w-0'}`}
                        />
                    </div>
                ))}
            </div>

            {/* Close */}
            <button
                onClick={onClose}
                className="absolute top-8 right-6 z-[60] p-2 bg-black/20 backdrop-blur-md rounded-full text-white/80"
            >
                <X size={20} />
            </button>

            {/* Navigation Zones */}
            <div className="absolute inset-0 z-10 flex">
                <div className="w-1/3 h-full active:bg-white/5 transition-colors" onClick={prevSlide} />
                <div className="w-2/3 h-full active:bg-white/5 transition-colors" onClick={nextSlide} />
            </div>

            {/* Content */}
            <div className="w-full h-full animate-in fade-in duration-300">
                {slides[currentSlide]}
            </div>
        </div>
    );
};
