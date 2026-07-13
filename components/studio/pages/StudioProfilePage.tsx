import React, { useEffect, useState } from 'react';
import { UserMinus, UserPlus, Users } from 'lucide-react';
import { Movie, Playlist, Profile } from '../../../types';
import { useAuth } from '../../../lib/AuthContext';
import { SocialService } from '../../../lib/social';
import { StudioButton } from '../system/StudioButton';
import { StudioSkeleton } from '../system/StudioSkeleton';
import { StudioPlaylistCard } from './StudioPlaylistsPage';

interface StudioProfilePageProps {
  userId?: string;
  onPlaylistSelect: (playlist: Playlist) => void;
  onMovieSelect?: (movie: Movie) => void;
}

type ProfileStats = {
  historyCount: number;
  playlistsCount: number;
  likedPlaylistsCount: number;
  totalPlaylistViews: number;
};

export const StudioProfilePage: React.FC<StudioProfilePageProps> = ({ userId, onPlaylistSelect }) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = Boolean(user?.id && targetUserId === user.id);

  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      SocialService.getProfile(targetUserId),
      SocialService.getPlaylists(targetUserId),
      SocialService.getUserStats(targetUserId),
      SocialService.getFollowStats(targetUserId),
      user?.id && user.id !== targetUserId ? SocialService.isFollowing(user.id, targetUserId) : Promise.resolve(false),
    ])
      .then(([nextProfile, nextPlaylists, nextStats, nextFollowStats, nextIsFollowing]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setPlaylists(nextPlaylists || []);
        setStats(nextStats);
        setFollowStats(nextFollowStats || { followers: 0, following: 0 });
        setIsFollowing(Boolean(nextIsFollowing));
      })
      .catch(error => {
        console.error('Failed to load Studio profile', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetUserId, user?.id]);

  const toggleFollow = async () => {
    if (!user?.id || !targetUserId || isOwnProfile) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowStats(current => ({ ...current, followers: Math.max(current.followers + (next ? 1 : -1), 0) }));
    try {
      if (next) await SocialService.followUser(user.id, targetUserId);
      else await SocialService.unfollowUser(user.id, targetUserId);
    } catch (error) {
      console.error('Failed to update follow state', error);
      setIsFollowing(!next);
      setFollowStats(current => ({ ...current, followers: Math.max(current.followers + (next ? -1 : 1), 0) }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 pb-20">
        <StudioSkeleton className="h-56 rounded-[32px]" />
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 8 }).map((_, index) => <StudioSkeleton key={index} className="aspect-[4/5]" />)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-10 text-center text-white/45">Profile not found.</div>;
  }

  return (
    <div className="pb-20">
      <section className="mb-9 border-b border-white/8 pb-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username || 'User'}&background=111827&color=fff&bold=true`}
              alt={profile.username}
              className="h-20 w-20 rounded-[24px] border border-white/10 object-cover md:h-24 md:w-24"
            />
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/42 px-3 py-1 text-xs font-bold uppercase text-white/45">
                <Users size={13} />
                Studio profile
              </div>
              <h1 className="break-words text-4xl font-black tracking-tight text-white md:text-5xl">{profile.username}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-white/42">
                <span>{followStats.followers} followers</span>
                <span>{followStats.following} following</span>
                <span>{stats?.playlistsCount || playlists.length} playlists</span>
              </div>
            </div>
          </div>

          {!isOwnProfile && (
            <StudioButton type="button" variant={isFollowing ? 'subtle' : 'glass'} onClick={toggleFollow}>
              {isFollowing ? <UserMinus size={17} /> : <UserPlus size={17} />}
              {isFollowing ? 'Following' : 'Follow'}
            </StudioButton>
          )}
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Views', stats?.totalPlaylistViews || 0],
            ['Watch history', stats?.historyCount || 0],
            ['Liked lists', stats?.likedPlaylistsCount || 0],
            ['Shelves', stats?.playlistsCount || playlists.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[20px] border border-white/8 bg-white/[0.035] p-4">
              <div className="text-2xl font-black text-white">{Number(value).toLocaleString()}</div>
              <div className="mt-1 text-xs font-bold uppercase text-white/34">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-white">{isOwnProfile ? 'Your playlists' : 'Playlists'}</h2>
          <div className="text-sm font-semibold text-white/36">{playlists.length} shelves</div>
        </div>
        {playlists.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {playlists.map(playlist => (
              <StudioPlaylistCard key={playlist.id} playlist={playlist} onClick={() => onPlaylistSelect(playlist)} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-10 text-center text-white/45">No playlists yet.</div>
        )}
      </section>
    </div>
  );
};
