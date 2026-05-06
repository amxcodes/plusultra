import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';

type AnnouncementItem = {
    id: string;
    title: string;
    content: string;
    type: 'warning' | 'success' | 'info' | string;
    created_at: string;
};

const getTypeConfig = (type: string) => {
    switch (type) {
        case 'warning':
            return {
                label: 'Important',
                className: 'text-amber-200 bg-amber-500/10',
            };
        case 'success':
            return {
                label: 'Shipped',
                className: 'text-emerald-200 bg-emerald-500/10',
            };
        default:
            return {
                label: 'Update',
                className: 'text-sky-200 bg-sky-500/10',
            };
    }
};

export const MobileAnnouncementsPage: React.FC = () => {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await SocialService.getAnnouncements();
                setAnnouncements((data || []) as AnnouncementItem[]);
                if (user?.id) {
                    await SocialService.markAnnouncementsSeen(user.id);
                }
            } catch (error) {
                console.error('Failed to load announcements', error);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [user?.id]);

    return (
        <div className="min-h-screen bg-[#0f1014] pb-24">
            <div className="border-b border-white/6 px-4 pb-4 pt-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                    Announcements
                </div>
                <h1 className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.05em] text-white">
                    Platform updates
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
                    Important notices and release notes in one clean feed.
                </p>
            </div>

            <div className="px-4">
                {loading ? (
                    <div className="space-y-8 pt-6">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="animate-pulse border-t border-white/6 pt-6">
                                <div className="mb-3 h-5 w-24 rounded bg-white/5" />
                                <div className="mb-3 h-7 w-4/5 rounded bg-white/5" />
                                <div className="space-y-2">
                                    <div className="h-4 w-full rounded bg-white/5" />
                                    <div className="h-4 w-5/6 rounded bg-white/5" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="border-t border-white/6 py-14">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Nothing published
                        </div>
                        <div className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">
                            No announcements yet
                        </div>
                        <p className="mt-3 text-sm leading-6 text-zinc-500">
                            Updates will appear here once they are published.
                        </p>
                    </div>
                ) : (
                    <section className="space-y-0 pt-2">
                        {announcements.map((item, index) => {
                            const config = getTypeConfig(item.type);

                            return (
                                <article
                                    key={item.id}
                                    className={`border-t border-white/6 py-6 ${index === announcements.length - 1 ? 'border-b' : ''}`}
                                >
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${config.className}`}>
                                            {config.label}
                                        </span>
                                        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                                            {new Date(item.created_at).toLocaleDateString(undefined, {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </span>
                                    </div>

                                    <h2 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.045em] text-white">
                                        {item.title}
                                    </h2>
                                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                                        {item.content}
                                    </p>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </div>
    );
};
