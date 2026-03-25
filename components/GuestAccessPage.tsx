import React, { useEffect, useRef, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { isGuestAccount, isGuestExpired } from '../lib/guestAccess';
import { TurnstileWidget, type TurnstileWidgetHandle } from './TurnstileWidget';

interface GuestAccessPageProps {
    token: string | null;
}

export const GuestAccessPage: React.FC<GuestAccessPageProps> = ({ token }) => {
    const { user, profile, loading, signOut, refreshProfile } = useAuth();
    const turnstileEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
    const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
    const [status, setStatus] = useState('Use the link below to open a temporary guest account.');
    const [error, setError] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const redirectStartedRef = useRef(false);

    const isAnonymousSession = Boolean((user as { is_anonymous?: boolean } | null)?.is_anonymous);

    useEffect(() => {
        if (!token || loading) return;

        const finishRedirect = () => {
            if (redirectStartedRef.current) return;
            redirectStartedRef.current = true;
            setStatus('Guest access is ready. Redirecting...');
            window.setTimeout(() => {
                window.location.replace('/');
            }, 450);
        };

        if (profile && isGuestAccount(profile) && profile.guest_link_id) {
            finishRedirect();
            return;
        }

        if (profile && isGuestExpired(profile)) {
            finishRedirect();
            return;
        }

        if (user && !isAnonymousSession && !isGuestAccount(profile)) {
            setStatus('Sign out of your current account first to use this guest link.');
            return;
        }

        if (!user) {
            setStatus(turnstileEnabled
                ? 'Complete the security check, then continue as guest.'
                : 'Continue to open a temporary guest account.');
            return;
        }

        if (isAnonymousSession) {
            setStatus('Continue to finish claiming this guest account.');
        }
    }, [token, user, profile, loading, isAnonymousSession, refreshProfile, turnstileEnabled]);

    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const redeemGuestAccess = async () => {
        let lastError: any = null;

        for (let attempt = 0; attempt < 4; attempt += 1) {
            try {
                await SocialService.redeemGuestAccessLink(token as string);
                await refreshProfile();
                return;
            } catch (err: any) {
                lastError = err;
                if (!String(err?.message || '').toLowerCase().includes('profile not found')) {
                    break;
                }
                await wait(300 * (attempt + 1));
            }
        }

        throw lastError;
    };

    const handleContinue = async () => {
        if (!token || isWorking) return;

        let createdAnonymousSession = false;

        if (user && !isAnonymousSession && !isGuestAccount(profile)) {
            setStatus('Sign out of your current account first to use this guest link.');
            return;
        }

        if (!user && turnstileEnabled && !captchaToken) {
            setStatus('Complete the security check first.');
            return;
        }

        setIsWorking(true);
        setError(null);

        try {
            if (!user) {
                setStatus('Checking guest link...');
                const inspection = await SocialService.inspectGuestAccessLink(token);
                if (!inspection.can_redeem) {
                    throw new Error(inspection.reason || 'This guest link could not be claimed.');
                }

                setStatus('Creating guest session...');
                const { error: signInError } = await supabase.auth.signInAnonymously({
                    options: {
                        captchaToken: captchaToken || undefined,
                    }
                });
                if (signInError) throw signInError;
                createdAnonymousSession = true;
            }

            setStatus('Claiming guest access...');
            await redeemGuestAccess();
            setStatus('Guest access is ready. Redirecting...');
            window.setTimeout(() => {
                window.location.replace('/');
            }, 450);
        } catch (err: any) {
            if (createdAnonymousSession || (isAnonymousSession && !isGuestAccount(profile))) {
                try {
                    await SocialService.cleanupUnclaimedGuestSession();
                } catch (cleanupError) {
                    console.error('Failed to cleanup unclaimed guest session', cleanupError);
                }

                try {
                    await supabase.auth.signOut();
                } catch (signOutError) {
                    console.error('Failed to sign out failed guest session', signOutError);
                }
            }

            setError(err?.message || 'Guest access could not be redeemed.');
            setStatus('This guest link could not be claimed.');
            turnstileRef.current?.reset();
            setCaptchaToken(null);
        } finally {
            setIsWorking(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1014] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-zinc-950/80 p-7 md:p-8 shadow-2xl">
                <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500 font-bold mb-3">
                    Guest Access
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
                    {error ? 'Guest access unavailable' : 'Open temporary account'}
                </h1>
                <p className="text-zinc-400 leading-relaxed text-sm">
                    {error || status}
                </p>

                {turnstileEnabled && !user && (
                    <div className="mt-5">
                        <TurnstileWidget
                            ref={turnstileRef}
                            onTokenChange={setCaptchaToken}
                            action="guest_redeem"
                        />
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3 items-center">
                    {!error && (
                        <button
                            onClick={() => void handleContinue()}
                            disabled={isWorking || (turnstileEnabled && !user && !captchaToken)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isWorking && <Loader2 size={14} className="animate-spin" />}
                            <span>{isWorking ? 'Please wait' : 'Continue as guest'}</span>
                        </button>
                    )}
                    {user && !isAnonymousSession && !isGuestAccount(profile) && (
                        <button
                            onClick={() => void signOut()}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                        >
                            <LogOut size={14} />
                            Sign out first
                        </button>
                    )}
                </div>

                {!error && (
                    <p className="mt-4 text-xs text-zinc-500">
                        Guest accounts stay hidden from search and social actions until secured.
                    </p>
                )}
            </div>
        </div>
    );
};
