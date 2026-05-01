import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Film,
    MessageSquareText,
    Search,
    Send,
    Sparkles,
    Tv,
    UserRoundPlus
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import type { DirectConversation, DirectMessage, Movie, Profile } from '../types';

interface MessagesPageProps {
    onMovieSelect: (movie: Movie) => void;
}

const formatConversationTime = (value?: string | null) => {
    if (!value) return '';

    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Now';
    if (diffMinutes < 60) return `${diffMinutes}m`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const toMovieFromShare = (message: DirectMessage): Movie | null => {
    if (!message.shared_movie) return null;

    return {
        id: message.shared_movie.tmdbId,
        tmdbId: message.shared_movie.tmdbId,
        title: message.shared_movie.title,
        mediaType: message.shared_movie.mediaType,
        year: message.shared_movie.year,
        imageUrl: message.shared_movie.imageUrl,
        backdropUrl: message.shared_movie.backdropUrl,
        description: message.shared_movie.description,
        match: 100,
    };
};

export const MessagesPage: React.FC<MessagesPageProps> = ({ onMovieSelect }) => {
    const { user, profile } = useAuth();
    const [conversations, setConversations] = useState<DirectConversation[]>([]);
    const [messageableProfiles, setMessageableProfiles] = useState<Profile[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [composer, setComposer] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [threadLoading, setThreadLoading] = useState(false);
    const [creatingConversationFor, setCreatingConversationFor] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const threadEndRef = useRef<HTMLDivElement | null>(null);

    const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) || null;
    const unreadConversationCount = conversations.filter((conversation) => conversation.unread_count > 0).length;
    const mutualCountLabel = `${messageableProfiles.length.toString().padStart(2, '0')} mutuals`;
    const conversationCountLabel = `${conversations.length.toString().padStart(2, '0')} threads`;

    const filteredConversations = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return conversations;

        return conversations.filter((conversation) => {
            const username = conversation.otherProfile.username.toLowerCase();
            const preview = (conversation.last_message_preview || '').toLowerCase();
            return username.includes(query) || preview.includes(query);
        });
    }, [conversations, searchQuery]);

    const suggestedProfiles = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const existingProfileIds = new Set(conversations.map((conversation) => conversation.otherProfile.id));

        return messageableProfiles.filter((candidate) => {
            if (!candidate.id || existingProfileIds.has(candidate.id)) return false;
            if (!query) return true;
            return candidate.username.toLowerCase().includes(query);
        });
    }, [conversations, messageableProfiles, searchQuery]);

    const loadInbox = async (preserveConversationId?: string | null) => {
        if (!user?.id) return;

        try {
            const [nextConversations, nextProfiles] = await Promise.all([
                SocialService.listDirectConversations(),
                SocialService.listMessageableProfiles(),
            ]);

            setConversations(nextConversations);
            setMessageableProfiles(nextProfiles);

            const desiredConversationId = preserveConversationId || selectedConversationId;
            if (desiredConversationId && nextConversations.some((conversation) => conversation.id === desiredConversationId)) {
                setSelectedConversationId(desiredConversationId);
            } else if (!desiredConversationId && nextConversations.length > 0) {
                setSelectedConversationId(nextConversations[0].id);
            } else if (!nextConversations.some((conversation) => conversation.id === desiredConversationId)) {
                setSelectedConversationId(null);
                setMessages([]);
            }
        } catch (error) {
            console.error('Failed to load inbox:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load messages.');
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (conversationId: string) => {
        setThreadLoading(true);
        try {
            const nextMessages = await SocialService.listDirectMessages(conversationId);
            setMessages(nextMessages);
            await SocialService.markConversationRead(conversationId);
            setConversations((current) => current.map((conversation) => (
                conversation.id === conversationId
                    ? { ...conversation, unread_count: 0 }
                    : conversation
            )));
        } catch (error) {
            console.error('Failed to load conversation:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load conversation.');
        } finally {
            setThreadLoading(false);
        }
    };

    useEffect(() => {
        void loadInbox();
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        const unsubscribe = SocialService.subscribeToInbox(user.id, () => {
            void loadInbox(selectedConversationId);
            if (selectedConversationId) {
                void loadMessages(selectedConversationId);
            }
        });

        return () => unsubscribe();
    }, [selectedConversationId, user?.id]);

    useEffect(() => {
        if (!selectedConversationId) return;
        void loadMessages(selectedConversationId);
    }, [selectedConversationId]);

    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, threadLoading]);

    const handleConversationOpen = (conversationId: string) => {
        setSelectedConversationId(conversationId);
        setErrorMessage(null);
    };

    const handleStartConversation = async (targetProfile: Profile) => {
        setCreatingConversationFor(targetProfile.id);
        setErrorMessage(null);

        try {
            const conversation = await SocialService.getOrCreateDirectConversation(targetProfile.id);
            if (!conversation) {
                throw new Error('Unable to open that conversation right now.');
            }

            setConversations((current) => {
                const exists = current.some((entry) => entry.id === conversation.id);
                if (exists) {
                    return current.map((entry) => entry.id === conversation.id ? conversation : entry);
                }

                return [conversation, ...current];
            });
            setSelectedConversationId(conversation.id);
        } catch (error) {
            console.error('Failed to start conversation:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Unable to start conversation.');
        } finally {
            setCreatingConversationFor(null);
        }
    };

    const handleSend = async () => {
        if (!selectedConversation || !composer.trim() || isSending) return;

        setIsSending(true);
        setErrorMessage(null);

        try {
            await SocialService.sendTextMessage(selectedConversation.otherProfile.id, composer.trim());
            setComposer('');
            await loadInbox(selectedConversation.id);
            await loadMessages(selectedConversation.id);
        } catch (error) {
            console.error('Failed to send message:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Message failed to send.');
        } finally {
            setIsSending(false);
        }
    };

    const renderMessageBubble = (message: DirectMessage) => {
        const isMine = message.sender_id === user?.id;
        const sharedMovie = toMovieFromShare(message);

        return (
            <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
                <div
                    className={`max-w-[88%] rounded-[24px] border px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${
                        isMine
                            ? 'border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] text-white'
                            : 'border-white/8 bg-[#15161b] text-zinc-100'
                    }`}
                >
                    {message.body && (
                        <p className="text-sm leading-relaxed text-inherit whitespace-pre-wrap">
                            {message.body}
                        </p>
                    )}

                    {sharedMovie && (
                        <button
                            type="button"
                            onClick={() => onMovieSelect(sharedMovie)}
                            className="mt-3 block w-[168px] text-left transition-transform hover:scale-[1.02]"
                        >
                            <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#0f1014] shadow-[0_10px_28px_rgba(0,0,0,0.3)] transition-all hover:border-white/20">
                                <div className="relative aspect-[2/3] overflow-hidden">
                                    <img
                                        src={sharedMovie.imageUrl}
                                        alt={sharedMovie.title}
                                        className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent px-3 pb-3 pt-10">
                                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                                            {sharedMovie.mediaType === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                                            Shared title
                                        </div>
                                    </div>
                                </div>
                                <div className="px-3 py-3">
                                    <div className="line-clamp-2 text-sm font-semibold text-white">
                                        {sharedMovie.title}
                                    </div>
                                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                        {sharedMovie.year || 'Library'} / Open title
                                    </div>
                                </div>
                            </div>
                        </button>
                    )}

                    <div className={`mt-2 text-[10px] font-bold uppercase tracking-[0.14em] ${isMine ? 'text-white/45' : 'text-zinc-500'}`}>
                        {formatConversationTime(message.created_at)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0f1014] px-0 pb-20 pt-0 md:pb-10 md:pl-[108px] md:pr-8 md:pt-6">
            <div className="mx-auto w-full max-w-[1520px]">
                <div className="px-4 pt-3 md:px-0 md:pt-0">
                    <div className="rounded-[28px] border border-white/8 bg-[#121318] px-5 py-5 shadow-[0_18px_44px_rgba(0,0,0,0.34)] md:px-6 md:py-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div className="max-w-2xl">
                                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
                                    Mutual Messages
                                </div>
                                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                                    Messages
                                </h1>
                                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                                    Direct threads for mutual followers, with in-app title sharing.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white">
                                    {profile?.username || 'Inbox'}
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white">
                                    {unreadConversationCount} unread
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white">
                                    {mutualCountLabel}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
                            <Search size={16} className="text-zinc-500" />
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search people or message previews..."
                                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid min-h-[72vh] grid-cols-1 gap-4 px-4 md:grid-cols-[360px_minmax(0,1fr)] md:px-0">
                    <aside className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} min-h-[560px] flex-col overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,19,23,0.98),rgba(12,13,17,0.98))] shadow-[0_18px_60px_rgba(0,0,0,0.38)]`}>
                        <div className="border-b border-white/6 p-4">
                            <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-black/20 px-4 py-3">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Inbox rail</div>
                                    <div className="mt-1 text-sm font-semibold text-white">Threads and mutuals</div>
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                                    {conversationCountLabel}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
                            <section>
                                <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                    <MessageSquareText size={12} />
                                    Conversations
                                </div>
                                <div className="space-y-2">
                                    {loading && (
                                        <div className="rounded-[24px] border border-white/8 bg-white/5 px-4 py-4 text-sm text-zinc-400">
                                            Loading inbox...
                                        </div>
                                    )}

                                    {!loading && filteredConversations.length === 0 && (
                                        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-zinc-500">
                                            No conversations yet. Start with a mutual follower below.
                                        </div>
                                    )}

                                    {filteredConversations.map((conversation) => (
                                        <button
                                            key={conversation.id}
                                            type="button"
                                            onClick={() => handleConversationOpen(conversation.id)}
                                            className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${
                                                selectedConversationId === conversation.id
                                                    ? 'border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_16px_34px_rgba(0,0,0,0.25)]'
                                                    : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <img
                                                    src={conversation.otherProfile.avatar_url || `https://ui-avatars.com/api/?name=${conversation.otherProfile.username}`}
                                                    alt={conversation.otherProfile.username}
                                                    className="h-12 w-12 rounded-full border border-white/10 object-cover shadow-[0_10px_20px_rgba(0,0,0,0.25)]"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="truncate text-sm font-semibold text-white">
                                                            {conversation.otherProfile.username}
                                                        </div>
                                                        <div className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                                            {formatConversationTime(conversation.last_message_at)}
                                                        </div>
                                                    </div>
                                                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                                                        {conversation.last_message_preview || 'Say hi and share something worth watching.'}
                                                    </div>
                                                </div>
                                                {conversation.unread_count > 0 && (
                                                    <div className="mt-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-[10px] font-bold text-black">
                                                        {conversation.unread_count}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                    <UserRoundPlus size={12} />
                                    Mutual followers
                                </div>
                                <div className="space-y-2">
                                    {suggestedProfiles.length === 0 && (
                                        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-zinc-500">
                                            Follow each other to unlock new DMs. Shared follows appear here automatically.
                                        </div>
                                    )}

                                    {suggestedProfiles.map((candidate) => (
                                        <button
                                            key={candidate.id}
                                            type="button"
                                            onClick={() => void handleStartConversation(candidate)}
                                            disabled={creatingConversationFor === candidate.id}
                                            className="flex w-full items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition-all hover:border-white/14 hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <img
                                                    src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.username}`}
                                                    alt={candidate.username}
                                                    className="h-11 w-11 rounded-full border border-white/10 object-cover shadow-[0_10px_18px_rgba(0,0,0,0.2)]"
                                                />
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-white">
                                                        {candidate.username}
                                                    </div>
                                                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                                        Mutual follow
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                                                {creatingConversationFor === candidate.id ? 'Opening...' : 'Message'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </aside>

                    <section className={`${selectedConversationId ? 'flex' : 'hidden md:flex'} min-h-[560px] flex-col overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,19,23,0.98),rgba(10,11,15,0.98))] shadow-[0_18px_60px_rgba(0,0,0,0.38)]`}>
                        {selectedConversation ? (
                            <>
                                <div className="border-b border-white/6 p-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedConversationId(null)}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-all hover:border-white/20 hover:text-white md:hidden"
                                            >
                                                <ArrowLeft size={16} />
                                            </button>
                                            <img
                                                src={selectedConversation.otherProfile.avatar_url || `https://ui-avatars.com/api/?name=${selectedConversation.otherProfile.username}`}
                                                alt={selectedConversation.otherProfile.username}
                                                className="h-12 w-12 rounded-full border border-white/10 object-cover shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
                                            />
                                            <div className="min-w-0">
                                                <div className="truncate text-base font-semibold text-white">
                                                    {selectedConversation.otherProfile.username}
                                                </div>
                                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                                    Private thread / mutual follow
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300 md:inline-flex">
                                            {formatConversationTime(selectedConversation.last_message_at) || 'Live'}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-b border-white/6 px-5 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-sm text-zinc-400">
                                            Share recommendations or send titles directly into the app experience.
                                        </div>
                                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                                            {messages.length.toString().padStart(2, '0')} messages
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_35%)] px-5 py-5 custom-scrollbar">
                                    {threadLoading && (
                                        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
                                            Loading conversation...
                                        </div>
                                    )}

                                    {!threadLoading && messages.length === 0 && (
                                        <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[30px] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-6 py-10 text-center">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300">
                                                <Sparkles size={22} />
                                            </div>
                                            <div className="mt-4 text-lg font-semibold text-white">
                                                Start the thread
                                            </div>
                                            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                                                Drop a note or share a title from the app. Only mutual followers can reach each other here.
                                            </p>
                                        </div>
                                    )}

                                    {!threadLoading && messages.map(renderMessageBubble)}
                                    <div ref={threadEndRef} />
                                </div>

                                <div className="border-t border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5">
                                    {errorMessage && (
                                        <div className="mb-3 rounded-[18px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                            {errorMessage}
                                        </div>
                                    )}
                                    <div className="rounded-[28px] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                        <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                            Reply to {selectedConversation.otherProfile.username}
                                        </div>
                                        <div className="flex items-end gap-3">
                                            <textarea
                                                value={composer}
                                                onChange={(event) => setComposer(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' && !event.shiftKey) {
                                                        event.preventDefault();
                                                        void handleSend();
                                                    }
                                                }}
                                                placeholder={`Message ${selectedConversation.otherProfile.username}...`}
                                                rows={1}
                                                className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-zinc-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleSend()}
                                                disabled={!composer.trim() || isSending}
                                                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white text-black transition-all hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full min-h-[560px] flex-col items-center justify-center px-8 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 shadow-[0_14px_36px_rgba(0,0,0,0.28)]">
                                    <MessageSquareText size={24} />
                                </div>
                                <div className="mt-5 text-2xl font-semibold text-white">
                                    Select a conversation
                                </div>
                                <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
                                    Pick an existing thread or start one with a mutual follower. Shared titles open back into the app.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};
