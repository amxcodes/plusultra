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

export const AnnouncementsPage: React.FC = () => {
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

    if (loading) {
        return (
            <div className="min-h-screen w-full pl-24 pr-12 pt-18 pb-24">
                <div className="mx-auto max-w-[920px] animate-pulse">
                    <div className="mb-10">
                        <div className="mb-3 h-3 w-24 rounded bg-white/5" />
                        <div className="mb-4 h-12 w-72 rounded bg-white/5" />
                        <div className="h-5 w-80 rounded bg-white/5" />
                    </div>
                    <div className="space-y-10">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="border-t border-white/6 pt-8">
                                <div className="mb-3 h-5 w-36 rounded bg-white/5" />
                                <div className="mb-3 h-8 w-3/4 rounded bg-white/5" />
                                <div className="space-y-2">
                                    <div className="h-4 w-full rounded bg-white/5" />
                                    <div className="h-4 w-5/6 rounded bg-white/5" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full pl-24 pr-12 pt-18 pb-24">
            <div className="mx-auto max-w-[920px]">
                <header className="mb-10">
                    <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                        Announcements
                    </div>
                    <h1 className="mt-3 text-[50px] font-semibold leading-none tracking-[-0.06em] text-white">
                        Platform updates
                    </h1>
                    <p className="mt-4 max-w-2xl text-[16px] leading-7 text-zinc-400">
                        Important notices, release notes, and product changes in one clean stream.
                    </p>
                </header>

                {announcements.length === 0 ? (
                    <div className="border-t border-white/6 py-14">
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Nothing published
                        </div>
                        <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                            No announcements yet
                        </div>
                        <p className="mt-3 text-sm leading-6 text-zinc-500">
                            Updates will appear here once they are published.
                        </p>
                    </div>
                ) : (
                    <section className="space-y-0">
                        {announcements.map((item, index) => {
                            const config = getTypeConfig(item.type);

                            return (
                                <article
                                    key={item.id}
                                    className={`grid gap-5 border-t border-white/6 py-8 md:grid-cols-[132px_minmax(0,1fr)] ${index === announcements.length - 1 ? 'border-b' : ''}`}
                                >
                                    <div className="space-y-3">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${config.className}`}>
                                            {config.label}
                                        </span>
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                                            {new Date(item.created_at).toLocaleDateString(undefined, {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.045em] text-white">
                                            {item.title}
                                        </h2>
                                        <p className="mt-4 max-w-3xl text-[15px] leading-7 text-zinc-400">
                                            {item.content}
                                        </p>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </div>
    );
};
