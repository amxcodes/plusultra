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

    if (loading) return <div className="p-20 text-center text-zinc-500 animate-pulse font-light tracking-widest uppercase text-xs">Loading analytics...</div>;

    if (!stats) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center px-4">
            <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl shadow-black/50 backdrop-blur-md animate-float">
                <BarChart2 size={32} className="text-zinc-600" />
            </div>
            <h2 className="text-3xl font-light text-white mb-2 tracking-tight">No Data Available</h2>
            <p className="text-zinc-500 max-w-md font-light">
                Your analytics dashboard will light up once you start watching content.
            </p>
        </div>
    );

    // Calculate top genres
    const sortedGenres = Object.entries(stats.genre_counts || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);

    const totalGenreCount = sortedGenres.reduce((acc: number, [, count]) => acc + (count as number), 0);

    return (
        <div className="w-full pl-24 pr-12 pt-6 min-h-screen animate-in fade-in duration-1000 text-zinc-100 font-sans selection:bg-orange-500/30">

            {/* Header Section - More Compact */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2 pl-1">
                        <div className="h-px w-6 bg-zinc-800" />
                        <span className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-medium">Analytics</span>
                    </div>
                    <h1 className="text-5xl font-extralight text-white tracking-tighter">
                        Overview
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-full bg-zinc-900/30 border border-white/5 text-[10px] font-medium text-zinc-400 backdrop-blur-md">
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* Faded Gradient Cards Grid - Compact Aspect Ratios */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">

                {/* 1. Day Streak (Faded Magma) - Rotating Ring Animation */}
                <div className="group relative h-64 bg-zinc-900/20 rounded-[32px] border border-white/5 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-orange-900/10">
                    <div className="absolute inset-0 bg-[#050505]">
                        <div className="absolute -bottom-1/2 -left-1/4 w-[150%] h-[150%] bg-gradient-to-t from-orange-600/20 via-orange-900/5 to-transparent blur-[80px] opacity-60 group-hover:opacity-80 transition-opacity duration-1000" />
                    </div>

                    <div className="relative z-10 h-full p-8 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Streak</span>
                                <div className="flex items-center gap-2 text-orange-400/80">
                                    <Flame size={12} fill="currentColor" className="animate-pulse" />
                                    <span className="text-[10px] font-medium tracking-wide">Active</span>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 backdrop-blur-sm group-hover:bg-white/10 transition-colors">
                                <ArrowUpRight size={14} className="text-zinc-400" />
                            </div>
                        </div>

                        <div>
                            <div className="text-6xl font-thin tracking-tighter text-white/90 group-hover:text-white transition-colors cursor-default group-hover:scale-105 origin-left duration-500">
                                {stats.streak_days}
                            </div>
                            {/* Animated Loading Bar */}
                            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full w-full bg-gradient-to-r from-orange-500/50 to-orange-200/50 blur-[1px] -translate-x-full group-hover:translate-x-0 transition-transform duration-[1.5s] ease-out" />
                            </div>
                        </div>
                    </div>

                    {/* Rotating Background Ring Decoration */}
                    <div className="absolute -right-12 -top-12 w-48 h-48 border border-white/5 rounded-full border-dashed opacity-20 animate-[spin_10s_linear_infinite]" />
                </div>

                {/* 2. Movies (Deep Ocean) - Floating Bubble Animation */}
                <div className="group relative h-64 bg-zinc-900/20 rounded-[32px] border border-white/5 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-blue-900/10">
                    <div className="absolute inset-0 bg-[#050505]">
                        <div className="absolute -bottom-1/2 -right-1/4 w-[150%] h-[150%] bg-gradient-to-t from-blue-900/30 via-blue-950/10 to-transparent blur-[100px] opacity-60 group-hover:opacity-80 transition-opacity duration-1000" />
                    </div>

                    <div className="relative z-10 h-full p-8 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Movies</span>
                            <Film size={16} className="text-blue-500/50" />
                        </div>

                        <div className="relative">
                            <div className="text-6xl font-thin tracking-tighter text-white/90 group-hover:text-white transition-colors cursor-default group-hover:scale-105 origin-left duration-500">
                                {stats.total_movies}
                            </div>
                            <p className="text-[10px] text-zinc-500 font-medium tracking-wide mt-2 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">+ Films Watched</p>
                        </div>

                        {/* Floating Bubbles Decoration */}
                        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] border border-blue-500/5 rounded-full blur-[2px] transition-transform duration-[3s] group-hover:scale-110" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] border border-blue-500/10 rounded-full blur-[1px] transition-transform duration-[4s] group-hover:scale-125" />
                    </div>
                </div>

                {/* 3. Shows (Midnight Purple) - Pulse Wave Animation */}
                <div className="group relative h-64 bg-zinc-900/20 rounded-[32px] border border-white/5 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-purple-900/10">
                    <div className="absolute inset-0 bg-[#050505]">
                        <div className="absolute bottom-[-50%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-tr from-purple-900/30 via-black to-transparent blur-[100px] opacity-60 group-hover:opacity-80 transition-opacity duration-1000" />
                    </div>

                    <div className="relative z-10 h-full p-8 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">TV Shows</span>
                            <Tv size={16} className="text-purple-500/50" />
                        </div>

                        <div>
                            <div className="text-6xl font-thin tracking-tighter text-white/90 group-hover:text-white transition-colors cursor-default group-hover:scale-105 origin-left duration-500">
                                {stats.total_shows}
                            </div>
                            <p className="text-[10px] text-zinc-500 font-medium tracking-wide mt-2 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">+ Episodes Watched</p>
                        </div>
                    </div>
                    {/* Horizontal Scanline */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-purple-500/20 translate-y-[-100%] group-hover:translate-y-[300px] transition-transform duration-[2s] ease-linear" />
                </div>
            </div>

            {/* Bottom Row: Detailed Stats - Reduced Height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">

                {/* Minimalist Top Genres - Staggered Bar Animation */}
                <div className="lg:col-span-2 relative bg-[#08080a]/50 border border-white/5 rounded-[32px] p-8 overflow-hidden hover:bg-[#08080a] transition-colors duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-full">
                                <TrendingUp size={14} className="text-zinc-400" />
                            </div>
                            <span className="text-base font-light tracking-tight text-white">Top Genres</span>
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
                                    <div className="h-[2px] w-full bg-zinc-900 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white/40 group-hover/bar:bg-orange-500/80 transition-all duration-1000 ease-out w-0 group-hover/bar:w-full"
                                            style={{ width: `${percentage}%`, transitionDelay: `${idx * 100}ms` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {sortedGenres.length === 0 && (
                            <div className="col-span-2 flex flex-col items-center justify-center py-8 text-zinc-700">
                                <p className="text-xs font-light">Watching data will appear here</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2026 Wrapped - Dark & Moody */}
                <div className="relative bg-[#08080a]/50 border border-white/5 rounded-[32px] p-8 overflow-hidden flex flex-col justify-center items-center text-center hover:bg-[#08080a] transition-colors duration-500 group">
                    {/* Very subtle glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-purple-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-purple-500/10 transition-colors duration-700" />

                    <div className="relative z-10">
                        <span className="inline-block mb-4 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600 group-hover:text-zinc-500 transition-colors">Coming Soon</span>

                        <h3 className="text-4xl font-thin text-white mb-1 tracking-tighter group-hover:scale-110 transition-transform duration-700">
                            2026
                        </h3>
                        <div className="text-lg font-light text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-600 mb-6 tracking-wide">
                            Wrapped
                        </div>

                        <div className="w-10 h-10 mx-auto rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-500 mb-4 group-hover:scale-110 group-hover:border-purple-500/30 group-hover:text-purple-400 transition-all duration-500">
                            <Play size={14} fill="currentColor" className="ml-0.5 opacity-50 group-hover:opacity-100" />
                        </div>

                        <p className="text-[10px] text-zinc-600 font-medium tracking-wide">December 1st</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
