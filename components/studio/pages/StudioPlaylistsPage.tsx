import React, { useEffect, useState } from 'react';
import { Heart, Users } from 'lucide-react';
import { Playlist } from '../../../types';
import { PlaylistEngagement } from '../../../lib/playlistEngagement';
import { getDisplayName } from '../../../lib/displayName';
import { StudioButton } from '../system/StudioButton';
import { StudioSkeleton } from '../system/StudioSkeleton';

interface StudioPlaylistsPageProps {
  onPlaylistSelect: (playlist: Playlist) => void;
}

type PlaylistMode = 'discover' | 'liked';

export const StudioPlaylistCard: React.FC<{ playlist: Playlist; onClick: () => void }> = ({ playlist, onClick }) => {
  const covers = playlist.items?.map(item => item.metadata?.poster_path).filter(Boolean).slice(0, 4) || [];
  const owner = getDisplayName(playlist.profiles?.username);
  const isCollab = playlist.type === 'curated' || Boolean((playlist as any).collaborators_count && (playlist as any).collaborators_count > 0);

  return (
    <button type="button" onClick={onClick} className="group/card w-full text-left">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.045] shadow-[0_16px_42px_rgba(0,0,0,0.42)] transition-[border-color,transform,filter] duration-300 group-hover/card:scale-[1.015] group-hover/card:border-white/16 group-hover/card:brightness-110">
        {covers.length > 0 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {covers.map((cover, index) => (
              <img key={`${cover}-${index}`} src={cover} alt="" className="h-full w-full object-cover" />
            ))}
            {covers.length === 1 && <img src={covers[0]} alt="" className="col-span-1 row-span-2 h-full w-full object-cover opacity-70" />}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl font-black text-white/10">
            {playlist.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/18 to-transparent" />
        <div className="absolute right-3 top-3 rounded-full bg-white/86 px-3 py-1 text-xs font-black text-black shadow-[0_8px_22px_rgba(0,0,0,0.24)] backdrop-blur-md">
          {playlist.likes_count || 0}
        </div>
        {isCollab && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/58 px-2.5 py-1 text-[10px] font-bold uppercase text-white/74 backdrop-blur-md">
            <Users size={12} />
            Collab
          </div>
        )}
      </div>
      <div className="mt-3 min-w-0">
        <div className="line-clamp-1 text-base font-black text-white/86">{playlist.name}</div>
        <div className="mt-1 text-[11px] font-bold uppercase text-white/34">{owner === 'Unknown' ? `${playlist.items_count || 0} items` : `by ${owner}`}</div>
      </div>
    </button>
  );
};

export const StudioPlaylistsPage: React.FC<StudioPlaylistsPageProps> = ({ onPlaylistSelect }) => {
  const [mode, setMode] = useState<PlaylistMode>('discover');
  const [trending, setTrending] = useState<Playlist[]>([]);
  const [popular, setPopular] = useState<Playlist[]>([]);
  const [liked, setLiked] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      PlaylistEngagement.getTrendingThisWeek(12),
      PlaylistEngagement.getPopularThisMonth(12),
      PlaylistEngagement.getLikedPlaylists(),
    ])
      .then(([trendingData, popularData, likedData]) => {
        if (cancelled) return;
        setTrending(trendingData);
        setPopular(popularData);
        setLiked(likedData);
      })
      .catch(error => {
        console.error('Failed to load Studio playlists', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const renderGrid = (items: Playlist[], empty: string) => (
    items.length > 0 ? (
      <div className="grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map(playlist => (
          <StudioPlaylistCard key={playlist.id} playlist={playlist} onClick={() => onPlaylistSelect(playlist)} />
        ))}
      </div>
    ) : (
      <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-10 text-center text-white/45">{empty}</div>
    )
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-14 w-72 rounded-full bg-white/[0.05]" />
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => <StudioSkeleton key={index} className="aspect-[4/5]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase text-white/34">Community shelves</div>
          <h1 className="text-5xl font-black tracking-tight text-white md:text-7xl">Playlists</h1>
        </div>
        <div className="studio-glass inline-flex w-fit rounded-full p-1">
          <StudioButton type="button" variant={mode === 'discover' ? 'primary' : 'ghost'} onClick={() => setMode('discover')}>Discover</StudioButton>
          <StudioButton type="button" variant={mode === 'liked' ? 'primary' : 'ghost'} onClick={() => setMode('liked')}>
            <Heart size={15} />
            Liked
          </StudioButton>
        </div>
      </div>

      {mode === 'discover' ? (
        <div className="space-y-12">
          <section>
            <h2 className="mb-5 text-2xl font-black text-white">Trending This Week</h2>
            {renderGrid(trending, 'No trending playlists right now.')}
          </section>
          <section>
            <h2 className="mb-5 text-2xl font-black text-white">Popular This Month</h2>
            {renderGrid(popular, 'No popular playlists found.')}
          </section>
        </div>
      ) : (
        <section>
          <h2 className="mb-5 text-2xl font-black text-white">Liked Collection</h2>
          {renderGrid(liked, "You haven't liked any playlists yet.")}
        </section>
      )}
    </div>
  );
};
