import React, { useEffect, useState } from 'react';
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
    'trippy',
    'gems',
    '<2 hrs',
    'no anime',
    'dark',
    'feel good',
    'movies',
    'series',
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

    const currentPick = recommendations[0] || null;

    const toggleChip = (chip: string) => {
        setSelectedChips(prev =>
            prev.includes(chip) ? prev.filter(item => item !== chip) : [...prev, chip]
        );
    };

    const persistMemory = (nextMemory: CuratorMemory) => {
        if (!user?.id) return;
        CuratorService.saveMemory(user.id, nextMemory);
        setMemory(nextMemory);
    };

    const refreshPickMode = async (
        nextPrompt = prompt,
        nextChips = selectedChips,
        loadedContext = context,
        loadedMemory = memory
    ) => {
        if (!loadedContext || !loadedMemory) return;

        const effectivePrompt = nextPrompt.trim() || getPromptFallback('pick', loadedContext);
        setRefreshing(true);
        setStatusMessage(null);

        try {
            const nextRequest = CuratorService.parsePrompt(effectivePrompt, nextChips, 10);
            const nextMemory = CuratorService.appendPrompt(loadedMemory, effectivePrompt);
            persistMemory(nextMemory);
            setRequest(nextRequest);

            const promptSeeds = await CuratorService.resolvePromptSeeds(nextRequest);
            const pool = await CuratorService.buildCandidatePool(nextRequest, loadedContext, nextMemory, promptSeeds);
            const ranked = CuratorService.rankCandidates(pool, nextRequest, loadedContext, nextMemory, promptSeeds).slice(0, 8);

            setRecommendations(ranked);
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
                Promise.resolve(CuratorService.getMemory(user.id)),
            ]);

            setContext(loadedContext);
            setMemory(loadedMemory);

            const starterPrompt = getPromptFallback('pick', loadedContext);
            setPrompt(starterPrompt);
            await refreshPickMode(starterPrompt, [], loadedContext, loadedMemory);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void bootstrapCurator();
    }, [user?.id]);

    const handleFeedback = async (feedback: CuratorFeedbackType) => {
        if (!currentPick || !memory) return;

        const nextMemory = CuratorService.recordFeedback(memory, currentPick, feedback);
        persistMemory(nextMemory);

        const remaining = recommendations.slice(1);
        setRecommendations(remaining);

        if (remaining.length < 3) {
            await refreshPickMode(prompt, selectedChips, context, nextMemory);
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
            await refreshPickMode();
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
        <div className="fixed inset-0 z-40 bg-[#0f1014] flex flex-col md:pl-[80px] pb-[85px] md:pb-0 text-white font-sans overflow-hidden">
            
            {/* Minimalist Switcher */}
            <div className="flex justify-center gap-4 pt-4 pb-2 md:pt-6 shrink-0">
                <button
                    onClick={() => setMode('pick')}
                    className={`text-[15px] font-black tracking-[0.2em] uppercase transition-colors ${
                        mode === 'pick' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                >
                    Pick One
                </button>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                <button
                    onClick={() => setMode('playlist')}
                    className={`text-[15px] font-black tracking-[0.2em] uppercase transition-colors ${
                        mode === 'playlist' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                >
                    Playlist
                </button>
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
                            <div className="flex flex-col text-left flex-1 min-w-0 max-w-[280px] md:max-w-sm shrink">
                                <h2 className="text-lg md:text-3xl font-black text-white mb-2 line-clamp-2 leading-tight">{currentPick.title}</h2>
                                <p className="text-[11px] md:text-sm text-zinc-400 line-clamp-4 md:line-clamp-5 mb-5 md:mb-8 leading-relaxed pr-2">{currentPick.description}</p>
                                
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <button
                                            onClick={() => handleFeedback('pass')}
                                            className="flex-1 py-3 md:py-3.5 rounded-xl md:rounded-full bg-zinc-900/50 border border-zinc-700/50 text-zinc-400 text-[9px] md:text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-colors"
                                        >
                                            Pass
                                        </button>
                                        <button
                                            onClick={() => onMovieSelect?.(currentPick)}
                                            className="flex-[1.5] py-3 md:py-3.5 rounded-xl md:rounded-full bg-white text-black text-[9px] md:text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors shadow-lg"
                                        >
                                            Watch
                                        </button>
                                        <button
                                            onClick={() => handleFeedback('smash')}
                                            className="flex-1 py-3 md:py-3.5 rounded-xl md:rounded-full bg-zinc-900/50 border border-zinc-700/50 text-zinc-400 text-[9px] md:text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-colors"
                                        >
                                            Smash
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => void handleSaveForLater()}
                                        disabled={isInList(currentPick.id)}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl md:rounded-full bg-zinc-900/50 border border-zinc-700/50 text-zinc-300 text-[9px] md:text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <BookmarkPlus size={15} />
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
                            <div className="w-full max-w-sm shrink-0 flex gap-2">
                                <button
                                    onClick={() => void handleRedoDraft()}
                                    className="px-6 py-3 rounded-full bg-transparent border border-zinc-700 text-zinc-400 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors shrink-0"
                                >
                                    Redo
                                </button>
                                <button
                                    onClick={() => handleSaveDraft()}
                                    disabled={savingPlaylist}
                                    className="flex-1 px-8 py-3 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors disabled:opacity-50"
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

            {/* Bottom Form Area */}
            <div className="shrink-0 w-full max-w-4xl mx-auto px-4 pb-2 md:pb-4 mt-auto">
                {/* Single Visible Row Quick Chips */}
                <div className="flex flex-nowrap justify-center items-center gap-1.5 md:gap-2 pb-3 w-full overflow-hidden">
                    {QUICK_CHIPS.map(chip => {
                        const active = selectedChips.includes(chip);
                        return (
                            <button
                                key={chip}
                                onClick={() => toggleChip(chip)}
                                className={`min-w-0 shrink px-2 md:px-3 py-1.5 border text-[8.5px] md:text-[9px] font-bold uppercase tracking-wider rounded-lg transition-colors truncate ${
                                    active
                                        ? 'bg-white text-black border-transparent'
                                        : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                                }`}
                            >
                                {chip}
                            </button>
                        );
                    })}
                </div>

                {/* Compact Main Input Element */}
                <div className="flex items-center bg-[#0a0a0c] border border-zinc-800 focus-within:border-zinc-600 rounded-2xl p-1 transition-colors shadow-lg">
                    <input
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePrimaryAction()}
                        placeholder={getPromptFallback(mode, context)}
                        className="flex-1 bg-transparent pl-4 pr-3 h-10 text-[13px] font-medium text-white focus:outline-none placeholder:text-zinc-600"
                    />
                    <button
                        onClick={handlePrimaryAction}
                        disabled={refreshing}
                        className="h-10 px-6 bg-white text-black text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-zinc-200 transition-colors"
                    >
                        {refreshing ? '...' : (mode === 'pick' ? 'Find' : 'Draft')}
                    </button>
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
