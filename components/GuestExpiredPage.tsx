import React from 'react';
import type { Profile } from '../types';
import { Lock, LogOut } from 'lucide-react';
import { formatGuestExpiry } from '../lib/guestAccess';

interface GuestExpiredPageProps {
    profile: Profile | null;
    onSignOut: () => Promise<void>;
}

export const GuestExpiredPage: React.FC<GuestExpiredPageProps> = ({ profile, onSignOut }) => {
    return (
        <div className="min-h-screen bg-[#0f1014] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-xl border border-white/10 bg-zinc-950/80 rounded-[32px] p-8 md:p-10 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-6">
                    <Lock size={26} />
                </div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500 font-bold mb-3">
                    Guest Access Ended
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                    This guest account is now locked.
                </h1>
                <p className="text-zinc-400 leading-relaxed">
                    Access for <span className="text-white font-semibold">{profile?.username || 'this guest account'}</span> expired on{' '}
                    <span className="text-white">{formatGuestExpiry(profile?.guest_expires_at)}</span>. The account data is still kept for admins, but the guest session can no longer use the site.
                </p>
                <p className="text-zinc-500 text-sm mt-4">
                    If you still need access, ask an admin for a new guest link or secure the account before expiry next time.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                    <button
                        onClick={() => void onSignOut()}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};
