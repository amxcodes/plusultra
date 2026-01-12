
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Profile } from '../types';
import { UserPlus, UserCheck, Activity } from 'lucide-react';

interface ActivityPageProps {
    onNavigate?: (page: string, params?: any) => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [followers, setFollowers] = useState<Profile[]>([]);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Get who follows me
                const myFollowers = await SocialService.getFollowers(user.id);
                setFollowers(myFollowers);

                // 2. Check which of them I ALREADY follow back
                // We can fetch who I follow and compare IDs
                // 2. Check which of them I ALREADY follow back 
                // We need actual IDs. Let's do a quick check for each or fetch all my following.
                // Optimally: fetch all 'following' where follower_id = me.

                // Since SocialService.getFollowStats only returns counts, let's use a new helper or just iterate valid checks if list is small.
                // or just check isFollowing for each. Parallel is fine for < 50 items.
                const statusMap = new Set<string>();

                // Parallel check (can be optimized later with a bulk query)
                await Promise.all(myFollowers.map(async (follower) => {
                    const isFollowing = await SocialService.isFollowing(user.id, follower.id);
                    if (isFollowing) statusMap.add(follower.id);
                }));

                setFollowingIds(statusMap);

                // Mark activity as seen
                await SocialService.markActivitySeen(user.id);

            } catch (error) {
                console.error("Failed to load activity", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleFollowBack = async (targetId: string) => {
        if (!user) return;

        // Optimistic UI update
        const isAlreadyFollowing = followingIds.has(targetId);
        const newSet = new Set(followingIds);
        if (isAlreadyFollowing) {
            newSet.delete(targetId);
            setFollowingIds(newSet);
            await SocialService.unfollowUser(user.id, targetId);
        } else {
            newSet.add(targetId);
            setFollowingIds(newSet);
            await SocialService.followUser(user.id, targetId);
        }
    };

    if (isLoading) {
        return (
            <div className="pt-24 px-8 md:px-16 max-w-4xl mx-auto min-h-screen">
                {/* Header Skeleton */}
                <div className="flex items-center gap-4 mb-8 animate-pulse">
                    <div className="w-14 h-14 bg-white/5 rounded-full" />
                    <div className="space-y-2">
                        <div className="h-8 w-48 bg-white/5 rounded" />
                        <div className="h-4 w-64 bg-white/5 rounded" />
                    </div>
                </div>

                {/* List Skeleton */}
                <div className="bg-[#0f1014] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5">
                        <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
                    </div>
                    <div className="divide-y divide-white/5">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="p-4 flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-white/5" />
                                    <div className="space-y-2">
                                        <div className="h-5 w-32 bg-white/5 rounded" />
                                        <div className="h-3 w-24 bg-white/5 rounded" />
                                    </div>
                                </div>
                                <div className="w-24 h-9 rounded-full bg-white/5" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-40 px-8 md:px-16 max-w-4xl mx-auto min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-white/10 rounded-full">
                    <Activity size={32} className="text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Activity</h1>
                    <p className="text-zinc-400">See who follows you and confirm connections.</p>
                </div>
            </div>

            <div className="bg-[#0f1014] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-lg font-semibold text-white">Recent Follows</h2>
                </div>

                {followers.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 text-zinc-600">
                            <UserPlus size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white">No new followers</h3>
                        <p className="text-zinc-500 mt-2 max-w-xs">When people follow you, they'll show up here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {followers.map(follower => {
                            const isFollowingBack = followingIds.has(follower.id);

                            return (
                                <div key={follower.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                    <div
                                        onClick={() => onNavigate?.('profile', { id: follower.id })}
                                        className="flex items-center gap-4 cursor-pointer"
                                    >
                                        <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                                            <img
                                                src={follower.avatar_url || `https://ui-avatars.com/api/?name=${follower.username}`}
                                                alt={follower.username}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-medium text-lg">{follower.username}</h4>
                                            <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Started following you</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleFollowBack(follower.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all
                                       ${isFollowingBack
                                                ? 'bg-zinc-800 text-zinc-400 hover:bg-red-900/50 hover:text-red-400 border border-transparent'
                                                : 'bg-white text-black hover:bg-gray-200 hover:scale-105 shadow-lg shadow-white/10'}`}
                                    >
                                        {isFollowingBack ? (
                                            <>
                                                <UserCheck size={16} />
                                                <span>Following</span>
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus size={16} />
                                                <span>Follow Back</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
