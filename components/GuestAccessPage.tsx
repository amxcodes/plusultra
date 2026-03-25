import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, LogOut, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { isGuestAccount, isGuestExpired } from '../lib/guestAccess';

interface GuestAccessPageProps {
    token: string | null;
}

export const GuestAccessPage: React.FC<GuestAccessPageProps> = ({ token }) => {
    const { user, profile, loading, signOut, refreshProfile } = useAuth();
    const [status, setStatus] = useState('Preparing your guest access...');
    const [error, setError] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const signInStartedRef = useRef(false);
    const redeemStartedRef = useRef(false);
    const redirectStartedRef = useRef(false);

    const isAnonymousSession = Boolean((user as { is_anonymous?: boolean } | null)?.is_anonymous);

    useEffect(() => {
        if (!token || loading) return;

        const finishRedirect = () => {
            if (redirectStartedRef.current) return;
            redirectStartedRef.current = true;
            setStatus('Guest access is ready. Taking you in...');
            window.setTimeout(() => {
                window.location.replace('/');
            }, 450);
        };

        const ensureGuestSession = async () => {
            if (profile && isGuestAccount(profile) && profile.guest_link_id) {
                finishRedirect();
                return;
            }

            if (profile && isGuestExpired(profile)) {
                finishRedirect();
                return;
            }

            if (user && !isAnonymousSession && !isGuestAccount(profile)) {
                setStatus('Sign out of your current account to claim this guest link.');
                return;
            }

            if (!user) {
                if (signInStartedRef.current) return;
                signInStartedRef.current = true;
                setIsWorking(true);
                setStatus('Creating a guest session...');

                const { error: signInError } = await supabase.auth.signInAnonymously();
                if (signInError) {
                    setError(signInError.message);
                    setStatus('Guest access could not be started.');
                }
                setIsWorking(false);
                return;
            }

            if (!isAnonymousSession) {
                return;
            }

            if (redeemStartedRef.current) return;
            redeemStartedRef.current = true;
            setIsWorking(true);
            setStatus('Claiming your guest access...');

            try {
                await SocialService.redeemGuestAccessLink(token);
                await refreshProfile();
                finishRedirect();
            } catch (err: any) {
                setError(err?.message || 'Guest access could not be redeemed.');
                setStatus('This guest link could not be claimed.');
            } finally {
                setIsWorking(false);
            }
        };

        void ensureGuestSession();
    }, [token, user, profile, loading, isAnonymousSession, refreshProfile]);

    return (
        <div className="min-h-screen bg-[#0f1014] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-zinc-950/80 p-8 md:p-10 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                    <Sparkles size={24} className="text-white" />
                </div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500 font-bold mb-3">
                    Guest Access
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                    {error ? 'Guest access is unavailable' : 'Opening your temporary account'}
                </h1>
                <p className="text-zinc-400 leading-relaxed">
                    {error || status}
                </p>

                {!error && (
                    <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
                        {isWorking ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        <span>Guest accounts stay hidden from search and social actions until secured.</span>
                    </div>
                )}

                <div className="mt-8 flex flex-wrap gap-3">
                    {user && !isAnonymousSession && !isGuestAccount(profile) && (
                        <button
                            onClick={() => void signOut()}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors"
                        >
                            <LogOut size={16} />
                            Sign Out And Continue
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
