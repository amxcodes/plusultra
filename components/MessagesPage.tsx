import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Check,
    CheckCheck,
    Film,
    MessageSquareText,
    Search,
    Send,
    Sparkles,
    Tv,
    UserRoundPlus
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmContext';
import { SocialService } from '../lib/social';
import { useToast } from '../lib/ToastContext';
import type { DirectConversation, DirectMessage, Movie, Profile } from '../types';

interface MessagesPageProps {
    onMovieSelect: (movie: Movie) => void;
    initialConversationId?: string;
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

const statLabelClassName = 'text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500';
const panelClassName = 'rounded-[24px] border border-white/8 bg-[#121318]';

export const MessagesPage: React.FC<MessagesPageProps> = ({ onMovieSelect, initialConversationId }) => {
    const { user, profile } = useAuth();
    const confirm = useConfirm();
    const toast = useToast();
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
    const [unsendingMessageId, setUnsendingMessageId] = useState<string | null>(null);
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
        if (!initialConversationId) return;
        setSelectedConversationId(initialConversationId);
        setErrorMessage(null);
    }, [initialConversationId]);

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

    const handleUnsend = async (message: DirectMessage) => {
        if (!selectedConversation || message.sender_id !== user?.id || unsendingMessageId) return;

        const approved = await confirm({
            title: 'Unsend message?',
            message: 'This will remove the message for both sides of the conversation.',
            confirmText: 'Unsend',
            cancelText: 'Keep message',
            variant: 'warning',
        });

        if (!approved) return;

        setUnsendingMessageId(message.id);
        setErrorMessage(null);

        try {
            await SocialService.deleteDirectMessage(message.id);
            await loadInbox(selectedConversation.id);
            await loadMessages(selectedConversation.id);
            toast.success('Message unsent.');
        } catch (error) {
            console.error('Failed to unsend message:', error);
            const nextError = error instanceof Error ? error.message : 'Unable to unsend that message.';
            setErrorMessage(nextError);
            toast.error(nextError);
        } finally {
            setUnsendingMessageId(null);
        }
    };

    const renderMessageBubble = (message: DirectMessage) => {
        const isMine = message.sender_id === user?.id;
        const sharedMovie = toMovieFromShare(message);
        const MessageStatusIcon = message.read_at ? CheckCheck : Check;
        const messageStatusLabel = message.read_at ? 'Read' : 'Sent';
        const isUnsending = unsendingMessageId === message.id;

        return (
            <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
                <div
                    onDoubleClick={() => {
                        if (isMine && !isUnsending) {
                            void handleUnsend(message);
                        }
                    }}
                    className={`max-w-[88%] md:max-w-[78%] rounded-[20px] border px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)] ${
                        isMine
                            ? 'border-white/14 bg-[#1c1d23] text-zinc-100'
                            : 'border-white/8 bg-[#17181d] text-zinc-100'
                    } ${isMine ? 'cursor-pointer' : ''} ${isUnsending ? 'opacity-60' : ''}`}
                    title={isMine ? 'Double-click to unsend' : undefined}
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
                            className="mt-3 block w-[148px] text-left"
                        >
                            <div className="overflow-hidden rounded-[18px] bg-[#0d0e12] ring-1 ring-white/8 transition-all hover:ring-white/18">
                                <div className="relative aspect-[2/3] overflow-hidden">
                                    <img
                                        src={sharedMovie.imageUrl}
                                        alt={sharedMovie.title}
                                        className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2.5 pt-2.5">
                                        <div className="bg-black/58 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-100">
                                            {sharedMovie.mediaType === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                                            <span className="ml-1">Shared</span>
                                        </div>
                                        <div className="rounded-full bg-black/58 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-200">
                                            {sharedMovie.year || 'TMDB'}
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/76 to-transparent px-3 pb-3 pt-10">
                                        <div className="line-clamp-2 text-sm font-semibold leading-tight text-white">
                                            {sharedMovie.title}
                                        </div>
                                        <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                                            Open in app
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    )}

                    <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] ${isMine ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        <span>{formatConversationTime(message.created_at)}</span>
                        {isMine && (
                            <>
                                <span className="opacity-40">•</span>
                                <span className={`inline-flex items-center gap-1 ${message.read_at ? 'text-sky-300' : 'text-zinc-400'}`}>
                                    <MessageStatusIcon size={12} />
                                    <span>{messageStatusLabel}</span>
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0f1014] px-0 pb-24 pt-4 md:h-full md:min-h-0 md:overflow-hidden md:pb-0 md:pl-[116px] md:pr-8 md:pt-0">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col md:h-full md:min-h-0">
                <div className={`${selectedConversationId ? 'hidden md:block' : 'block'} px-4 pt-0 md:flex-shrink-0 md:px-0 md:pt-0`}>
                    <div className="border-b border-white/8 pb-1">
                        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
                                    Mutual Messages
                                </div>
                                <div className="mt-0.5 flex items-baseline gap-2.5">
                                    <h1 className="text-[23px] font-semibold tracking-[-0.045em] text-white md:text-[26px]">
                                        Messages
                                    </h1>
                                    <p className="hidden text-[12px] leading-5 text-zinc-500 md:block">
                                        Direct conversations and shared titles.
                                    </p>
                                </div>
                            </div>

                            <div className="hidden grid-cols-4 gap-0 overflow-hidden rounded-[16px] border border-white/8 bg-[#111217] text-left md:grid md:min-w-[520px]">
                                <div className="px-4 py-2.5">
                                    <div className={statLabelClassName}>Account</div>
                                    <div className="mt-1 text-sm font-medium text-white">{profile?.username || 'Inbox'}</div>
                                </div>
                                <div className="border-l border-white/8 px-4 py-2.5">
                                    <div className={statLabelClassName}>Unread</div>
                                    <div className="mt-1 text-sm font-medium text-white">{unreadConversationCount}</div>
                                </div>
                                <div className="border-l border-white/8 px-4 py-2.5">
                                    <div className={statLabelClassName}>Mutuals</div>
                                    <div className="mt-1 text-sm font-medium text-white">{messageableProfiles.length}</div>
                                </div>
                                <div className="border-l border-white/8 px-3 py-2">
                                    <div className="flex items-center gap-2 rounded-[12px] border border-white/10 bg-[#15161b] px-3 py-2">
                                        <Search size={14} className="text-zinc-500" />
                                        <input
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            placeholder="Search..."
                                            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 space-y-3 md:hidden">
                            <div className="grid grid-cols-3 overflow-hidden rounded-[16px] border border-white/8 bg-[#111217]">
                                <div className="px-3 py-2.5">
                                    <div className={statLabelClassName}>Unread</div>
                                    <div className="mt-1 text-sm font-medium text-white">{unreadConversationCount}</div>
                                </div>
                                <div className="border-l border-white/8 px-3 py-2.5">
                                    <div className={statLabelClassName}>Threads</div>
                                    <div className="mt-1 text-sm font-medium text-white">{conversations.length}</div>
                                </div>
                                <div className="border-l border-white/8 px-3 py-2.5">
                                    <div className={statLabelClassName}>Mutuals</div>
                                    <div className="mt-1 text-sm font-medium text-white">{messageableProfiles.length}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 rounded-[16px] border border-white/8 bg-[#111217] px-3 py-3">
                                <Search size={15} className="text-zinc-500" />
                                <input
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search people or messages..."
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-3 grid min-h-[72vh] grid-cols-1 gap-4 px-4 md:mt-1 md:min-h-0 md:flex-1 md:grid-cols-[316px_minmax(0,1fr)] md:overflow-hidden md:px-0">
                    <aside className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col overflow-hidden ${panelClassName} md:h-full md:min-h-0`}>
                        <div className="border-b border-white/6 p-4">
                            <div className="flex items-center justify-between gap-3 px-1 py-0.5">
                                <div>
                                    <div className={statLabelClassName}>Inbox rail</div>
                                    <div className="mt-1 text-[13px] font-medium text-white">Threads</div>
                                </div>
                                <div className="text-[11px] font-medium text-zinc-500">
                                    {conversationCountLabel}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 space-y-5 overflow-y-auto p-4 custom-scrollbar">
                            <section>
                                <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                    <MessageSquareText size={12} />
                                    Conversations
                                </div>
                                <div className="space-y-2">
                                    {loading && (
                                        <div className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-4 text-sm text-zinc-400">
                                            Loading inbox...
                                        </div>
                                    )}

                                    {!loading && filteredConversations.length === 0 && (
                                        <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-zinc-500">
                                            No conversations yet. Start with a mutual follower below.
                                        </div>
                                    )}

                                    {filteredConversations.map((conversation) => (
                                        <button
                                            key={conversation.id}
                                            type="button"
                                            onClick={() => handleConversationOpen(conversation.id)}
                                            className={`group w-full rounded-[18px] border px-4 py-3.5 text-left transition-colors ${
                                                selectedConversationId === conversation.id
                                                    ? 'border-white/18 bg-white/[0.06]'
                                                    : 'border-white/8 bg-[#14151a] hover:border-white/14 hover:bg-[#17191f]'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <img
                                                    src={conversation.otherProfile.avatar_url || `https://ui-avatars.com/api/?name=${conversation.otherProfile.username}`}
                                                    alt={conversation.otherProfile.username}
                                                    className="h-11 w-11 rounded-full border border-white/10 object-cover"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="truncate text-[13px] font-semibold text-white">
                                                            {conversation.otherProfile.username}
                                                        </div>
                                                        <div className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                                            {formatConversationTime(conversation.last_message_at)}
                                                        </div>
                                                    </div>
                                                    <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-400">
                                                        {conversation.last_message_preview || 'Say hi and share something worth watching.'}
                                                    </div>
                                                </div>
                                                {conversation.unread_count > 0 && (
                                                    <div className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-black">
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
                                        <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-zinc-500">
                                            Follow each other to unlock new DMs. Shared follows appear here automatically.
                                        </div>
                                    )}

                                    {suggestedProfiles.map((candidate) => (
                                        <button
                                            key={candidate.id}
                                            type="button"
                                            onClick={() => void handleStartConversation(candidate)}
                                            disabled={creatingConversationFor === candidate.id}
                                            className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-[#14151a] px-4 py-3.5 text-left transition-colors hover:border-white/14 hover:bg-[#17191f] disabled:cursor-wait disabled:opacity-60"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <img
                                                    src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.username}`}
                                                    alt={candidate.username}
                                                    className="h-10 w-10 rounded-full border border-white/10 object-cover"
                                                />
                                                <div className="min-w-0">
                                                    <div className="truncate text-[13px] font-semibold text-white">
                                                        {candidate.username}
                                                    </div>
                                                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                                        Mutual follow
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-[11px] font-medium text-zinc-300">
                                                {creatingConversationFor === candidate.id ? 'Opening...' : 'Message'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </aside>

                    <section className={`${selectedConversationId ? 'fixed inset-x-0 top-0 bottom-[78px] z-40 flex rounded-none border-x-0 border-y-0 bg-[#0f1014]' : 'hidden md:flex'} min-h-0 flex-col overflow-hidden md:static md:h-full md:min-h-0 md:rounded-[24px] md:border md:border-white/8 md:bg-[#121318]`}>
                        {selectedConversation ? (
                            <>
                                <div className="flex-shrink-0 border-b border-white/6 px-4 py-3 md:px-4 md:py-2.5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedConversationId(null)}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white md:hidden"
                                            >
                                                <ArrowLeft size={16} />
                                            </button>
                                            <img
                                                src={selectedConversation.otherProfile.avatar_url || `https://ui-avatars.com/api/?name=${selectedConversation.otherProfile.username}`}
                                                alt={selectedConversation.otherProfile.username}
                                                className="h-10 w-10 rounded-full border border-white/10 object-cover shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
                                            />
                                            <div className="min-w-0">
                                                <div className="truncate text-[14px] font-semibold text-white">
                                                    {selectedConversation.otherProfile.username}
                                                </div>
                                                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                                    Mutual follow
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-[10px] font-medium text-zinc-400">
                                            {formatConversationTime(selectedConversation.last_message_at) || 'Live'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-shrink-0 border-b border-white/6 px-4 py-1 md:px-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-[12px] leading-5 text-zinc-400">
                                            {messages.length.toString().padStart(2, '0')} messages in this thread
                                        </div>
                                        <div className="hidden text-[10px] font-medium text-zinc-500 sm:block">
                                            Shared titles stay interactive
                                        </div>
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#101116] px-4 py-3 custom-scrollbar md:px-5">
                                    {threadLoading && (
                                        <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
                                            Loading conversation...
                                        </div>
                                    )}

                                    {!threadLoading && messages.length === 0 && (
                                        <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
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

                                <div className="flex-shrink-0 border-t border-white/6 bg-[#121318] p-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] md:pb-2">
                                    {errorMessage && (
                                        <div className="mb-3 rounded-[16px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                            {errorMessage}
                                        </div>
                                    )}
                                    <div className="rounded-[18px] border border-white/10 bg-[#14151a] p-2.5">
                                        <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                            Reply to {selectedConversation.otherProfile.username}
                                        </div>
                                        <div className="flex items-end gap-2.5">
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
                                                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-zinc-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleSend()}
                                                disabled={!composer.trim() || isSending}
                                                aria-label="Send message"
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/12 bg-[#1b1d24] text-zinc-200 transition-colors hover:border-white/20 hover:bg-[#22252d] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:w-11 md:rounded-[16px]"
                                            >
                                                <Send size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full min-h-[560px] flex-col items-center justify-center px-8 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300">
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
