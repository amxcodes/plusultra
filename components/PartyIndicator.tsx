import React from 'react';
import { Users, LogOut } from 'lucide-react';
import { getDisplayName } from '../lib/displayName';

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
        <div className="fixed top-1/2 -translate-y-1/2 left-0 z-50 flex flex-col gap-4 p-4 rounded-r-2xl bg-black/80 backdrop-blur-xl border-y border-r border-white/5 transition-all duration-300 opacity-30 hover:opacity-100 group shadow-2xl">
            {/* Header / Count */}
            <div className="flex flex-col items-center gap-1">
                <div className="p-2 rounded-full bg-white/5 border border-white/10">
                    <Users size={16} className="text-zinc-200" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400">
                    {members.length}/4
                </span>
            </div>

            {/* Avatars Vertical Stack */}
            <div className="flex flex-col -space-y-2 items-center">
                {members.map((member) => (
                    (() => {
                        const displayName = getDisplayName(member.username);
                        return (
                    <div
                        key={member.userId}
                        className="w-8 h-8 rounded-full border-2 border-black overflow-hidden bg-zinc-800 relative z-0 hover:z-10 transition-all hover:scale-110"
                        title={displayName}
                    >
                        {member.avatar ? (
                            <img
                                src={member.avatar}
                                alt={displayName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white uppercase">
                                {displayName[0]}
                            </div>
                        )}
                    </div>
                        );
                    })()
                ))}
            </div>

            {/* Invite Code */}
            {isHost && inviteCode && (
                <div className="flex flex-col items-center gap-1 py-2 border-t border-white/5 w-full">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Code</span>
                    <span className="font-mono font-bold text-white text-xs tracking-wider bg-white/5 px-2 py-0.5 rounded text-center w-full">
                        {inviteCode}
                    </span>
                </div>
            )}

            {/* Sync Button */}
            {isHost && showSyncButton && onSync && (
                <button
                    onClick={onSync}
                    className="w-full py-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-[10px] text-blue-200 font-bold uppercase tracking-wider rounded transition-colors"
                >
                    Sync
                </button>
            )}

            {/* Leave Button */}
            <button
                onClick={onLeave}
                className="mt-2 p-2 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all flex items-center justify-center"
                title="Leave Party"
            >
                <LogOut size={16} />
            </button>
        </div>
    );
};
