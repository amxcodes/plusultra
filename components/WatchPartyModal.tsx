import React, { useState, useEffect } from 'react';
import { X, Users, Copy, Check } from 'lucide-react';
import { SocialService } from '../lib/social';

interface WatchPartyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateParty: () => Promise<string | null>; // Returns invite code
    onJoinParty: (code: string) => Promise<boolean>;
    autoJoinCode?: string;
}

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({
    isOpen,
    onClose,
    onCreateParty,
    onJoinParty,
    autoJoinCode
}) => {
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const [inviteCode, setInviteCode] = useState('');
    const [joinCode, setJoinCode] = useState(autoJoinCode || '');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [siteUrl, setSiteUrl] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (autoJoinCode) {
                setActiveTab('join');
                setJoinCode(autoJoinCode);
                handleJoin(autoJoinCode); // Auto trigger
            }
            SocialService.getAppSettings().then(settings => {
                if (settings.site_url) setSiteUrl(settings.site_url);
            });
        }
    }, [isOpen]);

    const handleJoin = async (codeOverride?: string) => {
        const codeToUse = (codeOverride || joinCode).trim();
        if (codeToUse.length !== 6) {
            setError('Code must be 6 characters');
            return;
        }
        setLoading(true);
        setError('');
        const success = await onJoinParty(codeToUse.toUpperCase());
        if (success) {
            onClose();
        } else {
            setError('Party not found or full');
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    const handleCreate = async () => {
        setLoading(true);
        setError('');
        const code = await onCreateParty();
        if (code) {
            setInviteCode(code);
        } else {
            setError('Failed to create party');
        }
        setLoading(false);
    };



    const copyCode = () => {
        const textToCopy = siteUrl
            ? `${siteUrl}?join=${inviteCode}`
            : inviteCode;

        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-sm">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className="relative w-[420px] bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users size={20} />
                            Watch Together
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={18} className="text-zinc-400" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'create'
                                ? 'bg-white text-black'
                                : 'bg-transparent text-zinc-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            Create Party
                        </button>
                        <button
                            onClick={() => setActiveTab('join')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'join'
                                ? 'bg-white text-black'
                                : 'bg-transparent text-zinc-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            Join Party
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'create' ? (
                        <div className="space-y-4">
                            {!inviteCode ? (
                                <>
                                    <p className="text-sm text-zinc-400">
                                        Create a watch party and invite up to 3 friends to watch together.
                                    </p>
                                    <button
                                        onClick={handleCreate}
                                        disabled={loading}
                                        className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                                    >
                                        {loading ? 'Creating...' : 'Create Party'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-zinc-400 mb-4">
                                        Share this code with your friends:
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-center">
                                            <span className="text-2xl font-mono font-bold text-white tracking-widest">
                                                {inviteCode}
                                            </span>
                                        </div>
                                        <button
                                            onClick={copyCode}
                                            className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                                        >
                                            {copied ? <Check size={20} className="text-white" /> : <Copy size={20} className="text-white" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-600 mt-2">
                                        Party expires in 4 hours
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-zinc-400">
                                Enter the 6-character invite code:
                            </p>
                            <input
                                type="text"
                                maxLength={6}
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.trim().toUpperCase())}
                                placeholder="ABC123"
                                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-center text-2xl font-mono font-bold text-white placeholder:text-zinc-700 tracking-widest uppercase focus:outline-none focus:border-white/20 transition-colors"
                            />
                            <button
                                onClick={handleJoin}
                                disabled={loading || joinCode.length !== 6}
                                className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Joining...' : 'Join Party'}
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
