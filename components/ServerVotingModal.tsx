import React, { useEffect, useState } from 'react';
import { X, Check, ThumbsUp } from 'lucide-react';
import { PROVIDERS, Provider } from './UnifiedPlayer';
import { StatsService } from '../services/stats';

interface ServerVotingModalProps {
    isOpen: boolean;
    onClose: () => void;
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    currentProvider: Provider;
}

export const ServerVotingModal: React.FC<ServerVotingModalProps> = ({
    isOpen,
    onClose,
    tmdbId,
    mediaType,
    season = 1,
    episode = 1,
    currentProvider
}) => {
    const [voted, setVoted] = useState(false);
    const [bestServer, setBestServer] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            StatsService.getBestServer(tmdbId, mediaType, season, episode).then(res => {
                if (res) setBestServer(res.provider_id);
            });
        }
    }, [isOpen, tmdbId, mediaType, season, episode]);

    const handleVote = async (providerId: string) => {
        await StatsService.castVote(tmdbId, mediaType, providerId, season, episode);
        setVoted(true);
        setTimeout(() => {
            onClose();
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#0f1014] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {!voted ? (
                    <>
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-white mb-1">Which server worked?</h3>
                            <p className="text-xs text-zinc-400">Help others find the best quality stream.</p>
                        </div>

                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {PROVIDERS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleVote(p.id)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm
                                        ${p.id === currentProvider
                                            ? 'bg-white/5 border-white/20 text-white'
                                            : 'bg-transparent border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`font-medium ${p.id === currentProvider ? 'text-white' : ''}`}>
                                            {p.name}
                                        </span>
                                        {p.id === bestServer && (
                                            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                Reliable
                                            </span>
                                        )}
                                    </div>
                                    {p.id === currentProvider && <span className="text-[10px] text-zinc-500">Current</span>}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-center">
                            <button
                                onClick={onClose}
                                className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                            >
                                Skip, I didn't watch anything
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="py-8 text-center flex flex-col items-center animate-in zoom-in-95 duration-300">
                        <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4">
                            <ThumbsUp size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Thanks for voting!</h3>
                        <p className="text-sm text-zinc-400">You're making the community better.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
