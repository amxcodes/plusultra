import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { StatsService, UserStats } from '../services/stats';
import { Flame, Film, Tv, TrendingUp, ArrowUpRight, BarChart2 } from 'lucide-react';

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
                <div className="h-24 bg-zinc-900 rounded-xl" />
                <div className="h-48 bg-zinc-900 rounded-xl" />
                <div className="h-48 bg-zinc-900 rounded-xl" />
            </div>
        </div>
    );

    if (!stats) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 pt-6">
            <div className="w-16 h-16 bg-zinc-900/50 rounded-full flex items-center justify-center mb-4 border border-white/5 shadow-2xl">
                <BarChart2 size={24} className="text-zinc-600" />
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
            <div className="flex flex-col gap-4">

                {/* 1. Day Streak */}
                <div className="relative bg-zinc-900/40 p-5 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="absolute top-0 right-0 p-5 opacity-10">
                        <Flame size={48} />
                    </div>
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Current Streak</div>
                            <div className="text-4xl font-bold text-white">{stats.streak_days} <span className="text-sm font-medium text-zinc-600">days</span></div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <Flame size={20} className="text-orange-500" fill="currentColor" />
                        </div>
                    </div>
                </div>

                {/* 2. Grid for Counts */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Movies */}
                    <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                            <Film size={16} className="text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold text-white">{stats.total_movies}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Movie Sessions</div>
                    </div>

                    {/* TV Shows */}
                    <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                            <Tv size={16} className="text-purple-500" />
                        </div>
                        <div className="text-2xl font-bold text-white">{stats.total_shows}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Episode Sessions</div>
                    </div>
                </div>

                {/* 3. Top Genres */}
                <div className="bg-zinc-900/40 p-5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} className="text-zinc-500" />
                        <span className="text-sm font-bold text-white">Top Genres</span>
                    </div>

                    <div className="space-y-4">
                        {sortedGenres.map(([genre, count], idx) => {
                            const countNum = count as number;
                            const percentage = Math.round((countNum / totalGenreCount) * 100);

                            return (
                                <div key={genre}>
                                    <div className="flex justify-between items-end mb-1">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-zinc-600">0{idx + 1}</span>
                                            <span className="text-xs font-medium text-zinc-300">{genre}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-zinc-500">{percentage}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white/40"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {sortedGenres.length === 0 && (
                            <p className="text-xs text-zinc-600 text-center py-4">No genre data yet.</p>
                        )}
                    </div>
                </div>

                {/* 4. Year Progress (Compact) */}
                <div className="bg-zinc-900/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-bold text-white mb-1">{new Date().getFullYear()} Progress</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Time passing by</div>
                    </div>

                    <div className="relative w-16 h-16 flex items-center justify-center">
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
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="8" />
                                        <circle
                                            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"
                                            className="text-white/30"
                                            strokeDasharray="283"
                                            strokeDashoffset={283 - (283 * Number(percent) / 100)}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs font-bold text-white">{percent}%</span>
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
