import React, { useState, useEffect } from 'react';
import { CommunityService, MovieRequest, RequestReply } from '../lib/community';
import { Search, Plus, ThumbsUp, MessageSquarePlus, MessageSquare, ExternalLink, Loader2, X, Check, ArrowRight } from 'lucide-react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';

import { useToast } from '../lib/ToastContext';

export const RequestsPage: React.FC = () => {
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = useState<'open' | 'fulfilled'>('open');
    const [requests, setRequests] = useState<MovieRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Initial Load
    useEffect(() => {
        loadRequests();
    }, [activeTab]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await CommunityService.getRequests(activeTab);
            setRequests(data);
        } catch (e) {
            console.error("Failed to load requests", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Mobile View - Visible only on small screens */}
            <div className="md:hidden">
                <MobileRequestsView
                    requests={requests}
                    loading={loading}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onOpenCreate={() => setIsCreateModalOpen(true)}
                    onReplyAdded={loadRequests}
                />
            </div>

            {/* Desktop View - Hidden on mobile, visible on medium+ */}
            <div className="hidden md:block text-white font-sans max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-32">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl md:text-5xl font-black mb-3">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-zinc-500">
                                Community Requests
                            </span>
                        </h1>
                        <p className="text-zinc-400 text-lg max-w-xl">
                            Can't find what you're looking for? Request it and let the community help you find the best links.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="group flex items-center gap-2 bg-white text-black px-6 py-4 rounded-full font-bold hover:scale-105 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
                    >
                        <Plus size={20} strokeWidth={3} />
                        <span>Make Request</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex justify-center md:justify-start mb-10">
                    <div className="bg-white/5 p-1 rounded-full backdrop-blur-xl border border-white/10 flex gap-1">
                        <button
                            onClick={() => setActiveTab('open')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'open' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        >
                            Active Requests
                        </button>
                        <button
                            onClick={() => setActiveTab('fulfilled')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'fulfilled' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        >
                            Fulfilled
                        </button>
                    </div>
                </div>

                {/* Request Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <Loader2 className="animate-spin text-zinc-500" size={48} />
                        <p className="text-zinc-500 font-medium animate-pulse">Loading requests...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
                        <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl rotate-3">
                            <MessageSquarePlus size={48} className="text-zinc-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No Requests Found</h3>
                        <p className="text-zinc-500 max-w-md">
                            {activeTab === 'open'
                                ? "Looks like everyone is happy! Currently there are no open requests. Why not start one?"
                                : "No fulfilled requests yet. Be the first hero to solve a request!"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {requests.map(req => (
                            <RequestCard key={req.id} request={req} onReplyAdded={loadRequests} />
                        ))}
                    </div>
                )}
            </div>

            <CreateRequestModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreated={() => {
                    setActiveTab('open');
                    loadRequests();
                }}
            />
        </>
    );
};

// --- Mobile Specific View ---

const MobileRequestsView: React.FC<{
    requests: MovieRequest[];
    loading: boolean;
    activeTab: 'open' | 'fulfilled';
    setActiveTab: (tab: 'open' | 'fulfilled') => void;
    onOpenCreate: () => void;
    onReplyAdded: () => void;
}> = ({ requests, loading, activeTab, setActiveTab, onOpenCreate, onReplyAdded }) => {
    return (
        <div className="pb-32 bg-black min-h-screen">
            {/* Sticky Header with Controls */}
            <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-white">Requests</h1>
                        <p className="text-xs text-zinc-400 font-medium">Community powered content</p>
                    </div>
                    <button
                        onClick={onOpenCreate}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black shadow-lg shadow-white/10 active:scale-95 transition-transform"
                    >
                        <Plus size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Mobile Tabs */}
                <div className="flex p-1 bg-zinc-900/50 rounded-xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('open')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'open' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                        Open
                    </button>
                    <button
                        onClick={() => setActiveTab('fulfilled')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'fulfilled' ? 'bg-green-900/30 text-green-400 shadow-sm' : 'text-zinc-500'}`}
                    >
                        Fulfilled
                    </button>
                </div>
            </div>

            {/* Mobile Content List */}
            <div className="px-4 py-4 space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-zinc-500" size={32} />
                        <p className="text-xs text-zinc-600 font-bold uppercase tracking-wider">Loading</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-white/5 -rotate-3">
                            <MessageSquarePlus size={32} className="text-zinc-600" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">It's quiet here</h3>
                        <p className="text-xs text-zinc-500">
                            {activeTab === 'open' ? "No pending requests." : "No fulfilled requests yet."}
                        </p>
                    </div>
                ) : (
                    requests.map(req => (
                        <MobileRequestItem key={req.id} request={req} onReplyAdded={onReplyAdded} />
                    ))
                )}
            </div>
        </div>
    );
};

const MobileRequestItem: React.FC<{ request: MovieRequest; onReplyAdded: () => void }> = ({ request, onReplyAdded }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <div
                onClick={() => setIsOpen(true)}
                className="flex gap-3 p-3 bg-zinc-900/30 border border-white/5 rounded-2xl active:scale-[0.98] transition-transform"
            >
                {/* Poster Thumbnail */}
                <div className="w-16 aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden shrink-0 relative">
                    <img src={request.poster_path} className="w-full h-full object-cover" loading="lazy" />
                    {request.status === 'fulfilled' && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[1px]">
                            <Check size={20} className="text-green-400 drop-shadow-md" strokeWidth={3} />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-bold text-white text-sm leading-tight mb-1 truncate pr-2">{request.title}</h3>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                            {request.media_type}
                        </span>
                        {request.reply_count > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                                <MessageSquarePlus size={10} />
                                <span>{request.reply_count}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                        <span className={`text-[10px] font-bold ${request.status === 'fulfilled' ? 'text-green-500' : 'text-zinc-600'}`}>
                            {request.status === 'fulfilled' ? 'Fulfilled' : 'Pending Response'}
                        </span>
                        <ArrowRight size={14} className="text-zinc-700" />
                    </div>
                </div>
            </div>

            <RequestDetailsModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                request={request}
                onUpdate={onReplyAdded}
            />
        </>
    );
};

// --- Sub-Components ---

const RequestCard: React.FC<{ request: MovieRequest; onReplyAdded: () => void }> = ({ request, onReplyAdded }) => {
    const [isReplyOpen, setIsReplyOpen] = useState(false);

    return (
        <>
            <div
                onClick={() => setIsReplyOpen(true)}
                className="group/card cursor-pointer relative"
            >
                {/* Image Container with advanced styling */}
                <div className="aspect-[2/3] relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl transition-all duration-500 group-hover/card:scale-[1.03] group-hover/card:shadow-white/5">
                    <img
                        src={request.poster_path}
                        alt={request.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                        loading="lazy"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-60 group-hover/card:opacity-90 transition-opacity duration-300" />

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                        {request.status === 'fulfilled' ? (
                            <div className="bg-green-500/90 text-black text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg backdrop-blur-md">
                                <Check size={10} strokeWidth={4} />
                                <span>SOLVED</span>
                            </div>
                        ) : (
                            <div className="bg-white/10 text-white border border-white/20 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md">
                                PENDING
                            </div>
                        )}
                    </div>

                    {/* Floating Content */}
                    <div className="absolute inset-x-0 bottom-0 p-4 transform translate-y-2 group-hover/card:translate-y-0 transition-transform duration-300">
                        <h3 className="font-bold text-white leading-tight line-clamp-2 mb-1 drop-shadow-md group-hover/card:text-white transition-colors">
                            {request.title}
                        </h3>
                        <div className="flex items-center justify-between text-xs font-medium text-white/70">
                            <span className="uppercase tracking-wider">{request.media_type}</span>
                            <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                <MessageSquarePlus size={10} />
                                <span>{request.reply_count}</span>
                            </div>
                        </div>

                        {/* CTA Overlay on Hover */}
                        <div className="absolute inset-x-0 top-0 -translate-y-full opacity-0 group-hover/card:opacity-100 transition-all duration-300 flex items-center justify-center pb-8">
                            {/* Styling placeholder for better hover effect if needed, currently reusing content area */}
                        </div>
                    </div>
                </div>
            </div>

            <RequestDetailsModal
                isOpen={isReplyOpen}
                onClose={() => setIsReplyOpen(false)}
                request={request}
                onUpdate={onReplyAdded}
            />
        </>
    );
};

// --- Modals ---

const CreateRequestModal: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: () => void }> = ({ isOpen, onClose, onCreated }) => {
    const { error } = useToast();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState<number | null>(null);

    // Search Effect (Debounced)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 2) {
                setLoading(true);
                try {
                    const hits = await TmdbService.search(query);
                    setResults(hits);
                } catch (e) {
                    console.error("Search failed", e);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = async (movie: Movie) => {
        setSubmitting(movie.id);
        try {
            await CommunityService.createRequest(
                movie.id.toString(),
                movie.mediaType || 'movie',
                movie.title,
                movie.imageUrl
            );
            onCreated();
            onClose();
        } catch (e: any) {
            error(e.message || "Failed to create request");
        } finally {
            setSubmitting(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-[#1a1b20] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-bold text-white">New Request</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="text-zinc-400 hover:text-white" size={20} /></button>
                </div>

                <div className="p-5 shrink-0 bg-[#1a1b20]">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" size={20} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search for a movie or show..."
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:bg-black/60 transition-all font-medium"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 pt-0 space-y-3 custom-scrollbar bg-[#1a1b20]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="animate-spin text-zinc-500" size={32} />
                            <p className="text-zinc-600 text-sm">Searching TMDB...</p>
                        </div>
                    ) : results.map(movie => (
                        <button
                            key={movie.id}
                            onClick={() => handleSelect(movie)}
                            disabled={submitting === movie.id}
                            className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all text-left group active:scale-[0.98]"
                        >
                            <div className="w-14 h-20 bg-zinc-800 rounded-lg overflow-hidden shrink-0 shadow-lg">
                                <img src={movie.imageUrl} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white truncate text-lg">{movie.title}</h4>
                                <p className="text-xs text-zinc-500 font-medium">{movie.year ? movie.year : 'Unknown Year'} • <span className="uppercase">{movie.mediaType}</span></p>
                            </div>
                            {submitting === movie.id ?
                                <Loader2 className="animate-spin text-white" size={20} /> :
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="text-white" size={16} />
                                </div>
                            }
                        </button>
                    ))}
                    {!loading && query.length > 2 && results.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-zinc-500">No results found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RequestDetailsModal: React.FC<{ isOpen: boolean; onClose: () => void; request: MovieRequest; onUpdate: () => void }> = ({ isOpen, onClose, request, onUpdate }) => {
    const { error } = useToast();
    const [replies, setReplies] = useState<RequestReply[]>([]);
    const [loadingReplies, setLoadingReplies] = useState(true);
    const [link, setLink] = useState('');
    const [instructions, setInstructions] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadReplies();
        }
    }, [isOpen]);

    const loadReplies = async () => {
        setLoadingReplies(true);
        try {
            const data = await CommunityService.getLinksForMovie(request.tmdb_id);
            setReplies(data);
        } catch (e) {
            console.error("Failed to load replies", e);
        } finally {
            setLoadingReplies(false);
        }
    };

    const handleVote = async (replyId: string, vote: 1 | -1) => {
        try {
            await CommunityService.voteReply(replyId, vote);
            loadReplies();
        } catch (e) {
            console.error("Failed to vote", e);
        }
    };

    const handleSubmit = async () => {
        if (!link.trim()) return;
        setSubmitting(true);
        try {
            await CommunityService.submitReply(request.id, request.tmdb_id, link, instructions);
            setLink('');
            setInstructions('');
            setShowAddForm(false);
            loadReplies();
            onUpdate();
        } catch (e: any) {
            error("Failed to submit reply");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
            <div className="relative w-full max-w-3xl bg-[#14151a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh] animate-in zoom-in-95 duration-200">

                {/* Poster Side (Hidden on mobile) */}
                <div className="hidden md:block w-1/3 relative bg-black">
                    <img src={request.poster_path} className="w-full h-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#14151a] via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                        <h2 className="text-2xl font-black text-white leading-none mb-2">{request.title}</h2>
                        <span className="inline-block bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-zinc-300 uppercase tracking-wider">{request.media_type}</span>
                    </div>
                </div>

                {/* Content Side */}
                <div className="flex-1 flex flex-col w-full md:w-2/3">
                    <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 md:bg-transparent">
                        <div className="md:hidden">
                            <h2 className="text-xl font-bold text-white truncate max-w-[200px]">{request.title}</h2>
                        </div>
                        <div className="hidden md:block">
                            <h3 className="text-lg font-bold text-white">Community Replies</h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="text-zinc-400 hover:text-white" size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#14151a]">
                        {loadingReplies ? (
                            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-600" size={32} /></div>
                        ) : replies.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                                <MessageSquarePlus className="text-zinc-700 mb-3" size={32} />
                                <p className="text-zinc-500 font-medium">No links yet.</p>
                                <p className="text-zinc-600 text-sm">Be the first to contribute!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {replies.map(reply => (
                                    <div key={reply.id} className="group bg-zinc-900/80 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all hover:bg-zinc-800">
                                        <div className="flex gap-4">
                                            {/* Vote Column */}
                                            <div className="flex flex-col items-center gap-1">
                                                <button
                                                    onClick={() => handleVote(reply.id, 1)}
                                                    className={`p-2 rounded-xl transition-all ${reply.user_vote === 1 ? 'text-green-400 bg-green-500/10' : 'text-zinc-600 hover:text-white hover:bg-white/10'}`}
                                                >
                                                    <ThumbsUp size={18} className={reply.user_vote === 1 ? 'fill-green-400' : ''} />
                                                </button>
                                                <span className={`text-sm font-bold ${reply.upvotes > 0 ? 'text-white' : 'text-zinc-600'}`}>{reply.upvotes}</span>
                                            </div>

                                            {/* Content Column */}
                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${reply.link_type === 'gdrive' ? 'bg-[#1FA463]/20 text-[#20CD77]' :
                                                        reply.link_type === 'mega' ? 'bg-[#D9262C]/20 text-[#FF4D55]' :
                                                            reply.link_type === 'magnet' ? 'bg-purple-500/20 text-purple-400' :
                                                                'bg-zinc-700 text-zinc-300'
                                                        }`}>
                                                        {reply.link_type}
                                                    </span>
                                                    <span className="text-xs text-zinc-600 font-medium">{new Date(reply.created_at).toLocaleDateString()}</span>
                                                </div>

                                                <div className="bg-black/40 rounded-lg p-3 mb-2 border border-white/5 group-hover:border-white/10 transition-colors">
                                                    <div className="text-sm text-zinc-300 font-mono truncate select-all">{reply.content}</div>
                                                </div>

                                                {reply.instructions && (
                                                    <div className="flex gap-2 items-start">
                                                        <div className="w-1 h-full min-h-[12px] bg-yellow-500/50 rounded-full mt-1" />
                                                        <p className="text-xs text-zinc-400 italic leading-relaxed">
                                                            {reply.instructions}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Column */}
                                            <div className="flex flex-col justify-center">
                                                <a
                                                    href={reply.content}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-3 rounded-xl bg-white text-black hover:scale-110 transition-all shadow-lg shadow-white/5"
                                                    title="Open Link"
                                                >
                                                    <ExternalLink size={20} strokeWidth={2.5} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-5 border-t border-white/5 bg-[#14151a]">
                        {!showAddForm ? (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-white font-bold transition-colors flex items-center justify-center gap-2 group"
                            >
                                <Plus size={18} className="group-hover:scale-110 transition-transform" />
                                <span>Add a Link</span>
                            </button>
                        ) : (
                            <div className="animate-in slide-in-from-bottom-4 bg-black/40 p-1 rounded-2xl border border-white/5">
                                <div className="space-y-3 p-4">
                                    <input
                                        value={link}
                                        onChange={e => setLink(e.target.value)}
                                        placeholder="Paste URL or Magnet link here..."
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                                        autoFocus
                                    />
                                    <input
                                        value={instructions}
                                        onChange={e => setInstructions(e.target.value)}
                                        placeholder="Instructions (Optional, e.g. 'Password is 123')"
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                                    />
                                    <div className="flex gap-3 justify-end pt-2">
                                        <button
                                            onClick={() => setShowAddForm(false)}
                                            className="px-5 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={submitting || !link.trim()}
                                            className="px-6 py-2 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/10"
                                        >
                                            {submitting && <Loader2 className="animate-spin" size={14} />}
                                            Submit Link
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
