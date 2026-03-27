import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { StatsService, UserStats } from '../services/stats';
import { Flame, Film, Tv, TrendingUp, ArrowUpRight, BarChart2, Play } from 'lucide-react';

export const StatsDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            StatsService.getUserStats(user.id).then(data => {
                setStats(data);
                setLoading(false);
            });
        }
    }, [user]);

    if (loading) return (
        <div className="w-full pl-6 md:pl-24 pr-6 md:pr-12 pt-6 min-h-screen text-zinc-100 font-sans">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 animate-pulse">
                <div>
                    <div className="h-4 w-24 bg-zinc-800 rounded mb-2 ml-1" />
                    <div className="h-10 w-48 bg-zinc-800 rounded" />
                </div>
                <div className="h-8 w-32 bg-zinc-800 rounded-full" />
            </div>

            {/* Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-56 bg-gradient-to-tr from-white/10 to-white/5 backdrop-blur-3xl rounded-[32px] border border-white/10 p-6 flex flex-col justify-between animate-pulse">
                        <div className="flex justify-between items-start">
                            <div className="h-3 w-16 bg-white/10 rounded" />
                            <div className="w-8 h-8 bg-white/10 rounded-full" />
                        </div>
                        <div>
                            <div className="h-12 w-24 bg-white/10 rounded mb-4" />
                            <div className="h-2 w-full bg-white/5 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-20">
                {/* Genres Skeleton */}
                <div className="lg:col-span-2 bg-black/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 h-[300px] animate-pulse">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 bg-white/5 rounded-full" />
                        <div className="h-6 w-32 bg-white/5 rounded" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i}>
                                <div className="flex justify-between items-end mb-2">
                                    <div className="h-4 w-24 bg-white/5 rounded" />
                                    <div className="h-3 w-8 bg-white/5 rounded" />
                                </div>
                                <div className="h-[2px] w-full bg-white/5 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Wrapped Card Skeleton */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 h-[300px] flex flex-col justify-center items-center animate-pulse">
                    <div className="h-3 w-20 bg-white/5 rounded mb-4" />
                    <div className="h-12 w-32 bg-white/10 rounded mb-2" />
                    <div className="h-6 w-24 bg-white/5 rounded mb-6" />
                    <div className="w-10 h-10 bg-white/10 rounded-full mb-4" />
                    <div className="h-3 w-24 bg-white/5 rounded" />
                </div>
            </div>
        </div>
    );

    if (!stats) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center px-4">
            <div className="w-24 h-24 bg-black/40 rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-2xl backdrop-blur-xl animate-float">
                <BarChart2 size={32} className="text-zinc-500" />
            </div>
            <h2 className="text-3xl font-light text-white mb-2 tracking-tight">No Data Available</h2>
            <p className="text-zinc-500 max-w-md font-light">
                Your analytics dashboard will light up once you log a few qualified viewing sessions.
            </p>
        </div>
    );

    // Calculate top genres
    const sortedGenres = Object.entries(stats.genre_counts || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);

    const totalGenreCount = sortedGenres.reduce((acc: number, [, count]) => acc + (count as number), 0);

    return (
        <div className="w-full pl-6 md:pl-24 pr-6 md:pr-12 pt-6 min-h-screen text-zinc-100 font-sans selection:bg-orange-500/30">

            {/* Header Section - More Compact */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2 pl-1">
                        <div className="h-px w-6 bg-zinc-800" />
                        <span className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-medium">Analytics</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extralight text-white tracking-tighter">
                        Overview
                    </h1>
                    <p className="mt-3 max-w-xl text-xs text-zinc-500">
                        Stats are based on qualified sessions: movies count after sustained active viewing, and TV counts per qualified episode session.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-full bg-black/40 border border-white/5 text-[10px] font-medium text-zinc-400 backdrop-blur-xl">
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* Faded Gradient Cards Grid - Ultra Compact Aspect Ratios */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

                {/* 1. Day Streak - Glass Pill Nav Style */}
                <div className="group relative h-56 bg-gradient-to-tr from-white/20 to-white/5 rounded-[32px] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-3xl overflow-hidden transition-all duration-700 hover:border-white/30">
                    <div className="relative z-10 h-full p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] group-hover:text-zinc-300 transition-colors">Streak</span>
                                <div className="flex items-center gap-2 text-orange-400 group-hover:text-orange-300 transition-colors">
                                    <Flame size={12} fill="currentColor" className="animate-pulse" />
                                    <span className="text-[10px] font-medium tracking-wide">Active</span>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                                <ArrowUpRight size={14} className="text-zinc-300" />
                            </div>
                        </div>

                        <div>
                            <div className="text-5xl font-thin tracking-tighter text-white cursor-default group-hover:scale-105 origin-left duration-500">
                                {stats.streak_days}
                            </div>
                            {/* Animated Loading Bar */}
                            <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full w-full bg-white/40 group-hover:bg-orange-400 blur-[1px] -translate-x-full group-hover:translate-x-0 transition-all duration-[1.5s] ease-out" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Movies - Glass Pill Nav Style */}
                <div className="group relative h-56 bg-gradient-to-tr from-white/20 to-white/5 rounded-[32px] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-3xl overflow-hidden transition-all duration-700 hover:border-white/30">
                    <div className="relative z-10 h-full p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors text-[10px] font-bold uppercase tracking-[0.2em]">Movies</span>
                            <Film size={16} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
                        </div>

                        <div className="relative">
                            <div className="text-5xl font-thin tracking-tighter text-white cursor-default group-hover:scale-105 origin-left duration-500">
                                {stats.total_movies}
                            </div>
                            <p className="text-[10px] text-zinc-400 font-medium tracking-wide mt-2 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">+ Qualified movie sessions</p>
                        </div>
                    </div>
                </div>

                {/* 3. Shows - Glass Pill Nav Style */}
                <div className="group relative h-56 bg-gradient-to-tr from-white/20 to-white/5 rounded-[32px] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-3xl overflow-hidden transition-all duration-700 hover:border-white/30">
                    <div className="relative z-10 h-full p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors text-[10px] font-bold uppercase tracking-[0.2em]">TV Episodes</span>
                            <Tv size={16} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                        </div>

                        <div>
                            <div className="text-5xl font-thin tracking-tighter text-white cursor-default group-hover:scale-105 origin-left duration-500">
                                {stats.total_shows}
                            </div>
                            <p className="text-[10px] text-zinc-400 font-medium tracking-wide mt-2 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">+ Qualified episode sessions</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Detailed Stats - Reduced Height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-20">

                {/* Minimalist Top Genres - Staggered Bar Animation */}
                <div className="lg:col-span-2 relative bg-black/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 overflow-hidden hover:bg-black/60 hover:border-white/10 transition-all duration-500 group">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-tr from-white/20 to-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]">
                                <TrendingUp size={14} className="text-white" />
                            </div>
                            <span className="text-base font-light tracking-tight text-white group-hover:scale-105 origin-left transition-transform">Top Genres</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {sortedGenres.map(([genre, count], idx) => {
                            const countNum = count as number;
                            const percentage = Math.round((countNum / totalGenreCount) * 100);

                            return (
                                <div key={genre} className="group/bar">
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-bold text-zinc-600 font-mono">0{idx + 1}</span>
                                            <span className="text-xs font-medium text-zinc-300 group-hover/bar:text-white transition-colors">{genre}</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-zinc-500">{percentage}%</span>
                                    </div>

                                    {/* Ultra-thin progress bar with staggered fill animation */}
                                    <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white/40 group-hover/bar:bg-white transition-all duration-1000 ease-out w-0 group-hover/bar:w-full"
                                            style={{ width: `${percentage}%`, transitionDelay: `${idx * 100}ms` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {sortedGenres.length === 0 && (
                            <div className="col-span-2 flex flex-col items-center justify-center py-8 text-zinc-700">
                                <p className="text-xs font-light">Qualified session data will appear here</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Year Progress Tracker */}
                <div className="relative bg-black/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 overflow-hidden flex flex-col justify-center items-center text-center hover:bg-black/60 hover:border-white/10 transition-all duration-500 group">
                    {(() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), 0, 0);
                        const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
                        const oneDay = 1000 * 60 * 60 * 24;
                        const dayOfYear = Math.floor(diff / oneDay);
                        const percent = ((dayOfYear / 365) * 100).toFixed(1);

                        return (
                            <>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-blue-500/5 blur-[60px] rounded-full pointer-events-none transition-colors duration-700" />

                                <div className="relative z-10 w-full">
                                    <span className="inline-block mb-6 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500 group-hover:text-zinc-400 transition-colors">Year Progress</span>

                                    <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                                            <circle
                                                cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
                                                className="text-white/20 group-hover:text-white/40 transition-colors duration-700"
                                                strokeDasharray="283"
                                                strokeDashoffset={283 - (283 * Number(percent) / 100)}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-3xl font-thin tracking-tighter text-white">{percent}%</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-xl font-light text-white tracking-wide">{now.getFullYear()}</h3>
                                        <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase group-hover:text-zinc-400">is passing by</p>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};
