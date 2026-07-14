import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Eye, Heart, Share2, Trash2, Users, UserPlus, UserRound } from 'lucide-react';
import { Movie, Playlist, PlaylistCollaborator } from '../../../types';
import { SocialService } from '../../../lib/social';
import { PlaylistEngagement } from '../../../lib/playlistEngagement';
import { useAuth } from '../../../lib/AuthContext';
import { StudioButton } from '../system/StudioButton';
import { StudioMediaCard } from '../media/StudioMediaCard';
import { StudioSkeleton } from '../system/StudioSkeleton';
import { InviteCollaboratorModal } from '../../InviteCollaboratorModal';
import { CollaboratorsList } from '../../CollaboratorsList';
import { getDisplayName } from '../../../lib/displayName';

interface StudioPlaylistDetailPageProps {
  playlistId: string;
  onBack: () => void;
  onMovieSelect: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  onAddToPlaylist: (movie: Movie) => void;
}

export const StudioPlaylistDetailPage: React.FC<StudioPlaylistDetailPageProps> = ({
  playlistId,
  onBack,
  onMovieSelect,
  onPlay,
  onAddToPlaylist,
}) => {
  const { user } = useAuth();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<PlaylistCollaborator[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPlaylist = async () => {
      setLoading(true);
      try {
        window.scrollTo(0, 0);
        PlaylistEngagement.trackView(playlistId);
        const [playlistItems, playlistDetails, liked, collabData] = await Promise.all([
          SocialService.getPlaylistItems(playlistId),
          SocialService.getPlaylistDetails(playlistId),
          PlaylistEngagement.checkIfLiked(playlistId),
          user ? SocialService.getCollaborators(playlistId).catch(() => []) : Promise.resolve([]),
        ]);

        if (cancelled) return;
        setItems(playlistItems);
        setPlaylist(playlistDetails);
        setLikeCount(playlistDetails?.likes_count || 0);
        setIsLiked(liked);
        setCollaborators(collabData as PlaylistCollaborator[]);
      } catch (error) {
        console.error('Failed to load Studio playlist', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPlaylist();
    return () => {
      cancelled = true;
    };
  }, [playlistId, user]);

  const isOwner = Boolean(user && playlist && user.id === playlist.user_id);
  const isSystem = playlist?.type === 'watch_later' || playlist?.type === 'favorites';
  const activeCollaborators = collaborators.filter(collab => collab.status === 'accepted');
  const isAcceptedCollaborator = Boolean(user && activeCollaborators.some(collab => collab.user_id === user.id));
  const canInvite = !isSystem && (isOwner || isAcceptedCollaborator);
  const isCollab = playlist?.type === 'curated' || activeCollaborators.length > 0;
  const playlistKind = isCollab ? 'Collaborative shelf' : isOwner ? 'Your shelf' : 'Community shelf';

  const handleShare = () => {
    const link = `${window.location.origin.replace(/\/$/, '')}/playlist/${playlistId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleLikeToggle = async () => {
    if (!playlist) return;
    const previousLiked = isLiked;
    const previousCount = likeCount;
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount(count => nextLiked ? count + 1 : Math.max(count - 1, 0));

    try {
      const result = nextLiked
        ? await PlaylistEngagement.likePlaylist(playlist.id)
        : await PlaylistEngagement.unlikePlaylist(playlist.id);
      if (!result.success) throw new Error(result.error);
    } catch (error) {
      console.error('Failed to toggle playlist like', error);
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
    }
  };

  const removeItem = async (movieId: string) => {
    const previousItems = items;
    setItems(prev => prev.filter(item => item.id.toString() !== movieId));
    setRemoveTargetId(null);
    try {
      await SocialService.removeFromPlaylist(playlistId, movieId);
    } catch (error) {
      console.error('Failed to remove playlist item', error);
      setItems(previousItems);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 pb-20">
        <div className="h-80 animate-pulse rounded-[34px] border border-white/8 bg-white/[0.045]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => <StudioSkeleton key={index} className="aspect-[2/3]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <InviteCollaboratorModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        playlistId={playlistId}
        playlistName={playlist?.name || 'Playlist'}
      />
      <CollaboratorsList
        isOpen={showCollaboratorsModal}
        onClose={() => setShowCollaboratorsModal(false)}
        playlistId={playlistId}
        isOwner={isOwner}
      />
      <section className="mb-9 border-b border-white/8 pb-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="mb-5 flex items-center gap-3">
              <StudioButton type="button" size="icon" variant="ghost" onClick={onBack} aria-label="Back">
                <ArrowLeft size={22} />
              </StudioButton>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/48 px-3 py-1.5 text-xs font-bold uppercase text-white/52">
                {isCollab ? <Users size={13} /> : <UserRound size={13} />}
                {playlistKind}
              </span>
            </div>
            <h1 className="break-words text-4xl font-black leading-none tracking-tight text-white md:text-6xl">
              {playlist?.name || 'Playlist'}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-base text-white/45">
              <span className="flex items-center gap-2"><Eye size={16} />{(playlist?.analytics?.total_views || 0).toLocaleString()} views</span>
              <span className="h-1 w-1 rounded-full bg-white/24" />
              <span><strong className="text-white">{items.length}</strong> items</span>
              <span className="h-1 w-1 rounded-full bg-white/24" />
              <span>{playlist?.is_public ? 'Public' : 'Private'}</span>
            </div>
            {playlist?.description && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/46">{playlist.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {canInvite && (
              <StudioButton type="button" variant="glass" onClick={() => setShowInviteModal(true)}>
                <UserPlus size={17} />
                Invite
              </StudioButton>
            )}
            <StudioButton type="button" variant={isLiked ? 'primary' : 'glass'} onClick={handleLikeToggle}>
              <Heart size={17} className={isLiked ? 'fill-current' : ''} />
              {likeCount}
            </StudioButton>
            <StudioButton type="button" variant="glass" onClick={handleShare}>
              {copied ? <CheckCircle size={17} /> : <Share2 size={17} />}
              {copied ? 'Copied' : 'Share'}
            </StudioButton>
          </div>
        </div>
        {(isOwner || activeCollaborators.length > 0) && (
          <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-white/8 bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex -space-x-2">
                {(activeCollaborators.length > 0 ? activeCollaborators.slice(0, 5) : []).map(collab => (
                  <img
                    key={collab.id}
                    src={collab.profile?.avatar_url || `https://ui-avatars.com/api/?name=${collab.profile?.username || 'User'}&background=111827&color=fff`}
                    alt={collab.profile?.username || 'Collaborator'}
                    className="h-9 w-9 rounded-full border-2 border-black object-cover"
                  />
                ))}
                {activeCollaborators.length === 0 && (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white/[0.08] text-white/36">
                    <Users size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{activeCollaborators.length + 1} member{activeCollaborators.length === 0 ? '' : 's'}</div>
                <div className="text-xs text-white/42">{isCollab ? 'Shared editing enabled' : 'Solo playlist'}</div>
              </div>
            </div>
            <StudioButton type="button" variant="ghost" onClick={() => setShowCollaboratorsModal(true)}>
              Manage
            </StudioButton>
          </div>
        )}
      </section>
      <section className="mb-7 flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">Titles</h2>
        <div className="text-sm font-semibold text-white/36">{items.length} saved</div>
      </section>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map(movie => (
            <div key={movie.id} className="group/item relative">
              <StudioMediaCard movie={movie} onSelect={onMovieSelect} onPlay={onPlay} onAddToPlaylist={onAddToPlaylist} />
              {isOwner && !isSystem && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRemoveTargetId(movie.id.toString());
                  }}
                  className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/58 text-white/70 opacity-0 backdrop-blur-md transition-all hover:bg-red-500 hover:text-white group-hover/item:opacity-100"
                  aria-label="Remove from playlist"
                >
                  <Trash2 size={14} />
                </button>
              )}
              {isCollab && movie.addedBy && (
                <div className="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-white/38">
                  <img
                    src={movie.addedBy.avatarUrl || `https://ui-avatars.com/api/?name=${getDisplayName(movie.addedBy.username)}&background=111827&color=fff`}
                    alt={getDisplayName(movie.addedBy.username)}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                  <span className="truncate">Added by {getDisplayName(movie.addedBy.username)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-12 text-center text-white/45">
          This playlist is empty.
        </div>
      )}

      {removeTargetId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/72 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#101013] p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.68)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/12 text-red-200">
              <Trash2 size={22} />
            </div>
            <h3 className="text-lg font-black text-white">Remove from playlist?</h3>
            <p className="mt-2 text-sm leading-6 text-white/48">This title will be removed from this Studio playlist.</p>
            <div className="mt-5 flex gap-3">
              <StudioButton type="button" variant="ghost" className="flex-1" onClick={() => setRemoveTargetId(null)}>Cancel</StudioButton>
              <StudioButton type="button" variant="danger" className="flex-1" onClick={() => removeItem(removeTargetId)}>Remove</StudioButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
