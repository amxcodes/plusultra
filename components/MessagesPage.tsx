import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Check,
    CheckCheck,
    CornerUpLeft,
    Film,
    MessageSquareText,
    Search,
    Send,
    Sparkles,
    Tv,
    UserRoundPlus,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmContext';
import { SocialService } from '../lib/social';
import { useToast } from '../lib/ToastContext';
import type { DirectConversation, DirectMessage, Movie, Profile } from '../types';

interface MessagesPageProps {
    onMovieSelect: (movie: Movie) => void;
    initialConversationId?: string;
    onConversationChange?: (conversationId: string | null) => void;
}

const QUICK_REACTIONS = ['\u2764\uFE0F', '\uD83D\uDD25', '\uD83D\uDE02', '\uD83D\uDC4D', '\uD83D\uDC40'];
const statLabelClassName = 'text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500';
const panelClassName = 'rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(22,24,31,0.98),rgba(15,16,21,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.32)]';

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

const getReplyPreviewLabel = (message: DirectMessage) => {
    if (message.reply_preview?.body) return message.reply_preview.body;
    if (message.reply_preview?.shared_movie_title) return `Shared ${message.reply_preview.shared_movie_title}`;
    if (message.reply_preview?.message_type === 'movie_share') return 'Shared a title';
    return 'Original message';
};

