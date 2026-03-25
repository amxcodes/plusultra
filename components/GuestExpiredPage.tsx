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
            <div className="w-full max-w-lg border border-white/10 bg-zinc-950/80 rounded-[28px] p-7 md:p-8 shadow-2xl">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-5">
                    <Lock size={18} />
                </div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500 font-bold mb-3">
                    Guest Access Ended
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
                    Guest account locked
                </h1>
                <p className="text-zinc-400 leading-relaxed text-sm">
                    Access for <span className="text-white font-semibold">{profile?.username || 'this guest account'}</span> expired on{' '}
                    <span className="text-white">{formatGuestExpiry(profile?.guest_expires_at)}</span>. The account data is still kept for admins, but the guest session can no longer use the site.
                </p>
                <p className="text-zinc-500 text-sm mt-3">
                    If you still need access, ask an admin for a new guest link or secure the account before expiry next time.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        onClick={() => void onSignOut()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};
