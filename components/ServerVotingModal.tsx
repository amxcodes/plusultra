import React, { useEffect, useState } from 'react';
import { X, Trophy, Check } from 'lucide-react';
import { PlayerProviderAdapter, Provider } from '../lib/playerProviders';
import { StatsService } from '../services/stats';

interface ServerVotingModalProps {
    isOpen: boolean;
    onClose: () => void;
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    currentProvider: Provider;
    providers: PlayerProviderAdapter[];
}

export const ServerVotingModal: React.FC<ServerVotingModalProps> = ({
    isOpen,
    onClose,
    tmdbId,
    mediaType,
    season = 1,
    episode = 1,
    currentProvider,
    providers
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="w-full max-w-[340px] bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative group">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 text-zinc-600 hover:text-white transition-colors bg-transparent hover:bg-white/10 rounded-full p-1.5"
                >
                    <X size={14} />
                </button>

                {!voted ? (
                    <div className="flex flex-col h-full">
                        {/* Compact Header */}
                        <div className="px-5 pt-5 pb-3 text-center">
                            <h3 className="text-base font-bold text-white mb-0.5">Which server worked?</h3>
                            <p className="text-[11px] text-zinc-400">Help the community find the best stream.</p>
                        </div>

                        {/* Scrollable List - Contained properly */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 max-h-[300px]">
                            <div className="flex flex-col gap-1.5 pb-2">
                                {providers.map(p => {
                                    const isCurrent = p.id === currentProvider;
                                    const isBest = p.id === bestServer;

                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => handleVote(p.id)}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200
                                                ${isCurrent
                                                    ? 'bg-white text-black border-transparent shadow-sm'
                                                    : 'bg-zinc-900/40 border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                                                    ${isCurrent ? 'bg-black text-white' : 'bg-white/5 text-zinc-500'}`}>
                                                    {p.name.split(' ')[1]}
                                                </div>

                                                <div className="flex flex-col items-start">
                                                    <span className={`text-xs font-bold leading-tight ${isCurrent ? 'text-black' : 'text-zinc-300'}`}>
                                                        {p.name}
                                                    </span>
                                                    {isBest && (
                                                        <span className={`text-[9px] font-medium flex items-center gap-0.5
                                                            ${isCurrent ? 'text-black/60' : 'text-yellow-500'}`}>
                                                            <Trophy size={8} /> Best
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {isCurrent && (
                                                <div className="px-1.5 py-0.5 bg-black/5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider text-black/60">
                                                    Current
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer with Styled Skip Button */}
                        <div className="p-3 bg-gradient-to-t from-[#09090b] to-[#09090b]/95 border-t border-white/5">
                            <button
                                onClick={onClose}
                                className="w-full py-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5"
                            >
                                Skip, I didn't watch anything
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 text-center flex flex-col items-center animate-in zoom-in-95 duration-300 px-6">
                        <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-3">
                            <Check size={24} strokeWidth={3} />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">Thanks for voting!</h3>
                        <p className="text-[11px] text-zinc-500">
                            Your feedback helps improve the experience.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
