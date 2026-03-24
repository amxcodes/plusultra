import React from 'react';
import { getDisplayName } from '../lib/displayName';

interface AttributionTagProps {
    addedBy?: {
        username: string;
        avatarUrl?: string;
    };
    className?: string;
}

export const AttributionTag: React.FC<AttributionTagProps> = ({ addedBy, className = '' }) => {
    if (!addedBy) return null;
    const displayName = getDisplayName(addedBy.username);

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 ${className}`}>
            <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-800">
                <img
                    src={addedBy.avatarUrl || `https://ui-avatars.com/api/?name=${displayName}`}
                    alt={displayName}
                    className="w-full h-full object-cover"
                />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-white/90 truncate max-w-[80px]">
                {displayName}
            </span>
        </div>
    );
};
