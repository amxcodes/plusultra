import React, { useEffect, useRef, useState } from 'react';
import { Check, Globe, Image as ImageIcon, LayoutGrid, Lock, Plus, Search, X } from 'lucide-react';
import { Movie, Playlist } from '../../../types';
import { useAuth } from '../../../lib/AuthContext';
import { SocialService } from '../../../lib/social';
import { StudioButton } from '../system/StudioButton';

interface StudioAddToPlaylistSheetProps {
  movie: Movie;
  onClose: () => void;
}

export const StudioAddToPlaylistSheet: React.FC<StudioAddToPlaylistSheetProps> = ({ movie, onClose }) => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredPlaylists = playlists.filter(playlist => (
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    SocialService.getPlaylists(user.id)
      .then(data => {
        if (!cancelled) setPlaylists(data);
      })
      .catch(error => {
        console.error('Failed to load playlists', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (isCreating) inputRef.current?.focus();
  }, [isCreating]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;

    try {
      const newList = await SocialService.createPlaylist(user.id, newName, '', isPublic);
      if (!newList) return;
      setPlaylists(prev => [{ ...newList, items_count: 0, items: [] }, ...prev]);
      setNewName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create playlist', error);
    }
  };

  const handleTogglePlaylist = async (playlistId: string) => {
    const isAdded = addedIds.has(playlistId);

    setAddedIds(prev => {
      const next = new Set(prev);
      if (isAdded) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });

    setPlaylists(prev => prev.map(playlist => (
      playlist.id === playlistId
        ? { ...playlist, items_count: Math.max((playlist.items_count || 0) + (isAdded ? -1 : 1), 0) }
        : playlist
    )));

    try {
      if (isAdded) await SocialService.removeFromPlaylist(playlistId, movie.id.toString());
      else await SocialService.addToPlaylist(playlistId, movie);
    } catch (error) {
      console.error('Failed to toggle playlist item', error);
      setAddedIds(prev => {
        const next = new Set(prev);
        if (isAdded) next.add(playlistId);
        else next.delete(playlistId);
        return next;
      });
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/72 p-3 backdrop-blur-md md:items-center" onClick={onClose}>
      <div
        className="studio-glass flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border-white/14 bg-[#0b0b0d]/95 shadow-[0_28px_90px_rgba(0,0,0,0.72)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="relative h-36 shrink-0 overflow-hidden bg-white/[0.04]">
          {(movie.backdropUrl || movie.imageUrl) ? (
            <img src={movie.backdropUrl || movie.imageUrl} alt={movie.title} className="h-full w-full object-cover opacity-68" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/22">
              <ImageIcon size={42} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/50 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="studio-control-glass absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-white/78 hover:bg-white hover:text-black"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <div className="absolute bottom-4 left-5 right-16">
            <div className="text-[11px] font-bold uppercase text-white/45">Save to playlist</div>
            <h2 className="mt-1 line-clamp-1 break-words text-2xl font-black leading-tight text-white">{movie.title}</h2>
          </div>
        </div>

        {(playlists.length > 5 || searchQuery) && (
          <div className="px-4 pt-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/38" size={16} />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search playlists..."
                className="h-11 w-full rounded-full border border-white/10 bg-black/28 pl-11 pr-10 text-sm text-white outline-none transition-colors placeholder:text-white/32 focus:border-white/24"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/38 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="studio-scrollbar min-h-[220px] flex-1 space-y-2 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-44 flex-col items-center justify-center gap-3 text-sm text-white/42">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/12 border-t-white/60" />
              Loading playlists...
            </div>
          ) : filteredPlaylists.length > 0 ? (
            filteredPlaylists.map(playlist => {
              const isAdded = addedIds.has(playlist.id);
              const cover = playlist.items?.[0]?.metadata?.poster_path;

              return (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => handleTogglePlaylist(playlist.id)}
                  className={`flex w-full items-center gap-3 rounded-[20px] border p-3 text-left transition-colors ${
                    isAdded ? 'border-white/22 bg-white/[0.10]' : 'border-white/7 bg-white/[0.035] hover:border-white/14 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${isAdded ? 'bg-white text-black' : 'bg-white/[0.07] text-white/34'}`}>
                    {isAdded ? <Check size={24} strokeWidth={3} /> : cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <LayoutGrid size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-bold text-white">{playlist.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/42">
                      <span className="flex items-center gap-1">{playlist.is_public ? <Globe size={11} /> : <Lock size={11} />}{playlist.is_public ? 'Public' : 'Private'}</span>
                      <span className="h-1 w-1 rounded-full bg-white/24" />
                      <span>{playlist.items_count || 0} items</span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex h-44 flex-col items-center justify-center gap-2 text-white/42">
              <LayoutGrid size={34} />
              <div className="text-sm">{searchQuery ? 'No playlists found' : 'No playlists yet'}</div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/8 bg-black/22 p-4">
          {isCreating ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-white">New playlist</div>
                <button type="button" className="text-white/42 hover:text-white" onClick={() => setIsCreating(false)} aria-label="Cancel">
                  <X size={16} />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') handleCreate();
                  }}
                  placeholder="Playlist name"
                  className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/36 px-4 text-sm text-white outline-none placeholder:text-white/32 focus:border-white/24"
                />
                <StudioButton type="button" size="icon" variant="subtle" onClick={() => setIsPublic(prev => !prev)} aria-label={isPublic ? 'Public playlist' : 'Private playlist'}>
                  {isPublic ? <Globe size={17} /> : <Lock size={17} />}
                </StudioButton>
              </div>
              <StudioButton type="button" variant="primary" className="w-full" disabled={!newName.trim()} onClick={handleCreate}>
                Create playlist
              </StudioButton>
            </div>
          ) : (
            <StudioButton type="button" variant="glass" className="w-full" onClick={() => setIsCreating(true)}>
              <Plus size={17} />
              Create new playlist
            </StudioButton>
          )}
        </div>
      </div>
    </div>
  );
};
