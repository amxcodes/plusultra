import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { StatsService, UserStats } from '../services/stats';
import { Flame, Film, Tv, TrendingUp, BarChart2 } from 'lucide-react';

export const MobileStatsDashboard = () => {
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
        <div className="w-full px-4 pt-6 pb-24 min-h-screen text-zinc-100 font-sans">
            <div className="animate-pulse space-y-4">
                <div className="h-24 bg-white/5 rounded-2xl" />
                <div className="h-24 grid grid-cols-2 gap-3"><div className="bg-white/5 rounded-2xl"/><div className="bg-white/5 rounded-2xl"/></div>
                <div className="h-48 bg-white/5 rounded-2xl" />
                <div className="h-24 bg-white/5 rounded-2xl" />
            </div>
        </div>
    );

    if (!stats) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 pt-6">
            <div className="w-16 h-16 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-2xl">
                <BarChart2 size={24} className="text-zinc-500" />
            </div>
            <h2 className="text-xl font-light text-white mb-2">No Data Available</h2>
            <p className="text-zinc-500 text-sm font-light">
                Start a few qualified sessions to track your stats.
            </p>
        </div>
    );

    // Calculate top genres
    const sortedGenres = Object.entries(stats.genre_counts || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);

    const totalGenreCount = sortedGenres.reduce((acc: number, [, count]) => acc + (count as number), 0);

    return (
        <div className="w-full px-4 pt-6 pb-24 min-h-screen text-zinc-100 font-sans bg-[#0f1014]">

            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-zinc-500 uppercase tracking-[0.2em] text-[10px] font-bold">Analytics</span>
                </div>
                <h1 className="text-3xl font-light text-white tracking-tighter">
                    Your Stats
                </h1>
                <p className="mt-2 text-xs text-zinc-500">
                    Movies count after sustained active viewing. TV counts per qualified episode session.
                </p>
            </div>

            {/* Stats Cards - Vertical Stack */}
            <div className="flex flex-col gap-3">

                {/* 1. Day Streak */}
                <div className="relative bg-gradient-to-tr from-white/20 to-white/5 shadow-[0_4px_15px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-2xl p-5 rounded-[24px] border border-white/10 overflow-hidden group transition-all duration-300">
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <div className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">Current Streak</div>
                            <div className="text-4xl font-bold text-white">{stats.streak_days} <span className="text-sm font-medium text-zinc-400">days</span></div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-md">
                            <Flame size={20} className="text-orange-400" fill="currentColor" />
                        </div>
                    </div>
                </div>

                {/* 2. Grid for Counts */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Movies */}
                    <div className="bg-gradient-to-tr from-white/20 to-white/5 shadow-[0_4px_15px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-2xl p-5 rounded-[24px] border border-white/10 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <Film size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-white tracking-tight">{stats.total_movies}</div>
                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mt-1">Movies</div>
                        </div>
                    </div>

                    {/* TV Shows */}
                    <div className="bg-gradient-to-tr from-white/20 to-white/5 shadow-[0_4px_15px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-2xl p-5 rounded-[24px] border border-white/10 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <Tv size={18} className="text-purple-400" />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-white tracking-tight">{stats.total_shows}</div>
                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mt-1">Episodes</div>
                        </div>
                    </div>
                </div>

                {/* 3. Top Genres */}
                <div className="bg-black/40 backdrop-blur-xl p-6 rounded-[24px] border border-white/5 mt-1">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-tr from-white/20 to-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]">
                            <TrendingUp size={14} className="text-white" />
                        </div>
                        <span className="text-sm font-bold text-white tracking-tight">Top Genres</span>
                    </div>

                    <div className="space-y-4">
                        {sortedGenres.map(([genre, count], idx) => {
                            const countNum = count as number;
                            const percentage = Math.round((countNum / totalGenreCount) * 100);

                            return (
                                <div key={genre}>
                                    <div className="flex justify-between items-end mb-1.5">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-zinc-500 font-bold">0{idx + 1}</span>
                                            <span className="text-xs font-bold text-zinc-300">{genre}</span>
                                        </div>
                                        <span className="text-[10px] font-bold font-mono text-zinc-400">{percentage}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white/40 rounded-full"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {sortedGenres.length === 0 && (
                            <p className="text-xs text-zinc-500 text-center py-4">No genre data yet.</p>
                        )}
                    </div>
                </div>

                {/* 4. Year Progress (Compact) */}
                <div className="bg-black/40 backdrop-blur-xl p-5 rounded-[24px] border border-white/5 flex items-center justify-between mt-1">
                    <div>
                        <div className="text-base font-bold text-white tracking-tight mb-0.5">{new Date().getFullYear()} Progress</div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Time passing by</div>
                    </div>

                    <div className="relative w-14 h-14 flex items-center justify-center">
                        {(() => {
                            const now = new Date();
                            const start = new Date(now.getFullYear(), 0, 0);
                            const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
                            const oneDay = 1000 * 60 * 60 * 24;
                            const dayOfYear = Math.floor(diff / oneDay);
                            const percent = ((dayOfYear / 365) * 100).toFixed(0);

                            return (
                                <>
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                        <circle
                                            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"
                                            className="text-white/30"
                                            strokeDasharray="283"
                                            strokeDashoffset={283 - (283 * Number(percent) / 100)}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[11px] font-bold text-white tracking-tighter">{percent}%</span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

            </div>
        </div>
    );
};
