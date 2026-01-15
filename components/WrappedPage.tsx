import React, { useState, useEffect } from 'react';
import { X, Share2, Download, Play, Trophy, Calendar, Clock, RotateCcw, Flame, Sparkles, TrendingUp, Film, Tv, Award, Users, Zap, Target, ArrowUpRight } from 'lucide-react';
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

interface WrappedPageProps {
    onClose: () => void;
}

export const WrappedPage: React.FC<WrappedPageProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<WrappedStats | null>(null);
    const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
    const [predictions, setPredictions] = useState<PredictiveInsights | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        fetchWrappedStats();
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
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center space-y-8">
            <div className="relative animate-bounce-slow">
                {/* Casper-Style Cute Ghost with Remote */}
                <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    {/* Casper-like Bulbous Head & Body */}
                    <path d="M50 10 C 25 10 10 35 15 65 C 18 80 25 85 30 85 C 35 85 40 80 45 80 C 50 80 55 85 60 85 C 65 85 75 80 85 65 C 90 35 75 10 50 10 Z" fill="white" />

                    {/* Big Expressive Eyes */}
                    <ellipse cx="40" cy="42" rx="6" ry="8" fill="#1a1a1a" />
                    <ellipse cx="60" cy="42" rx="6" ry="8" fill="#1a1a1a" />
                    {/* Eye Sparkles */}
                    <circle cx="42" cy="38" r="2.5" fill="white" />
                    <circle cx="62" cy="38" r="2.5" fill="white" />

                    {/* Cute Blush */}
                    <ellipse cx="38" cy="52" rx="4" ry="2" fill="#FFB7B2" opacity="0.6" />
                    <ellipse cx="62" cy="52" rx="4" ry="2" fill="#FFB7B2" opacity="0.6" />

                    {/* Friendly Smile */}
                    <path d="M45 50 Q 50 54 55 50" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />

                    {/* Christmas Hat (Perched on round head) */}
                    <path d="M28 22 C 28 22, 10 5, 45 5" stroke="#EF4444" strokeWidth="0" fill="#EF4444" />
                    <path d="M25 20 C 25 20, 45 -5, 75 20 Z" fill="#EF4444" />
                    <circle cx="78" cy="20" r="7" fill="white" /> {/* Pompom */}
                    <path d="M22 22 H 78 Q 50 32 22 22 Z" fill="white" /> {/* White Trim */}

                    {/* Arm holding Remote (Animated "Trying to make it work") */}
                    <g className="origin-bottom-right animate-pulse" style={{ transformBox: 'fill-box', transformOrigin: '80% 80%' }}>
                        <path d="M75 60 C 80 60 85 55 90 50" stroke="white" strokeWidth="6" strokeLinecap="round" />
                        {/* The Remote */}
                        <g transform="translate(85, 40) rotate(-15)">
                            <rect x="0" y="0" width="12" height="20" rx="2" fill="#333" />
                            <circle cx="6" cy="5" r="2" fill="#EF4444" /> {/* Red Power Button */}
                            <rect x="3" y="9" width="6" height="1.5" rx="0.5" fill="#555" />
                            <rect x="3" y="12" width="6" height="1.5" rx="0.5" fill="#555" />
                            {/* Infrared Beams */}
                            <path d="M6 -2L6 -8M2 -3L-2 -7M10 -3L14 -7" stroke="#EF4444" strokeWidth="1.5" className="animate-ping opacity-75" />
                        </g>
                    </g>
                </svg>
            </div>

            <div className="flex flex-col items-center gap-2">
                <span className="text-white text-lg font-mono tracking-widest uppercase animate-pulse">
                    We are preparing your 2026 wrapped
                </span>
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                </div>
            </div>
        </div>
    );

    if (!stats) return null;

    // Calculated Stats
    const totalContent = stats.total_movies + stats.total_shows;
    const nostalgiaScore = totalContent > 0 ? Math.round((stats.rewatch_count / totalContent) * 100) : 0;
    const movieRatio = totalContent > 0 ? stats.total_movies / totalContent : 0;
    const discoveryRate = totalContent > 0 ? Math.round(((totalContent - stats.rewatch_count) / totalContent) * 100) : 0;

    // Personality Types
    const viewingStyle = nostalgiaScore >= 15 ? "Comfort Seeker" : "Explorer";
    const contentPreference = movieRatio > 0.6 ? "Movie Buff" : movieRatio < 0.4 ? "Series Addict" : "Balanced Viewer";
    const bingeLevel = stats.binge_days > 30 ? "Binge Champion" : stats.binge_days <= 10 ? "Casual Viewer" : "Moderate Binger";

    // Peak Month
    const peakMonth = Object.entries(stats.monthly_watches || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0];
    const peakMonthName = peakMonth ? new Date(peakMonth[0] + '-01').toLocaleDateString('en-US', { month: 'long' }) : 'Unknown';
    const peakMonthCount = peakMonth ? peakMonth[1] : 0;

    // Top Rewatched Title
    const topRewatch = Object.entries(stats.title_rewatch_counts || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0];

    // Slide Content Generators
    const slides = [
        // Slide 1: Intro
        <div key="intro" className="h-full flex flex-col justify-center items-center p-8 pl-24 md:pl-32 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-black to-black animate-pulse-slow" />
            <div className="absolute top-0 right-0 w-[80vw] h-[80vw] bg-violet-600/10 rounded-full blur-[150px] mix-blend-screen" />
            <h1 className="text-[12vw] leading-[0.8] font-black tracking-tighter mix-blend-difference z-10 select-none text-center flex flex-col items-center">
                <span className="block animate-slide-up-fade delay-500">2026</span>
                <span className="block animate-slide-up-fade delay-1000">WRAP</span>
                <span className="block animate-slide-up-fade delay-[1500ms]">PED.</span>
            </h1>
            <p className="mt-12 text-sm text-white/50 font-mono tracking-[0.4em] uppercase z-10 text-center animate-zoom-in-fade delay-[2500ms]">
                Your Year in Cinema
            </p>
        </div>,

        // Slide 2: The Volume
        <div key="volume" className="h-full flex flex-col justify-center p-12 pl-24 md:pl-32 pb-24 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-bl from-emerald-900/10 via-black to-black" />
            <Film className="absolute -bottom-20 -right-20 w-[60vh] h-[60vh] text-emerald-900/10 rotate-12" />

            <h2 className="text-emerald-500/60 text-xs font-bold tracking-[0.4em] uppercase mb-8 relative z-10 ml-1">The Volume</h2>

            <div className="relative z-10">
                <span className="block text-[15vw] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-emerald-600/50 pb-4">
                    {totalContent}
                </span>
                <span className="block text-4xl md:text-5xl font-light text-zinc-500 tracking-tight mt-4">
                    Titles Watched
                </span>
            </div>

            <div className="mt-24 flex gap-16 relative z-10">
                <div>
                    <span className="block text-5xl font-bold text-white mb-2">{stats.total_movies}</span>
                    <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-medium">Movies</span>
                </div>
                <div>
                    <span className="block text-5xl font-bold text-white mb-2">{stats.total_shows}</span>
                    <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-medium">Shows</span>
                </div>
            </div>
        </div>,

        // Slide 3: The Vibe
        <div key="vibe" className="h-full flex flex-col justify-center p-12 pl-24 md:pl-32 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-900/10 via-black to-black" />
            <div className="absolute top-1/2 right-0 w-[40vw] h-[40vw] bg-pink-600/10 rounded-full blur-[120px]" />

            <h2 className="text-pink-500/60 text-xs font-bold tracking-[0.4em] uppercase mb-16 relative z-10 ml-1">The Vibe</h2>

            <div className="flex flex-col gap-6 relative z-10">
                {Object.entries(stats.genre_counts || {})
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 5)
                    .map(([genre, count], index) => {
                        const style = index === 0
                            ? "text-[8vw] leading-none text-white opacity-100 pl-4 border-l-4 border-pink-500"
                            : `text-[4vw] leading-none text-zinc-600 opacity-${80 - (index * 15)}`;

                        return (
                            <div key={genre} className="flex items-baseline gap-6 transition-all hover:opacity-100">
                                <span className={`font-black tracking-tighter uppercase transition-all duration-500 ${style}`}>
                                    {genre}
                                </span>
                                {index === 0 && (
                                    <span className="text-xl font-mono text-pink-400">{count}</span>
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>,

        // Slide 4: Habits
        <div key="habits" className="h-full flex flex-col justify-center p-12 pl-24 md:pl-32 pb-24 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/10 via-black to-blue-900/10" />

            <h2 className="text-zinc-500/60 text-xs font-bold tracking-[0.4em] uppercase mb-24 relative z-10 ml-1">Habits</h2>

            <div className="flex flex-col gap-16 relative z-10 max-w-4xl pb-10">
                <div className="group transition-all duration-500 hover:translate-x-4">
                    <span className="block text-[8vw] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-200 to-orange-600/50 mb-4 pb-2">
                        {stats.max_streak} DAYS
                    </span>
                    <div className="flex items-center gap-4 text-zinc-500 group-hover:text-orange-400 transition-colors">
                        <Flame className="w-5 h-5" />
                        <span className="text-xs font-mono uppercase tracking-[0.2em]">Longest Streak (Current: {stats.streak_days})</span>
                    </div>
                </div>

                <div className="group transition-all duration-500 hover:translate-x-4">
                    <span className="block text-[8vw] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-600/50 mb-4 pb-2">
                        {stats.rewatch_count} TITLES
                    </span>
                    <div className="flex items-center gap-4 text-zinc-500 group-hover:text-blue-400 transition-colors">
                        <RotateCcw className="w-5 h-5" />
                        <span className="text-xs font-mono uppercase tracking-[0.2em]">Rewatched</span>
                    </div>
                </div>
            </div>
        </div>,

        // Slide 5: First Watch (if exists)
        ...(stats.first_watch_of_year ? [
            <div key="first" className="h-full flex flex-col justify-center p-12 pl-24 md:pl-32 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tl from-cyan-900/10 via-black to-black" />
                <Calendar className="absolute top-20 right-20 w-64 h-64 text-cyan-900/5 rotate-12" />

                <h2 className="text-cyan-500/60 text-xs font-bold tracking-[0.4em] uppercase mb-16 relative z-10 ml-1">First Watch of 2026</h2>

                <div className="relative z-10">
                    <span className="block text-[8vw] leading-[0.9] font-black tracking-tighter mb-8 max-w-4xl">
                        {stats.first_watch_of_year.title}
                    </span>
                    <div className="inline-block px-6 py-3 border border-cyan-500/30 rounded-full bg-cyan-900/10 backdrop-blur-sm">
                        <span className="font-mono text-cyan-300 uppercase tracking-widest text-sm">
                            {new Date(stats.first_watch_of_year.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>

                <p className="absolute bottom-20 text-zinc-700 font-mono text-xs uppercase tracking-[0.2em]">
                    Started the year right
                </p>
            </div>
        ] : []),

        // Slide 6: Top Rewatch (if exists)
        ...(topRewatch ? [
            <div key="toprewatch" className="h-full flex flex-col justify-center p-12 pl-24 md:pl-32 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-900/10 via-black to-black" />
                <div className="absolute bottom-0 left-0 w-full h-[30vh] bg-gradient-to-t from-violet-900/20 to-transparent" />

                <h2 className="text-violet-500/60 text-xs font-bold tracking-[0.4em] uppercase mb-12 relative z-10 ml-1">Most Rewatched</h2>

                <div className="relative z-10">
                    <span className="block text-[8vw] leading-[0.9] font-black tracking-tighter mb-12 max-w-5xl">
                        {topRewatch[0]}
                    </span>

                    <div className="flex items-center gap-8">
                        <span className="text-[12vw] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-violet-200 to-violet-600/50">
                            {topRewatch[1]}
                        </span>
                        <div className="flex flex-col justify-center h-full pt-4">
                            <span className="text-xl font-bold text-white uppercase tracking-widest">Times</span>
                            <span className="text-sm text-zinc-500 uppercase tracking-[0.2em]">Rewatched</span>
                        </div>
                    </div>
                </div>
            </div>
        ] : []),

        // Slide 7: Peak Month
        ...(peakMonth ? [
            <div key="peak" className="h-full flex flex-col justify-center p-12 pl-24 md:pl-32 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-amber-900/20" />

                <h2 className="text-amber-500/60 text-xs font-bold tracking-[0.4em] uppercase mb-12 relative z-10 ml-1">Peak Activity</h2>

                <div className="relative z-10 flex flex-col items-start gap-8">
                    <span className="text-[15vw] leading-[0.8] font-black tracking-tighter text-white uppercase mix-blend-difference">
                        {peakMonthName}
                    </span>

                    <div className="flex items-center gap-6 pl-4 border-l-4 border-amber-500">
                        <span className="text-6xl font-black text-amber-500">{peakMonthCount}</span>
                        <span className="text-sm text-zinc-400 uppercase tracking-widest max-w-[100px] leading-relaxed">
                            Titles Watched
                        </span>
                    </div>
                </div>
            </div>
        ] : []),

        // Slide 7.5: Predictive Insights (2027 Projection) - Minimalist Maximalism
        ...(predictions ? [
            <div key="predictions" className="h-full flex flex-col justify-center items-center p-8 bg-zinc-950 text-white relative overflow-hidden">
                {/* Background Texture */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />

                {/* Massive Background Year - The "Maximalist" Element */}
                <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none overflow-hidden">
                    <span className="text-[35vw] font-black tracking-tighter text-zinc-900/50 scale-150 transform rotate-[5deg] mix-blend-color-dodge blur-sm">
                        2027
                    </span>
                </div>

                <div className="relative z-10 w-full max-w-6xl flex flex-col h-full justify-between py-24">
                    {/* Header - The "Minimalist" Element */}
                    <div className="text-center">
                        <h2 className="text-sm font-mono text-cyan-500 uppercase tracking-[0.5em] mb-2">Future Forecast</h2>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase">The Next Chapter</h1>
                    </div>

                    {/* Stats Layout - High Contrast Overlay */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left items-end">

                        {/* Stat 1: Projected Total */}
                        <div className="group flex flex-col items-center md:items-start border-l-2 border-zinc-800 pl-6 hover:border-cyan-500 transition-colors duration-500">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Projected Total</span>
                            <span className="text-6xl md:text-7xl font-black text-white leading-[0.8]">
                                {predictions.projected_2027_total}
                            </span>
                            <span className="text-sm font-bold text-zinc-600 mt-2">Titles Forecasted</span>
                        </div>

                        {/* Stat 2: Trajectory */}
                        <div className="group flex flex-col items-center md:items-start border-l-2 border-zinc-800 pl-6 hover:border-green-500 transition-colors duration-500">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Trajectory</span>
                            <span className={`text-6xl md:text-7xl font-black leading-[0.8] ${predictions.growth_rate >= 0 ? 'text-white' : 'text-zinc-400'}`}>
                                {predictions.growth_rate > 0 ? '+' : ''}{predictions.growth_rate}%
                            </span>
                            <span className="text-sm font-bold text-zinc-600 mt-2">Annual Growth</span>
                        </div>

                        {/* Stat 3: Next Goal */}
                        <div className="group flex flex-col items-center md:items-start border-l-2 border-zinc-800 pl-6 hover:border-purple-500 transition-colors duration-500">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Next Milestone</span>
                            {predictions.next_milestone ? (
                                <>
                                    <span className="text-6xl md:text-7xl font-black text-white leading-[0.8]">
                                        {predictions.next_milestone.target}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-600 mt-2">
                                        {predictions.next_milestone.remaining} titles to go
                                    </span>
                                </>
                            ) : (
                                <span className="text-4xl font-black text-zinc-500 leading-tight">All Goals Met</span>
                            )}
                        </div>
                    </div>

                    {/* Confidence Indicator */}
                    <div className="flex justify-center mt-12">
                        <div className="inline-flex items-center gap-3 px-6 py-3 border border-zinc-800 bg-black/50 backdrop-blur-md rounded-full">
                            <div className={`w-2 h-2 rounded-full ${predictions.confidence === 'high' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' :
                                predictions.confidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                                }`} />
                            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                                {predictions.confidence} Confidence Level
                            </span>
                        </div>
                    </div>

                    <div className="absolute bottom-8 w-full text-center">
                        <p className="font-mono text-[9px] uppercase tracking-[0.5em] opacity-30 text-zinc-500">
                            Predictive AI Model • v2.1
                        </p>
                    </div>
                </div>
            </div>
        ] : []),

        // Slide 7.6: You vs Community
        ...(communityStats && communityStats.total_users >= 10 ? [
            <div key="community" className="h-full flex flex-col justify-center items-center p-8 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-black to-black" />

                {/* Massive Percentile Header */}
                <div className="relative z-10 text-center mb-16">
                    <span className="block text-xs font-mono text-amber-500 uppercase tracking-[0.4em] mb-4">Global Rank</span>
                    <span className="block text-[15vw] leading-[0.9] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400 pb-8">
                        TOP {Math.round(100 - communityStats.user_percentile.total_content)}%
                    </span>
                    <span className="block text-sm text-zinc-500 font-mono uppercase tracking-[0.2em] -mt-2">
                        Among {communityStats.total_users.toLocaleString()} Viewers
                    </span>
                </div>

                {/* Grid Stats */}
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-24 text-center">
                    {/* Total Volume */}
                    <div className="group">
                        <span className="block text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] mb-2 group-hover:text-amber-400 transition-colors">
                            Total Volume
                        </span>
                        <div className="flex flex-col items-center">
                            <span className="text-5xl md:text-6xl font-black text-white mb-2">
                                {communityStats.user_stats.total_content}
                            </span>
                            <span className="text-xs text-zinc-600 uppercase tracking-widest">
                                Avg: {Math.round(communityStats.avg_total_content)}
                            </span>
                        </div>
                    </div>

                    {/* Active Streak */}
                    <div className="group">
                        <span className="block text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] mb-2 group-hover:text-orange-400 transition-colors">
                            Active Streak
                        </span>
                        <div className="flex flex-col items-center">
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-5xl md:text-6xl font-black text-white">
                                    {communityStats.user_stats.streak}
                                </span>
                                <span className="text-xl font-bold text-zinc-500 mb-2">Days</span>
                            </div>
                            <span className="text-xs text-zinc-600 uppercase tracking-widest">
                                Avg: {Math.round(communityStats.avg_streak)}
                            </span>
                        </div>
                    </div>

                    {/* Rewatch Loyalty */}
                    {/* Rewatch Loyalty */}
                    <div className="group">
                        <span className="block text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] mb-2 group-hover:text-purple-400 transition-colors">
                            Loyalty
                        </span>
                        <div className="flex flex-col items-center">
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-5xl md:text-6xl font-black text-white">
                                    {communityStats.user_stats.rewatches}
                                </span>
                                <span className="text-xl font-bold text-zinc-500 mb-2">Titles</span>
                            </div>
                            <span className="text-xs text-zinc-600 uppercase tracking-widest">
                                Avg: {Math.round(communityStats.avg_rewatch_count)}
                            </span>
                        </div>
                    </div>
                </div>

                <p className="absolute bottom-12 font-mono text-[10px] uppercase tracking-[0.3em] opacity-40">
                    {communityStats.user_percentile.total_content > 75 ? 'Community Leader' :
                        communityStats.user_percentile.total_content > 50 ? 'Rising Star' : 'Viewer'}
                </p>
            </div>
        ] : []),

        // Slide 8: Personality (Viewing DNA)
        <div key="personality" className="h-full flex flex-col justify-center items-center p-8 bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-indigo-500/5 rounded-full blur-[100px]" />

            {/* Massive Archetype Header */}
            <div className="relative z-10 text-center mb-20">
                <span className="block text-xs font-mono text-indigo-400 uppercase tracking-[0.4em] mb-4">Your 2026 Archetype</span>
                <span className="block text-[15vw] leading-[0.9] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-purple-300 to-pink-300 pb-8 transition-transform duration-700 hover:scale-[1.02]">
                    {viewingStyle}
                </span>
            </div>

            {/* Grid Stats */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-24 text-center w-full max-w-6xl">
                {/* Top Vibe */}
                <div className="group">
                    <span className="block text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] mb-4 group-hover:text-purple-400 transition-colors">
                        Top Vibe
                    </span>
                    <span className="block text-3xl md:text-4xl font-black text-white">
                        {Object.keys(stats.genre_counts).sort((a, b) => stats.genre_counts[b] - stats.genre_counts[a])[0] || 'Eclectic'}
                    </span>
                </div>

                {/* Diversity */}
                <div className="group">
                    <span className="block text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] mb-4 group-hover:text-pink-400 transition-colors">
                        Range
                    </span>
                    <div className="flex flex-col items-center">
                        <div className="flex items-end gap-2">
                            <span className="block text-5xl md:text-6xl font-black text-white">
                                {Object.keys(stats.genre_counts).length}
                            </span>
                            <span className="text-lg font-bold text-zinc-500 mb-2">Genres</span>
                        </div>
                    </div>
                </div>

                {/* Nostalgia */}
                <div className="group">
                    <span className="block text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] mb-4 group-hover:text-indigo-400 transition-colors">
                        Nostalgia
                    </span>
                    <div className="flex flex-col items-center">
                        <div className="flex items-end gap-2">
                            <span className="block text-5xl md:text-6xl font-black text-white">
                                {nostalgiaScore}%
                            </span>
                            <span className="text-lg font-bold text-zinc-500 mb-2">Retro</span>
                        </div>
                    </div>
                </div>
            </div>

            <p className="absolute bottom-12 font-mono text-[10px] uppercase tracking-[0.3em] opacity-40">
                StreamWrapp • 2026 Edition
            </p>
        </div>,

        // Slide 9: Summary - Minimalist Maximalism Redesign
        <div key="summary" className="h-full flex flex-col justify-center items-center p-8 bg-zinc-950 text-white relative overflow-hidden">
            {/* Background Texture */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />

            {/* Massive Background Year - The "Maximalist" Element */}
            <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none overflow-hidden">
                <span className="text-[35vw] font-black tracking-tighter text-zinc-900/50 scale-150 transform rotate-[-5deg] mix-blend-color-dodge blur-sm">
                    2026
                </span>
            </div>

            <div className="relative z-20 w-full max-w-6xl flex flex-col h-full justify-between py-24">

                {/* Header - The "Minimalist" Element */}
                <div className="text-center">
                    <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-[0.5em] mb-2">StreamWrapp</h2>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase">The Final Cut</h1>
                </div>

                {/* Stats Layout - High Contrast Overlay */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left items-end">

                    {/* Stat 1: Volume */}
                    <div className="group flex flex-col items-center md:items-start border-l-2 border-zinc-800 pl-6 hover:border-white transition-colors duration-500">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Total Volume</span>
                        <span className="text-6xl md:text-7xl font-black text-white leading-[0.8]">
                            {stats.total_movies + stats.total_shows}
                        </span>
                        <span className="text-sm font-bold text-zinc-600 mt-2">Titles Watched</span>
                    </div>

                    {/* Stat 2: Time */}
                    <div className="group flex flex-col items-center md:items-start border-l-2 border-zinc-800 pl-6 hover:border-white transition-colors duration-500">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Active Streak</span>
                        <span className="text-6xl md:text-7xl font-black text-white leading-[0.8]">
                            {stats.streak_days}
                        </span>
                        <span className="text-sm font-bold text-zinc-600 mt-2">Consecutive Days</span>
                    </div>

                    {/* Stat 3: Vibe */}
                    <div className="group flex flex-col items-center md:items-start border-l-2 border-zinc-800 pl-6 hover:border-white transition-colors duration-500">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Top Vibe</span>
                        <span className="text-4xl md:text-5xl font-black text-white leading-[0.9] break-words max-w-[200px] uppercase">
                            {Object.entries(stats.genre_counts || {}).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || '-'}
                        </span>
                        <span className="text-sm font-bold text-zinc-600 mt-2">Most Watched</span>
                    </div>

                    {/* Stat 4: Archetype */}
                    <div className="group flex flex-col items-center md:items-start border-l-2 border-zinc-800 pl-6 hover:border-white transition-colors duration-500">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Archetype</span>
                        <span className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 leading-[0.9] uppercase">
                            {viewingStyle.split(' ')[0]}
                        </span>
                        <span className="text-sm font-bold text-zinc-600 mt-2">Your Persona</span>
                    </div>

                </div>

                {/* Footer Action */}
                <div className="flex justify-center mt-12 relative z-50">
                    <button
                        onClick={onClose}
                        className="group relative px-16 py-6 border border-zinc-700 hover:border-white bg-black hover:bg-zinc-900 transition-all duration-500 cursor-pointer pointer-events-auto"
                    >
                        <span className="relative z-10 text-xs font-black uppercase tracking-[0.4em] text-white group-hover:text-white transition-colors">
                            Close Wrapped 2026
                        </span>
                        {/* Minimal corners */}
                        <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>

                <div className="absolute bottom-8 w-full text-center">
                    <p className="font-mono text-[9px] uppercase tracking-[0.5em] opacity-30 text-zinc-500">
                        StreamWrapp • Generated {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    ];

    return (
        <div className="fixed inset-0 z-[200] bg-black text-white">

            {/* Progress Bar (Centered & Minimal) */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-sm flex gap-2 z-50 px-4">
                {slides.map((_, idx) => (
                    <div key={idx} className="h-1 flex-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-zinc-600 transition-all duration-300 ${idx < currentSlide ? 'w-full' :
                                idx === currentSlide ? 'w-full' : 'w-0'
                                }`}
                        />
                    </div>
                ))}
            </div>

            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-8 right-8 z-50 p-3 bg-black/20 hover:bg-black/50 backdrop-blur-xl rounded-full text-white/70 hover:text-white border border-white/10 transition-all"
            >
                <X size={24} />
            </button>

            {/* Tap Navigation Zones */}
            <div className="absolute inset-0 z-10 flex">
                <div className="w-1/3 h-full" onClick={prevSlide} />
                <div className="w-2/3 h-full" onClick={nextSlide} />
            </div>

            {/* Current Slide (Full Screen) */}
            <div className="w-full h-full animate-in fade-in duration-500">
                {slides[currentSlide]}
            </div>

        </div>
    );
};
