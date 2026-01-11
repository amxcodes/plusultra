import React from 'react';
import { Users, LogOut } from 'lucide-react';

interface PartyMember {
    userId: string;
    username: string;
    avatar: string;
}

interface PartyIndicatorProps {
    members: PartyMember[];
    inviteCode?: string;
    isHost: boolean;
    onLeave: () => void;
    onSync?: () => void; // For non-Vidora manual sync
    showSyncButton: boolean;
}

export const PartyIndicator: React.FC<PartyIndicatorProps> = ({
    members,
    inviteCode,
    isHost,
    onLeave,
    onSync,
    showSyncButton
}) => {
    return (
        <div className="fixed top-6 left-6 z-50 flex flex-col gap-2">
            {/* Participant Avatars */}
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-2 rounded-full border border-white/10">
                <Users size={14} className="text-white" />
                <div className="flex -space-x-2">
                    {members.slice(0, 4).map((member) => (
                        <div
                            key={member.userId}
                            className="w-6 h-6 rounded-full border-2 border-black overflow-hidden bg-zinc-800"
                            title={member.username}
                        >
                            {member.avatar ? (
                                <img
                                    src={member.avatar}
                                    alt={member.username}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white">
                                    {member.username[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <span className="text-xs text-white font-medium ml-1">
                    {members.length}/4
                </span>
            </div>

            {/* Invite Code (Host Only) */}
            {isHost && inviteCode && (
                <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                        Code:
                    </span>
                    <span className="text-xs text-white font-mono font-bold ml-1.5">
                        {inviteCode}
                    </span>
                </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
                {/* Sync Button (Host Only, Non-Vidora) */}
                {isHost && showSyncButton && onSync && (
                    <button
                        onClick={onSync}
                        className="bg-black/50 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 transition-colors text-xs text-white font-medium"
                    >
                        Sync All
                    </button>
                )}

                {/* Leave Button */}
                <button
                    onClick={onLeave}
                    className="bg-black/50 hover:bg-red-500/20 backdrop-blur-md p-1.5 rounded-full border border-white/10 hover:border-red-500/20 transition-colors group"
                    title="Leave Party"
                >
                    <LogOut size={14} className="text-white group-hover:text-red-400 transition-colors" />
                </button>
            </div>
        </div>
    );
};