const InboxSkeleton = () => (
    <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
            <div
                key={`inbox-skeleton-${index}`}
                className="rounded-[22px] border border-white/8 bg-[#14151a] px-4 py-3.5"
            >
                <div className="flex items-start gap-3 animate-pulse">
                    <div className="h-11 w-11 rounded-full bg-white/8" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                            <div className="h-3 w-24 rounded-full bg-white/10" />
                            <div className="h-2.5 w-8 rounded-full bg-white/8" />
                        </div>
                        <div className="mt-2 h-2.5 w-4/5 rounded-full bg-white/8" />
                        <div className="mt-2 h-2.5 w-2/3 rounded-full bg-white/[0.06]" />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const ThreadSkeleton = () => (
    <div className="space-y-3">
        <div className="flex justify-start">
            <div className="w-[132px] animate-pulse rounded-[24px] rounded-bl-[10px] border border-white/8 bg-[#181a20] px-3.5 py-3">
                <div className="h-3 w-16 rounded-full bg-white/10" />
                <div className="mt-2 h-3 w-24 rounded-full bg-white/8" />
            </div>
        </div>
        <div className="flex justify-end">
            <div className="w-[176px] animate-pulse rounded-[24px] rounded-br-[10px] border border-white/8 bg-[#232631] px-3.5 py-3">
                <div className="h-24 w-[126px] rounded-[18px] bg-white/8" />
                <div className="mt-3 h-3 w-20 rounded-full bg-white/10" />
            </div>
        </div>
        <div className="flex justify-start">
            <div className="w-[168px] animate-pulse rounded-[24px] rounded-bl-[10px] border border-white/8 bg-[#181a20] px-3.5 py-3">
                <div className="h-3 w-28 rounded-full bg-white/10" />
                <div className="mt-2 h-3 w-16 rounded-full bg-white/8" />
            </div>
        </div>
    </div>
);

export const MessagesPage: React.FC<MessagesPageProps> = ({ onMovieSelect, initialConversationId, onConversationChange }) => {
    const { user } = useAuth();
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
    const [typingPresenceUserIds, setTypingPresenceUserIds] = useState<string[]>([]);
    const [replyingToMessage, setReplyingToMessage] = useState<DirectMessage | null>(null);
    const threadScrollRef = useRef<HTMLDivElement | null>(null);
    const threadEndRef = useRef<HTMLDivElement | null>(null);
    const typingStopTimeoutRef = useRef<number | null>(null);
    const previousMessageCountRef = useRef(0);
    const previousConversationIdRef = useRef<string | null>(null);
    const pendingInitialScrollRef = useRef(false);

    const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) || null;
    const unreadConversationCount = conversations.filter((conversation) => conversation.unread_count > 0).length;
    const conversationCountLabel = `${conversations.length.toString().padStart(2, '0')} threads`;
    const otherUserIsTyping = selectedConversation ? typingPresenceUserIds.includes(selectedConversation.otherProfile.id) : false;

    const filteredConversations = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return conversations;

        return conversations.filter((conversation) => {
            const username = conversation.otherProfile.username.toLowerCase();
            const preview = (conversation.last_message_preview || '').toLowerCase();
            return username.includes(query) || preview.includes(query);
        });
    }, [conversations, searchQuery]);

    const scrollThreadToBottom = (behavior: ScrollBehavior = 'auto') => {
        const scrollTarget = () => {
            if (threadScrollRef.current) {
                threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
                if (behavior === 'smooth') {
                    threadScrollRef.current.scrollTo({
                        top: threadScrollRef.current.scrollHeight,
                        behavior,
                    });
                }
                return;
            }

            threadEndRef.current?.scrollIntoView({
                behavior,
                block: 'end',
            });
        };

        window.requestAnimationFrame(() => {
            scrollTarget();
            window.requestAnimationFrame(scrollTarget);
        });
    };

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
                setReplyingToMessage(null);
            }
        } catch (error) {
            console.error('Failed to load inbox:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load messages.');
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (
        conversationId: string,
        options: { silent?: boolean; markRead?: boolean } = {}
    ) => {
        const { silent = false, markRead = true } = options;
        if (!silent) {
            setThreadLoading(true);
        }

        try {
            const nextMessages = await SocialService.listDirectMessages(conversationId);
            setMessages(nextMessages);

            if (markRead) {
                await SocialService.markConversationRead(conversationId);
                setConversations((current) => current.map((conversation) => (
                    conversation.id === conversationId
                        ? { ...conversation, unread_count: 0 }
                        : conversation
                )));
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load conversation.');
        } finally {
            if (!silent) {
                setThreadLoading(false);
            }
        }
    };

    const loadTypingPresence = async (conversationId: string) => {
        if (!user?.id) return;

        try {
            const nextPresence = await SocialService.listTypingPresence(conversationId, user.id);
            setTypingPresenceUserIds(nextPresence.map((entry) => entry.user_id));
        } catch (error) {
            console.error('Failed to load typing presence:', error);
        }
    };

    const getConversationPreviewText = (message: DirectMessage) => {
        if (message.message_type === 'movie_share') {
            return message.body || 'Shared a title';
        }

        return message.body || '';
    };

    const updateConversationMeta = (
        conversationId: string,
        updater: (conversation: DirectConversation) => DirectConversation
    ) => {
        setConversations((current) => {
            const existing = current.find((conversation) => conversation.id === conversationId);
            if (!existing) return current;

            const updatedConversation = updater(existing);
            return [
                updatedConversation,
                ...current.filter((conversation) => conversation.id !== conversationId),
            ];
        });
    };

    const applyOptimisticReaction = (messageId: string, emoji: string) => {
        if (!user?.id) return;

        setMessages((current) => current.map((message) => {
            if (message.id !== messageId) {
                return message;
            }

            const existingReactions = message.reactions || [];
            const existingMine = existingReactions.find((reaction) => reaction.user_id === user.id);

            if (existingMine?.emoji === emoji) {
                return {
                    ...message,
                    reactions: existingReactions.filter((reaction) => reaction.user_id !== user.id),
                };
            }

            return {
                ...message,
                reactions: [
                    ...existingReactions.filter((reaction) => reaction.user_id !== user.id),
                    {
                        message_id: message.id,
                        conversation_id: message.conversation_id,
                        user_id: user.id,
                        emoji,
                        created_at: new Date().toISOString(),
                    },
                ],
            };
        }));
    };

    useEffect(() => {
        void loadInbox();
    }, [user?.id]);

    useEffect(() => {
        onConversationChange?.(selectedConversationId);
    }, [onConversationChange, selectedConversationId]);

    useEffect(() => {
        if (!user?.id) return;

        const unsubscribe = SocialService.subscribeToInbox(user.id, () => {
            void loadInbox(selectedConversationId);
        });

        return () => unsubscribe();
    }, [selectedConversationId, user?.id]);

    useEffect(() => {
        if (!selectedConversationId) return;
        previousMessageCountRef.current = 0;
        pendingInitialScrollRef.current = true;
        void loadMessages(selectedConversationId, { silent: false, markRead: true });
        void loadTypingPresence(selectedConversationId);
    }, [selectedConversationId]);

    useEffect(() => {
        if (!selectedConversationId || !user?.id) return;

        const unsubscribe = SocialService.subscribeToThread(selectedConversationId, {
            onMessagesChange: () => {
                void loadMessages(selectedConversationId, { silent: true, markRead: true });
            },
            onTypingChange: () => {
                void loadTypingPresence(selectedConversationId);
            },
        });

        return () => unsubscribe();
    }, [selectedConversationId, user?.id]);

    useEffect(() => {
        if (!initialConversationId) return;
        setSelectedConversationId(initialConversationId);
        setErrorMessage(null);
    }, [initialConversationId]);

    useLayoutEffect(() => {
        if (!selectedConversationId) return;

        const didConversationChange = previousConversationIdRef.current !== selectedConversationId;
        const didMessageCountGrow = messages.length > previousMessageCountRef.current;

        if (!threadLoading && pendingInitialScrollRef.current) {
            pendingInitialScrollRef.current = false;
            scrollThreadToBottom('auto');
        } else if (didConversationChange || didMessageCountGrow) {
            scrollThreadToBottom(didConversationChange ? 'auto' : 'smooth');
        }

        previousConversationIdRef.current = selectedConversationId;
        previousMessageCountRef.current = messages.length;
    }, [messages.length, selectedConversationId, threadLoading]);

    useEffect(() => {
        return () => {
            if (typingStopTimeoutRef.current) {
                window.clearTimeout(typingStopTimeoutRef.current);
            }
        };
    }, []);

    const stopTyping = async () => {
        if (!selectedConversationId) return;
        if (typingStopTimeoutRef.current) {
            window.clearTimeout(typingStopTimeoutRef.current);
            typingStopTimeoutRef.current = null;
        }
        await SocialService.setDirectMessageTyping(selectedConversationId, false);
    };

    const handleTypingChange = async (nextValue: string) => {
        setComposer(nextValue);
        if (!selectedConversationId) return;

        if (!nextValue.trim()) {
            await stopTyping();
            return;
        }

        void SocialService.setDirectMessageTyping(selectedConversationId, true);
        if (typingStopTimeoutRef.current) {
            window.clearTimeout(typingStopTimeoutRef.current);
        }
        typingStopTimeoutRef.current = window.setTimeout(() => {
            typingStopTimeoutRef.current = null;
            void SocialService.setDirectMessageTyping(selectedConversationId, false);
        }, 3500);
    };

    const handleConversationOpen = (conversationId: string) => {
        setSelectedConversationId(conversationId);
        setReplyingToMessage(null);
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
            const sentMessage = await SocialService.sendTextMessage(
                selectedConversation.otherProfile.id,
                composer.trim(),
                replyingToMessage?.id || null
            );

            void stopTyping();
            setComposer('');
            setReplyingToMessage(null);

            if (sentMessage) {
                setMessages((current) => current.some((message) => message.id === sentMessage.id)
                    ? current
                    : [...current, sentMessage]);

                updateConversationMeta(selectedConversation.id, (conversation) => ({
                    ...conversation,
                    last_message_at: sentMessage.created_at,
                    updated_at: sentMessage.created_at,
                    last_message_preview: getConversationPreviewText(sentMessage),
                    last_message_sender_id: sentMessage.sender_id,
                    unread_count: 0,
                }));
            }
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
            setMessages((current) => {
                const nextMessages = current.filter((entry) => entry.id !== message.id);
                const replacement = nextMessages[nextMessages.length - 1] || null;

                updateConversationMeta(selectedConversation.id, (conversation) => ({
                    ...conversation,
                    last_message_at: replacement?.created_at || conversation.created_at,
                    updated_at: replacement?.created_at || conversation.updated_at,
                    last_message_preview: replacement ? getConversationPreviewText(replacement) : null,
                    last_message_sender_id: replacement?.sender_id || null,
                }));

                return nextMessages;
            });

            if (replyingToMessage?.id === message.id) {
                setReplyingToMessage(null);
            }
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

    const handleReply = (message: DirectMessage) => {
        setReplyingToMessage(message);
        setErrorMessage(null);
    };

    const handleReaction = async (message: DirectMessage, emoji: string) => {
        try {
            applyOptimisticReaction(message.id, emoji);
            await SocialService.toggleDirectMessageReaction(message.id, emoji);
        } catch (error) {
            console.error('Failed to toggle reaction:', error);
            if (selectedConversationId) {
                void loadMessages(selectedConversationId, { silent: true, markRead: false });
            }
            setErrorMessage(error instanceof Error ? error.message : 'Reaction failed.');
        }
    };

    const getReactionSummary = (message: DirectMessage) => {
        const grouped = new Map<string, { count: number; mine: boolean }>();

        (message.reactions || []).forEach((reaction) => {
            const current = grouped.get(reaction.emoji) || { count: 0, mine: false };
            current.count += 1;
            current.mine = current.mine || reaction.user_id === user?.id;
            grouped.set(reaction.emoji, current);
        });

        return Array.from(grouped.entries()).map(([emoji, value]) => ({
            emoji,
            count: value.count,
            mine: value.mine,
        }));
    };

    const renderMessageBubble = (message: DirectMessage) => {
        const isMine = message.sender_id === user?.id;
        const sharedMovie = toMovieFromShare(message);
        const reactions = getReactionSummary(message);
        const MessageStatusIcon = message.read_at ? CheckCheck : Check;
        const messageStatusLabel = message.read_at ? 'Read' : 'Sent';
        const isUnsending = unsendingMessageId === message.id;

        return (
            <div key={message.id} className={`group/message flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[84%] flex-col ${isMine ? 'items-end' : 'items-start'} md:max-w-[52%]`}>
                    <div
                        onDoubleClick={() => {
                            if (isMine && !isUnsending) {
                                void handleUnsend(message);
                            }
                        }}
                        className={`relative inline-flex w-fit max-w-full flex-col rounded-[24px] border px-3.5 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.18)] ${
                            isMine
                                ? 'cursor-pointer rounded-br-[10px] border-white/10 bg-[linear-gradient(180deg,rgba(43,46,56,0.98),rgba(31,33,40,0.98))] text-zinc-100'
                                : 'rounded-bl-[10px] border-white/8 bg-[linear-gradient(180deg,rgba(24,26,32,0.98),rgba(18,19,24,0.98))] text-zinc-100'
                        } ${isUnsending ? 'opacity-60' : ''}`}
                        title={isMine ? 'Double-click to unsend' : undefined}
                    >
                        {message.reply_preview && (
                            <button
                                type="button"
                                onClick={() => handleReply(message)}
                                className="mb-2.5 block w-full rounded-[16px] border border-white/8 bg-black/20 px-3 py-2 text-left transition-colors hover:border-white/14 hover:bg-black/30"
                            >
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                                    <CornerUpLeft size={12} />
                                    <span>Replying to message</span>
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-300">
                                    {getReplyPreviewLabel(message)}
                                </div>
                            </button>
                        )}

                        {message.body && (
                            <p className="text-[13px] leading-6 text-inherit whitespace-pre-wrap">
                                {message.body}
                            </p>
                        )}

                        {sharedMovie && (
                            <button
                                type="button"
                                onClick={() => onMovieSelect(sharedMovie)}
                                className={`${message.body ? 'mt-2.5' : ''} block w-[126px] text-left`}
                            >
                                <div className="overflow-hidden rounded-[18px] bg-[#0d0e12] ring-1 ring-white/8 transition-all hover:ring-white/18">
                                    <div className="relative aspect-[2/3] overflow-hidden">
                                        <img
                                            src={sharedMovie.imageUrl}
                                            alt={sharedMovie.title}
                                            className="h-full w-full object-cover"
                                        />
                                        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2.5 pt-2.5">
                                            <div className="bg-black/58 px-1.5 py-1 text-[7px] font-bold uppercase tracking-[0.18em] text-zinc-100">
                                                {sharedMovie.mediaType === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                                                <span className="ml-1">Shared</span>
                                            </div>
                                            <div className="rounded-full bg-black/58 px-1.5 py-1 text-[7px] font-bold uppercase tracking-[0.16em] text-zinc-200">
                                                {sharedMovie.year || 'TMDB'}
                                            </div>
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/76 to-transparent px-2.5 pb-2.5 pt-10">
                                            <div className="line-clamp-2 text-[11px] font-semibold leading-4 text-white">
                                                {sharedMovie.title}
                                            </div>
                                            <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-zinc-400">
                                                Open in app
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>

                    <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.16em] ${isMine ? 'justify-end text-zinc-400' : 'justify-start text-zinc-500'}`}>
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

                    {reactions.length > 0 && (
                        <div className={`mt-1.5 flex flex-wrap gap-1.5 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {reactions.map((reaction) => (
                                <button
                                    key={`${message.id}-${reaction.emoji}`}
                                    type="button"
                                    onClick={() => void handleReaction(message, reaction.emoji)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors ${
                                        reaction.mine
                                            ? 'border-white/18 bg-white/12 text-white'
                                            : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/16 hover:text-white'
                                    }`}
                                >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-xs opacity-0 transition-opacity duration-150 group-hover/message:opacity-100 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <button
                            type="button"
                            onClick={() => handleReply(message)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-zinc-300 hover:border-white/18 hover:text-white"
                        >
                            <CornerUpLeft size={12} />
                            <span>Reply</span>
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {QUICK_REACTIONS.map((emoji) => (
                                <button
                                    key={`${message.id}-${emoji}-outside`}
                                    type="button"
                                    onClick={() => void handleReaction(message, emoji)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[13px] transition-colors hover:border-white/18 hover:text-white"
                                    aria-label={`React with ${emoji}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0f1014] px-0 pb-24 pt-2 md:h-full md:min-h-0 md:overflow-hidden md:pb-0 md:pl-[82px] md:pr-8 md:pt-2">
            <div className="mx-auto flex w-full max-w-[1500px] flex-col px-4 md:h-full md:min-h-0 md:px-0">
                <div className="grid min-h-[80vh] grid-cols-1 gap-4 md:h-[calc(100dvh-2rem)] md:min-h-0 md:grid-cols-[340px_minmax(0,1fr)]">
                    <aside className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col overflow-hidden ${panelClassName}`}>
                        <div className="border-b border-white/6 p-4">
                            <div className="md:hidden">
                                <div className="grid grid-cols-3 overflow-hidden rounded-[18px] border border-white/8 bg-[#111217]">
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

                                <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-white/8 bg-[#111217] px-3 py-3">
                                    <Search size={15} className="text-zinc-500" />
                                    <input
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Search people or messages..."
                                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                                    />
                                </div>
                            </div>

                            <div className="hidden items-end justify-between gap-3 md:flex">
                                <div>
                                    <div className={statLabelClassName}>Inbox Rail</div>
                                    <div className="mt-1 text-[15px] font-semibold text-white">Conversations</div>
                                </div>
                                <div className="text-[11px] font-medium text-zinc-500">
                                    {conversationCountLabel}
                                </div>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 custom-scrollbar">
                            <section>
                                <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                    <MessageSquareText size={12} />
                                    Threads
                                </div>

                                <div className="space-y-2">
                                    {loading && <InboxSkeleton />}

                                    {!loading && filteredConversations.length === 0 && (
                                        <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-zinc-500">
                                            No conversations yet. Start with a mutual follower below.
                                        </div>
                                    )}

                                    {filteredConversations.map((conversation) => {
                                        const isActive = selectedConversationId === conversation.id;

                                        return (
                                            <button
                                                key={conversation.id}
                                                type="button"
                                                onClick={() => handleConversationOpen(conversation.id)}
                                                className={`group w-full rounded-[22px] border px-4 py-3.5 text-left transition-all ${
                                                    isActive
                                                        ? 'border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))]'
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
                                        );
                                    })}
                                </div>
                            </section>

                            <section>
                                <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                    <UserRoundPlus size={12} />
                                    Mutual followers
                                </div>

                                <div className="space-y-2">
                                    {suggestedProfiles.length === 0 && (
                                        <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-relaxed text-zinc-500">
                                            Follow each other to unlock new DMs. Shared follows appear here automatically.
                                        </div>
                                    )}

                                    {suggestedProfiles.map((candidate) => (
                                        <button
                                            key={candidate.id}
                                            type="button"
                                            onClick={() => void handleStartConversation(candidate)}
                                            disabled={creatingConversationFor === candidate.id}
                                            className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-[#14151a] px-4 py-3.5 text-left transition-colors hover:border-white/14 hover:bg-[#17191f] disabled:cursor-wait disabled:opacity-60"
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

                    <section className={`${selectedConversationId ? 'fixed inset-x-0 top-0 bottom-0 z-40 flex overflow-hidden rounded-t-[28px] border-x border-t border-white/8 bg-[#0f1014] md:static md:rounded-[28px] md:border' : 'hidden md:flex'} min-h-0 flex-col ${selectedConversationId ? '' : panelClassName} md:h-full md:min-h-0`}>
                        {selectedConversation ? (
                            <>
                                <div className="border-b border-white/6 bg-[linear-gradient(180deg,rgba(20,22,28,0.98),rgba(16,17,22,0.96))] px-4 py-3 md:px-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-3">
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
                                                className="h-11 w-11 rounded-full border border-white/10 object-cover"
                                            />
                                            <div className="min-w-0">
                                                <div className="truncate text-[15px] font-semibold text-white">
                                                    {selectedConversation.otherProfile.username}
                                                </div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                                    <span>{otherUserIsTyping ? `${selectedConversation.otherProfile.username} is typing...` : 'Mutual follow'}</span>
                                                    <span className="opacity-40">•</span>
                                                    <span>{messages.length.toString().padStart(2, '0')} messages</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 md:block">
                                            {formatConversationTime(selectedConversation.last_message_at) || 'Live'}
                                        </div>
                                    </div>
                                </div>

                                <div ref={threadScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#101116] px-4 py-4 custom-scrollbar md:px-6">
                                    {threadLoading && <ThreadSkeleton />}

                                    {!threadLoading && messages.length === 0 && (
                                        <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
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

                                    {!threadLoading && messages.length > 0 && (
                                        <div className="space-y-3">
                                            {messages.map(renderMessageBubble)}
                                        </div>
                                    )}
                                    <div ref={threadEndRef} />
                                </div>

                                <div className="border-t border-white/6 bg-[linear-gradient(180deg,rgba(20,21,27,0.98),rgba(14,15,20,0.98))] p-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:px-5 md:py-5">
                                    {errorMessage && (
                                        <div className="mb-3 rounded-[16px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                            {errorMessage}
                                        </div>
                                    )}

                                    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,28,35,0.98),rgba(18,19,25,0.98))] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
                                        {replyingToMessage && (
                                            <div className="mb-3 flex items-start justify-between gap-3 rounded-[18px] border border-white/8 bg-black/20 px-3 py-2.5">
                                                <div className="min-w-0">
                                                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                                                        Replying
                                                    </div>
                                                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-300">
                                                        {replyingToMessage.body || replyingToMessage.shared_movie?.title || 'Shared a title'}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setReplyingToMessage(null)}
                                                    className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-white"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        )}

                                        <div className="mb-2 flex items-center justify-between gap-3 px-2">
                                            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                                {otherUserIsTyping ? `${selectedConversation.otherProfile.username} is typing...` : `Message ${selectedConversation.otherProfile.username}`}
                                            </div>
                                            <div className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 sm:block">
                                                Enter to send
                                            </div>
                                        </div>

                                        <div className="flex items-end gap-2.5">
                                            <textarea
                                                value={composer}
                                                onChange={(event) => {
                                                    void handleTypingChange(event.target.value);
                                                }}
                                                onBlur={() => {
                                                    void stopTyping();
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' && !event.shiftKey) {
                                                        event.preventDefault();
                                                        void handleSend();
                                                    }
                                                }}
                                                placeholder={`Write to ${selectedConversation.otherProfile.username}...`}
                                                rows={1}
                                                className="max-h-48 min-h-[64px] flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-7 text-white outline-none placeholder:text-zinc-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleSend()}
                                                disabled={!composer.trim() || isSending}
                                                aria-label="Send message"
                                                className="inline-flex h-12 w-12 items-center justify-center self-end rounded-[18px] border border-white/12 bg-[linear-gradient(180deg,#ffffff,#d4d4d8)] text-black transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Send size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={`${panelClassName} flex h-full min-h-[560px] flex-col items-center justify-center px-8 text-center`}>
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
