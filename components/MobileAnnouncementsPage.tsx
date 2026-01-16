
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Bell, Sparkles } from 'lucide-react';

export const MobileAnnouncementsPage: React.FC = () => {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await SocialService.getAnnouncements();
                setAnnouncements(data);
                if (user?.id) { await SocialService.markAnnouncementsSeen(user.id); }
            } catch (e) {
                console.error("Failed to load announcements", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.id]);

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'warning': return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
            case 'success': return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
            default: return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1014] pb-24 animate-in fade-in duration-300">
            {/* Mobile Header */}
            <div className="sticky top-0 z-40 bg-[#0f1014]/95 backdrop-blur-xl border-b border-white/5 px-4 pt-4 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 rounded-lg text-white">
                        <Bell size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Updates</h1>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Latest Changes</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse space-y-3">
                            <div className="h-4 w-20 bg-zinc-900 rounded" />
                            <div className="h-32 bg-zinc-900 rounded-2xl" />
                        </div>
                    ))
                ) : announcements.length === 0 ? (
                    <div className="text-center py-20 text-zinc-500 text-sm">No updates yet.</div>
                ) : (
                    <div className="space-y-8 relative border-l border-white/10 ml-2 pl-6">
                        {announcements.map((item) => {
                            const config = getTypeConfig(item.type);
                            return (
                                <div key={item.id} className="relative">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 border-[#0f1014] ${config.color.replace('text-', 'bg-')}`} />

                                    <div className="mb-2 flex items-center justify-between">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${config.bg} ${config.color} border ${config.border}`}>
                                            {item.type}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 font-medium">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">{item.title}</h3>
                                    <div className="text-sm text-zinc-400 leading-relaxed bg-zinc-900/30 p-4 rounded-xl border border-white/5">
                                        {item.content}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
