import React, { useEffect, useMemo, useState } from 'react';
import { Search, Send, X } from 'lucide-react';
import { SocialService } from '../lib/social';
import type { Movie, Profile, SharedMoviePayload } from '../types';

interface ShareMovieModalProps {
    movie: Movie;
    onClose: () => void;
}

const toSharedMoviePayload = (movie: Movie): SharedMoviePayload => ({
    tmdbId: movie.tmdbId || movie.id,
    title: movie.title,
    mediaType: movie.mediaType || 'movie',
    year: movie.year,
    imageUrl: movie.imageUrl,
    backdropUrl: movie.backdropUrl,
    description: movie.description,
});

export const ShareMovieModal: React.FC<ShareMovieModalProps> = ({ movie, onClose }) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadProfiles = async () => {
            try {
                const nextProfiles = await SocialService.listMessageableProfiles();
                if (!isMounted) return;
                setProfiles(nextProfiles);
                if (nextProfiles.length > 0) {
                    setSelectedProfileId(nextProfiles[0].id);
                }
            } catch (error) {
                console.error('Failed to load share targets:', error);
                if (isMounted) {
                    setErrorMessage(error instanceof Error ? error.message : 'Unable to load mutual followers.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void loadProfiles();

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredProfiles = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return profiles;
        return profiles.filter((profile) => profile.username.toLowerCase().includes(query));
    }, [profiles, searchQuery]);

    const handleSend = async () => {
        if (!selectedProfileId || sending) return;

        setSending(true);
        setErrorMessage(null);
        setStatusMessage(null);

        try {
            await SocialService.sendMovieShare(selectedProfileId, toSharedMoviePayload(movie), note.trim() || undefined);
            setStatusMessage('Title shared successfully.');
            window.setTimeout(onClose, 700);
        } catch (error) {
            console.error('Failed to share movie:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Unable to share this title.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
            <div className="relative w-full max-w-[720px] overflow-hidden rounded-[30px] border border-white/10 bg-[#101116] shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-all hover:border-white/20 hover:text-white"
                >
                    <X size={16} />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="border-b border-white/8 bg-black/20 p-5 md:border-b-0 md:border-r">
                        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/5">
                            <img
                                src={movie.imageUrl}
                                alt={movie.title}
                                className="aspect-[2/3] w-full object-cover"
                            />
                            <div className="p-4">
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                    Sharing now
                                </div>
                                <div className="mt-2 text-lg font-semibold text-white">
                                    {movie.title}
                                </div>
                                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                    {movie.mediaType === 'tv' ? 'Series' : 'Movie'}{movie.year ? ` · ${movie.year}` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 md:p-6">
                        <div className="pr-10">
                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                                Direct Share
                            </div>
                            <h2 className="mt-3 text-3xl font-light tracking-tight text-white">
                                Send this title to a mutual follower
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                                Only users who follow each other can receive DMs or movie shares.
                            </p>
                        </div>

                        <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
                                <Search size={16} className="text-zinc-500" />
                                <input
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search mutual followers..."
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto custom-scrollbar">
                            {loading && (
                                <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-400">
                                    Loading mutual followers...
                                </div>
                            )}

                            {!loading && filteredProfiles.length === 0 && (
                                <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-zinc-500">
                                    No mutual followers available yet. Both users need to follow each other before sharing titles in DMs.
                                </div>
                            )}

                            {filteredProfiles.map((profile) => (
                                <button
                                    key={profile.id}
                                    type="button"
                                    onClick={() => setSelectedProfileId(profile.id)}
                                    className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition-all ${
                                        selectedProfileId === profile.id
                                            ? 'border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.13),rgba(255,255,255,0.05))]'
                                            : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <img
                                        src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`}
                                        alt={profile.username}
                                        className="h-11 w-11 rounded-full border border-white/10 object-cover"
                                    />
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-white">{profile.username}</div>
                                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                            Mutual follow
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="mt-5">
                            <textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                rows={3}
                                placeholder="Add a short note (optional)"
                                className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-relaxed text-white outline-none placeholder:text-zinc-500"
                            />
                        </div>

                        {errorMessage && (
                            <div className="mt-4 rounded-[18px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {errorMessage}
                            </div>
                        )}

                        {statusMessage && (
                            <div className="mt-4 rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                                {statusMessage}
                            </div>
                        )}

                        <div className="mt-5 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300 transition-all hover:border-white/20 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSend()}
                                disabled={!selectedProfileId || sending || loading}
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-black transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Send size={14} />
                                {sending ? 'Sharing...' : 'Share title'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
