import React, { useEffect, useRef, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { Movie, Playlist } from '../types';
import { useAuth } from '../lib/AuthContext';
import { useMyList } from '../hooks/useMyList';
import {
    CuratorFeedbackType,
    CuratorMemory,
    CuratorMode,
    CuratorPlaylistDraft,
    CuratorRequest,
    CuratorService,
    CuratorUserContext,
    RankedCuratorMovie,
} from '../services/CuratorService';

interface CuratorLabPageProps {
    onMovieSelect?: (movie: Movie) => void;
    onPlaylistSelect?: (playlist: Playlist) => void;
}

const QUICK_CHIPS = [
    'late night',
    'comfort',
    'gems',
    '<2 hrs',
    'dark',
    'feel good',
];

const getMovieArt = (movie: Movie) => movie.imageUrl || movie.backdropUrl || movie.posterUrl || '';

const getPromptFallback = (mode: CuratorMode, context: CuratorUserContext | null) => {
    const firstSearch = context?.recentSearches?.[0];
    if (mode === 'playlist') {
        return firstSearch
            ? `Playlist based on ${firstSearch}`
            : 'Build a playlist from my history';
    }

    return firstSearch
        ? `Movies like ${firstSearch}`
        : 'Find me something to watch';
};

export const CuratorLabPage: React.FC<CuratorLabPageProps> = ({ onMovieSelect, onPlaylistSelect }) => {
    const { user } = useAuth();
    const { addToList, isInList } = useMyList();
    const [mode, setMode] = useState<CuratorMode>('pick');
    const [prompt, setPrompt] = useState('');
    const [selectedChips, setSelectedChips] = useState<string[]>([]);
    const [context, setContext] = useState<CuratorUserContext | null>(null);
    const [memory, setMemory] = useState<CuratorMemory | null>(null);
    const [request, setRequest] = useState<CuratorRequest | null>(null);
    const [recommendations, setRecommendations] = useState<RankedCuratorMovie[]>([]);
    const [draft, setDraft] = useState<CuratorPlaylistDraft | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingPlaylist, setSavingPlaylist] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [playlistVariant, setPlaylistVariant] = useState(0);
    const requestSequenceRef = useRef(0);
    const dismissedKeysRef = useRef<Set<string>>(new Set());
    const surfacedKeysRef = useRef<Set<string>>(new Set());
    const feedbackLockRef = useRef<string | null>(null);

    const currentPick = recommendations[0] || null;
    const toMovieKey = (movie: Movie) => `${movie.mediaType || 'movie'}:${movie.id}`;

    const toggleChip = (chip: string) => {
        setSelectedChips(prev =>
            prev.includes(chip) ? prev.filter(item => item !== chip) : [...prev, chip]
        );
    };

    const persistMemory = (nextMemory: CuratorMemory) => {
        if (!user?.id) return;
        setMemory(nextMemory);
        void CuratorService.saveMemory(user.id, nextMemory);
    };

    const takeFreshRecommendations = (movies: RankedCuratorMovie[], limit: number) => {
        const fresh: RankedCuratorMovie[] = [];

        for (const movie of movies) {
            const key = toMovieKey(movie);
            if (dismissedKeysRef.current.has(key) || surfacedKeysRef.current.has(key)) {
                continue;
            }

            surfacedKeysRef.current.add(key);
            fresh.push(movie);

            if (fresh.length >= limit) {
                break;
            }
        }

        return fresh;
    };

    const refreshPickMode = async (
        nextPrompt = prompt,
        nextChips = selectedChips,
        loadedContext = context,
        loadedMemory = memory,
        options?: { resetSession?: boolean; trackPrompt?: boolean; appendResults?: boolean }
    ) => {
        if (!loadedContext || !loadedMemory) return;

        const effectivePrompt = nextPrompt.trim() || getPromptFallback('pick', loadedContext);
        const requestId = ++requestSequenceRef.current;
        if (options?.resetSession) {
            dismissedKeysRef.current = new Set();
            surfacedKeysRef.current = new Set();
        }
        setRefreshing(true);
        setStatusMessage(null);

        try {
            const nextRequest = CuratorService.parsePrompt(effectivePrompt, nextChips, 10);
            const nextMemory = options?.trackPrompt === false
                ? loadedMemory
                : CuratorService.appendPrompt(loadedMemory, effectivePrompt);
            persistMemory(nextMemory);
            setRequest(nextRequest);

            const promptSeeds = await CuratorService.resolvePromptSeeds(nextRequest);
            const pool = await CuratorService.buildCandidatePool(nextRequest, loadedContext, nextMemory, promptSeeds);
            const ranked = CuratorService.rankCandidates(pool, nextRequest, loadedContext, nextMemory, promptSeeds);

            if (requestId !== requestSequenceRef.current) {
                return;
            }

            if (options?.appendResults) {
                setRecommendations(prev => {
                    const existingKeys = new Set(prev.map(movie => toMovieKey(movie)));
                    const fresh = takeFreshRecommendations(
                        ranked.filter(movie => !existingKeys.has(toMovieKey(movie))),
                        Math.max(0, 8 - prev.length)
                    );
                    return [...prev, ...fresh];
                });
            } else {
                const fresh = takeFreshRecommendations(ranked, 8);
                setRecommendations(fresh);
            }
            setDraft(null);
            setStatusMessage(ranked.length > 0 ? null : 'Constraints too tight. Try removing a filter.');
        } catch (error) {
            console.error('Failed to refresh picks:', error);
            setStatusMessage('Search failed. Try a different request.');
        } finally {
            setRefreshing(false);
        }
    };

    const handleGenerateDraft = async (
        loadedContext = context,
        loadedMemory = memory,
        variantOverride = playlistVariant
    ) => {
        if (!loadedContext || !loadedMemory) return;

        const effectivePrompt = prompt.trim() || getPromptFallback('playlist', loadedContext);
        setRefreshing(true);
        setStatusMessage(null);

        try {
            const nextMemory = CuratorService.appendPrompt(loadedMemory, effectivePrompt);
            persistMemory(nextMemory);
            setRequest(CuratorService.parsePrompt(effectivePrompt, selectedChips));

            const nextDraft = await CuratorService.generatePlaylistDraft(
                effectivePrompt,
                selectedChips,
                loadedContext,
                nextMemory,
                variantOverride
            );

            setDraft(nextDraft);
            setRecommendations([]);
            setStatusMessage(
                nextDraft.items.length > 0
                    ? null
                    : 'Generated playlist is empty. Try a simpler scope.'
            );
        } catch (error) {
            console.error('Failed to draft:', error);
            setStatusMessage('Generation failed. Try again.');
        } finally {
            setRefreshing(false);
        }
    };

    const bootstrapCurator = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setStatusMessage(null);

        try {
            const [loadedContext, loadedMemory] = await Promise.all([
                CuratorService.loadUserContext(user.id),
                CuratorService.loadMemory(user.id),
            ]);

            setContext(loadedContext);
            setMemory(loadedMemory);

            const starterPrompt = getPromptFallback('pick', loadedContext);
            setPrompt(starterPrompt);
            await refreshPickMode(starterPrompt, [], loadedContext, loadedMemory, { resetSession: true });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void bootstrapCurator();
    }, [user?.id]);

    const handleFeedback = async (feedback: CuratorFeedbackType) => {
        if (!currentPick || !memory) return;
        const currentKey = toMovieKey(currentPick);
        if (feedbackLockRef.current === currentKey) return;

        feedbackLockRef.current = currentKey;
        try {
            dismissedKeysRef.current.add(currentKey);

            const nextMemory = CuratorService.recordFeedback(memory, currentPick, feedback);
            persistMemory(nextMemory);

            const remaining = recommendations.slice(1);
            setRecommendations(remaining);

            if (remaining.length < 3) {
                await refreshPickMode(prompt, selectedChips, context, nextMemory, {
                    trackPrompt: false,
                    appendResults: true,
                });
            }
        } finally {
            feedbackLockRef.current = null;
        }
    };

    const handleSaveDraft = async () => {
        if (!user?.id || !draft) return;

        setSavingPlaylist(true);
        setStatusMessage(null);

        try {
            const playlist = await CuratorService.saveGeneratedPlaylist(user.id, draft, true);
            setStatusMessage('Playlist saved to library.');
            onPlaylistSelect?.(playlist as Playlist);
        } catch (error) {
            console.error('Save failed:', error);
            setStatusMessage('Error saving playlist.');
        } finally {
            setSavingPlaylist(false);
        }
    };

    const handlePrimaryAction = async () => {
        if (mode === 'pick') {
            await refreshPickMode(prompt, selectedChips, context, memory, { resetSession: true });
        } else {
            setPlaylistVariant(0);
            await handleGenerateDraft();
        }
    };

    const handleSaveForLater = async () => {
        if (!currentPick) return;

        try {
            await addToList(currentPick);
            setStatusMessage(`Saved "${currentPick.title}" to My List.`);
        } catch (error) {
            console.error('Save for later failed:', error);
            setStatusMessage('Could not save this pick to My List.');
        }
    };

    const handleRedoDraft = async () => {
        const nextVariant = playlistVariant + 1;
        setPlaylistVariant(nextVariant);
        await handleGenerateDraft(context, memory, nextVariant);
    };

    return (
        <div className="fixed inset-0 z-40 bg-[#0a0a0a] flex flex-col md:pl-[80px] pb-[85px] md:pb-0 text-white font-sans overflow-hidden">
            
            {/* Minimalist Switcher */}
            <div className="flex justify-center pt-4 pb-2 md:pt-6 shrink-0 z-10 w-full relative">
                <div className="flex bg-white/5 backdrop-blur-3xl border border-white/10 rounded-full p-1.5 shadow-2xl">
                    <button
                        onClick={() => setMode('pick')}
                        className={`text-[11px] md:text-[13px] font-black tracking-[0.1em] uppercase transition-all duration-300 px-6 py-2 rounded-full ${
                            mode === 'pick' ? 'bg-gradient-to-b from-white/15 to-white/5 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] text-white' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                    >
                        Pick One
                    </button>
                    <button
                        onClick={() => setMode('playlist')}
                        className={`text-[11px] md:text-[13px] font-black tracking-[0.1em] uppercase transition-all duration-300 px-6 py-2 rounded-full ${
                            mode === 'playlist' ? 'bg-gradient-to-b from-white/15 to-white/5 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] text-white' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                    >
                        Playlist
                    </button>
                </div>
            </div>

            {/* Main Interactive Stage */}
            <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-4 min-h-0 relative overflow-hidden">
                {loading ? (
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest animate-pulse">
                        Loading Context...
                    </div>
                ) : mode === 'pick' ? (
                    /* Pick Mode */
                    currentPick ? (
                        <div className="flex flex-row items-center w-full h-full max-h-[85vh] justify-center gap-4 md:gap-10 px-2 md:px-0">
                            
                            {/* Left Side: Poster container */}
                            <div className="h-[210px] md:h-[360px] aspect-[2/3] bg-zinc-900 overflow-hidden shadow-2xl shrink-0" style={{ borderRadius: '16px' }}>
                                {getMovieArt(currentPick) ? (
                                    <img src={getMovieArt(currentPick)} className="w-full h-full object-cover" alt={currentPick.title} />
                                ) : (
                                    <div className="flex w-full h-full items-center justify-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest">No Image</div>
                                )}
                            </div>
                            
                            {/* Right Side: Text and Actions */}
                            <div className="flex flex-col text-left flex-1 min-w-0 max-w-[280px] md:max-w-sm h-[210px] md:h-[360px]">
                                <div className="flex-1 overflow-hidden min-h-0">
                                    <h2 className="text-lg md:text-3xl font-black text-white mb-2 line-clamp-2 leading-tight">{currentPick.title}</h2>
                                    <p className="text-[11px] md:text-sm text-zinc-400 line-clamp-4 md:line-clamp-6 leading-relaxed pr-2">{currentPick.description}</p>
                                </div>
                                
                                <div className="space-y-2.5 shrink-0 mt-4">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <button
                                            onClick={() => handleFeedback('pass')}
                                            className="flex-1 py-3 md:py-3.5 rounded-[16px] md:rounded-[20px] bg-white/5 border border-white/5 text-zinc-400 text-[9px] md:text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:border-white/10 hover:text-white transition-all shadow-lg"
                                        >
                                            Pass
                                        </button>
                                        <button
                                            onClick={() => onMovieSelect?.(currentPick)}
                                            className="flex-[1.5] py-3 md:py-3.5 rounded-[16px] md:rounded-[20px] bg-white text-black text-[9px] md:text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] active:scale-95"
                                        >
                                            Watch
                                        </button>
                                        <button
                                            onClick={() => handleFeedback('smash')}
                                            className="flex-1 py-3 md:py-3.5 rounded-[16px] md:rounded-[20px] bg-white/5 border border-white/5 text-zinc-400 text-[9px] md:text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:border-white/10 hover:text-white transition-all shadow-lg"
                                        >
                                            Smash
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => void handleSaveForLater()}
                                        disabled={isInList(currentPick.id)}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-[16px] md:rounded-[20px] bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] text-[9px] md:text-xs font-bold uppercase tracking-wider hover:from-white/15 hover:to-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <BookmarkPlus size={15} strokeWidth={1.5} />
                                        {isInList(currentPick.id) ? 'Already In My List' : 'Save For Later'}
                                    </button>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="text-center text-zinc-600 text-[11px] font-black uppercase tracking-widest">
                            No selections available
                        </div>
                    )
                ) : (
                    /* Playlist Creator Mode */
                    draft ? (
                        <div className="flex flex-col items-center w-full h-full pb-2">
                            <div className="text-center shrink-0 mb-4 px-4 pt-2">
                                <h2 className="text-xl font-black text-white mb-1 uppercase tracking-widest">{draft.title}</h2>
                                <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">{draft.items.length} titles generated</p>
                            </div>
                            
                            {/* Scrollable List container */}
                            <div className="w-full max-w-md flex-1 overflow-y-auto mb-5 custom-scrollbar bg-black/40 border border-white/5 p-2 rounded-2xl">
                                {draft.items.map((movie, index) => (
                                    <div
                                        key={movie.id}
                                        onClick={() => onMovieSelect?.(movie)}
                                        className="flex gap-4 p-3 mb-1 cursor-pointer hover:bg-white/5 active:bg-zinc-800 transition-colors rounded-xl"
                                    >
                                        <div className="w-10 h-14 bg-zinc-900 border border-white/5 shrink-0 relative overflow-hidden rounded-md">
                                            {getMovieArt(movie) ? (
                                                <img src={getMovieArt(movie)} className="absolute inset-0 w-full h-full object-cover" alt={movie.title} />
                                            ) : (
                                                <div className="flex w-full h-full items-center justify-center text-[8px] text-zinc-700 font-bold uppercase">No Art</div>
                                            )}
                                        </div>
                                        <div className="flex flex-col justify-center min-w-0 flex-1">
                                            <div className="font-bold text-[13px] text-white truncate mb-1">{index + 1}. {movie.title}</div>
                                            <div className="text-[11px] font-medium text-zinc-500 truncate">
                                                {movie.curatorReasons[0] || movie.description}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Draft Buttons */}
                            <div className="w-full max-w-sm shrink-0 flex gap-2 pt-2">
                                <button
                                    onClick={() => void handleRedoDraft()}
                                    className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[11px] font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all shadow-lg shrink-0"
                                >
                                    Redo
                                </button>
                                <button
                                    onClick={() => handleSaveDraft()}
                                    disabled={savingPlaylist}
                                    className="flex-1 px-8 py-3 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] disabled:opacity-50 active:scale-95"
                                >
                                    {savingPlaylist ? 'Saving...' : 'Save Playlist'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-zinc-600 text-[11px] font-black uppercase tracking-widest">
                            Build a custom set
                        </div>
                    )
                )}
            </div>

            {/* Bottom Form Area (Modern Chat Bar) */}
            <div className="shrink-0 w-full max-w-4xl mx-auto px-4 pb-4 mt-auto">
                <div className="flex flex-col gap-0 md:gap-3 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 rounded-[24px] md:rounded-[28px] p-1 md:p-3 shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
                    
                    {/* Inner Quick Chips Centered Row */}
                    <div className="hidden md:flex flex-wrap justify-center md:justify-start gap-2 pb-1 pt-1 px-2 shrink-0 w-full">
                        {QUICK_CHIPS.map(chip => {
                            const active = selectedChips.includes(chip);
                            return (
                                <button
                                    key={chip}
                                    onClick={() => toggleChip(chip)}
                                    className={`shrink-0 px-3.5 md:px-4 py-2 md:py-2.5 text-[10px] md:text-[11px] font-bold uppercase tracking-widest rounded-[14px] transition-all duration-300 border ${
                                        active
                                            ? 'bg-gradient-to-b from-white/15 to-white/5 border-white/20 text-white shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]'
                                            : 'bg-transparent border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {chip}
                                </button>
                            );
                        })}
                    </div>

                    {/* Chat Input Field Container */}
                    <div className="flex items-center px-3 py-1 md:py-0 md:pb-1 transition-all">
                        <input
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePrimaryAction()}
                            placeholder={getPromptFallback(mode, context)}
                            className="flex-1 bg-transparent px-2 h-10 md:h-12 text-[13px] md:text-[14px] font-medium text-white focus:outline-none placeholder:text-zinc-500 tracking-wide"
                        />
                        <button
                            onClick={handlePrimaryAction}
                            disabled={refreshing}
                            className="h-9 md:h-11 px-4 md:px-6 bg-white text-black text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-xl md:rounded-[14px] flex items-center justify-center disabled:opacity-50 hover:bg-zinc-200 transition-all drop-shadow-[0_0_10px_rgba(255,255,255,0.15)] active:scale-95 shrink-0 ml-2"
                        >
                            {refreshing ? '...' : (mode === 'pick' ? 'Search' : 'Draft')}
                        </button>
                    </div>
                </div>
                
                {/* Status Message Display */}
                {statusMessage && (
                    <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {statusMessage}
                    </div>
                )}
            </div>
        </div>
    );
};
