import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { isGuestAccount, isGuestExpired, formatGuestExpiry } from '../lib/guestAccess';
import { validateEmail } from '../lib/emailValidator';
import { supabase } from '../lib/supabase';
import { SocialService } from '../lib/social';

interface GuestSecurityCardProps {
    compact?: boolean;
}

export const GuestSecurityCard: React.FC<GuestSecurityCardProps> = ({ compact = false }) => {
    const { user, profile, refreshProfile } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user?.email) {
            setEmail(user.email);
        }
    }, [user?.email]);

    if (!user || !profile || !isGuestAccount(profile)) {
        return null;
    }

    const expired = isGuestExpired(profile);
    const hasVerifiedEmail = Boolean(user.email && (user as { email_confirmed_at?: string | null }).email_confirmed_at);

    const handleSaveEmail = async () => {
        const validation = validateEmail(email);
        if (!validation.valid) {
            setError(validation.error);
            return;
        }

        setIsSaving(true);
        setError(null);
        setMessage(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({ email });
            if (updateError) throw updateError;

            setMessage('Verification email sent. Confirm it, then return here to finish securing the account with a password.');
        } catch (err: any) {
            setError(err?.message || 'Could not add that email address.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSecureAccount = async () => {
        if (!password || password.length < 6) {
            setError('Choose a password with at least 6 characters.');
            return;
        }

        setIsSaving(true);
        setError(null);
        setMessage(null);

        try {
            const { error: passwordError } = await supabase.auth.updateUser({ password });
            if (passwordError) throw passwordError;

            await SocialService.secureGuestAccount();
            await refreshProfile();
            setPassword('');
            setMessage('This guest account is now secured as a standard account. It will show up like a normal user account going forward.');
        } catch (err: any) {
            setError(err?.message || 'Could not secure this account yet.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className={`border border-white/10 bg-zinc-950/70 ${compact ? 'rounded-[24px] p-5' : 'rounded-[32px] p-8'}`}>
            <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {expired ? <Lock size={18} className="text-red-400" /> : <ShieldCheck size={18} className="text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500 font-bold mb-2">
                        Guest Account
                    </div>
                    <h3 className={`${compact ? 'text-lg' : 'text-2xl'} font-black text-white tracking-tight`}>
                        {expired ? 'This guest account can no longer be secured' : 'Secure this guest account before it expires'}
                    </h3>
                    <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                        {expired
                            ? `Guest access expired on ${formatGuestExpiry(profile.guest_expires_at)}. The account stays archived for admins, but you can no longer turn it into a permanent login.`
                            : `Guest access expires on ${formatGuestExpiry(profile.guest_expires_at)}. Add an email, verify it, then set a password to convert this into a permanent standard account.`}
                    </p>
                </div>
            </div>

            {!expired && (
                <div className="mt-6 space-y-4">
                    {!hasVerifiedEmail ? (
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">
                                    Step 1: Add Email
                                </label>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="relative flex-1">
                                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@example.com"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveEmail}
                                        disabled={isSaving || !email.trim()}
                                        className="px-5 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-zinc-200 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Sending...' : 'Send Verification'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-500">
                                Until you secure it, this guest account stays device-bound and hidden from search, follows, and follower lists.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-300">
                                <CheckCircle2 size={14} />
                                <span>Email ready: {user.email}</span>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">
                                    Step 2: Set Password
                                </label>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Choose a password"
                                        minLength={6}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20"
                                    />
                                    <button
                                        onClick={handleSecureAccount}
                                        disabled={isSaving || password.length < 6}
                                        className="px-5 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-zinc-200 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Securing...' : 'Secure Account'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {message && (
                <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                    {message}
                </div>
            )}

            {error && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            )}
        </section>
    );
};
