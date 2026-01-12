import React, { useEffect, useState } from 'react';
import { SocialService } from '../lib/social';
import { Bell, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

export const AnnouncementsPage: React.FC = () => {
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await SocialService.getAnnouncements();
                setAnnouncements(data);
            } catch (e) {
                console.error("Failed to load announcements", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'warning': return { color: 'text-amber-500', bg: 'bg-amber-500', label: 'Important' };
            case 'success': return { color: 'text-emerald-500', bg: 'bg-emerald-500', label: 'New Feature' };
            default: return { color: 'text-blue-500', bg: 'bg-blue-500', label: 'Update' };
        }
    };

    if (loading) {
        return (
            <div className="w-full pl-24 pr-12 pt-20 min-h-screen">
                <div className="max-w-3xl mx-auto">
                    {/* Header Skeleton */}
                    <div className="mb-16 animate-pulse">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-4 h-4 bg-white/5 rounded" />
                            <div className="h-3 w-24 bg-white/5 rounded" />
                        </div>
                        <div className="h-12 w-64 bg-white/5 rounded mb-4" />
                        <div className="h-5 w-96 bg-white/5 rounded" />
                    </div>

                    {/* Timeline Skeleton */}
                    <div className="relative border-l border-white/5 ml-3 space-y-12">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="relative pl-12 animate-pulse">
                                {/* Dot */}
                                <div className="absolute -left-[5px] top-2.5 w-2.5 h-2.5 rounded-full bg-white/5 ring-4 ring-[#0f1014]" />

                                <div className="flex flex-col gap-4">
                                    <div className="flex items-baseline gap-4">
                                        <div className="h-6 w-20 bg-white/5 rounded" />
                                        <div className="h-4 w-32 bg-white/5 rounded" />
                                    </div>
                                    <div>
                                        <div className="h-7 w-3/4 bg-white/5 rounded mb-3" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-full bg-white/5 rounded" />
                                            <div className="h-4 w-5/6 bg-white/5 rounded" />
                                            <div className="h-4 w-4/6 bg-white/5 rounded" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full pl-24 pr-12 pt-20 min-h-screen animate-in fade-in duration-700">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-4 text-zinc-500 uppercase tracking-[0.2em] text-[10px] font-bold">
                        <Sparkles size={14} className="text-white" />
                        Changelog
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-4">
                        What's New
                    </h1>
                    <p className="text-zinc-400 text-lg">
                        Latest updates, improvements, and fixes for the platform.
                    </p>
                </div>

                {/* Timeline */}
                <div className="relative border-l border-white/10 ml-3 space-y-12">
                    {announcements.length > 0 ? (
                        announcements.map((item) => {
                            const config = getTypeConfig(item.type);

                            return (
                                <div key={item.id} className="relative pl-12">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[5px] top-2.5 w-2.5 h-2.5 rounded-full ${config.bg} shadow-[0_0_10px_rgba(var(--tw-shadow-color),0.5)] ring-4 ring-[#0f1014]`} />

                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-baseline gap-4">
                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 border border-white/5 ${config.color}`}>
                                                {config.label}
                                            </span>
                                            <span className="text-xs font-medium text-zinc-500">
                                                {new Date(item.created_at).toLocaleDateString(undefined, {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                            <div className="prose prose-invert prose-sm text-zinc-400 leading-relaxed max-w-none">
                                                <p>{item.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="pl-12 py-8">
                            <p className="text-zinc-600 italic">No updates published yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
