import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Link2, Lock, RefreshCw, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { SocialService } from '../lib/social';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
import { formatGuestExpiry } from '../lib/guestAccess';
import type { GuestAccessLink, GuestAccountSummary } from '../services/GuestAccessService';

interface GuestAccessAdminPanelProps {
    compact?: boolean;
}

const buildDefaultExpiry = () => {
    const value = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pad = (part: number) => part.toString().padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

export const GuestAccessAdminPanel: React.FC<GuestAccessAdminPanelProps> = ({ compact = false }) => {
    const { success, error } = useToast();
    const confirm = useConfirm();
    const [links, setLinks] = useState<GuestAccessLink[]>([]);
    const [accounts, setAccounts] = useState<GuestAccountSummary[]>([]);
    const [expiresAt, setExpiresAt] = useState(buildDefaultExpiry);
    const [maxUses, setMaxUses] = useState(1);
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [latestCreatedLink, setLatestCreatedLink] = useState<{ id: string; url: string } | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [guestLinks, guestAccounts] = await Promise.all([
                SocialService.getGuestAccessLinks(50),
                SocialService.getGuestAccounts(100),
            ]);
            setLinks(guestLinks);
            setAccounts(guestAccounts);
        } catch (err) {
            console.error(err);
            error('Failed to load guest access data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const activeGuests = useMemo(
        () => accounts.filter((account) => account.account_kind === 'guest' && !account.is_expired),
        [accounts]
    );

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            const created = await SocialService.createGuestAccessLink(new Date(expiresAt).toISOString(), maxUses, note);
            const url = `${window.location.origin}/guest/${created.token}`;
            setLatestCreatedLink({ id: created.id, url });
            await navigator.clipboard?.writeText(url);
            success('Guest access link created and copied');
            setNote('');
            await loadData();
        } catch (err) {
            console.error(err);
            error('Failed to create guest access link');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopyLatest = async () => {
        if (!latestCreatedLink) return;
        try {
            await navigator.clipboard?.writeText(latestCreatedLink.url);
            success('Guest link copied');
        } catch (err) {
            console.error(err);
            error('Could not copy the link');
        }
    };

    const handleDisableLink = async (linkId: string) => {
        const approved = await confirm({
            title: 'Disable Guest Link',
            message: 'Disable this guest link for any future redemptions?',
            confirmText: 'Disable Link',
            variant: 'warning',
        });

        if (!approved) return;

        try {
            await SocialService.disableGuestLink(linkId);
            success('Guest link disabled');
            await loadData();
        } catch (err) {
            console.error(err);
            error('Could not disable the guest link');
        }
    };

    const handleExtendGuest = async (account: GuestAccountSummary) => {
        const nextExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        try {
            await SocialService.extendGuestAccess(account.id, nextExpiry);
            success(`Extended ${account.username} by 7 days`);
            await loadData();
        } catch (err) {
            console.error(err);
            error('Could not extend guest access');
        }
    };

    return (
        <div className="space-y-6">
            <div className={`grid gap-5 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.2fr_1fr]'}`}>
                <section className="border border-white/10 rounded-3xl bg-zinc-950/70 p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <UserRoundPlus size={18} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500 font-bold mb-2">
                                New Guest Link
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight">Create temporary guest access</h3>
                            <p className="text-sm text-zinc-400 mt-2">
                                The link creates a hidden guest account when it is redeemed. The raw link is only copyable right after creation.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">
                                Expires At
                            </label>
                            <input
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">
                                Max Uses
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={25}
                                value={maxUses}
                                onChange={(e) => setMaxUses(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">
                                Internal Note
                            </label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Optional note for admins"
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20"
                            />
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            onClick={() => void handleCreate()}
                            disabled={isCreating}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-zinc-200 disabled:opacity-50"
                        >
                            {isCreating ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
                            Create Guest Link
                        </button>
                        {latestCreatedLink && (
                            <button
                                onClick={() => void handleCopyLatest()}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white hover:bg-white/10"
                            >
                                <Copy size={16} />
                                Copy Latest Link
                            </button>
                        )}
                    </div>

                    {latestCreatedLink && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Latest Guest Link</div>
                            <div className="text-sm text-zinc-300 break-all">{latestCreatedLink.url}</div>
                        </div>
                    )}
                </section>

                <section className="border border-white/10 rounded-3xl bg-zinc-950/70 p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <ShieldCheck size={18} className="text-white" />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500 font-bold mb-2">
                                Live Snapshot
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight">Current guest estate</h3>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Links</div>
                            <div className="text-3xl font-black text-white mt-2">{links.length}</div>
                            <div className="text-xs text-zinc-500 mt-1">Total issued guest links</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Active Guests</div>
                            <div className="text-3xl font-black text-white mt-2">{activeGuests.length}</div>
                            <div className="text-xs text-zinc-500 mt-1">Accounts still within expiry</div>
                        </div>
                    </div>
                </section>
            </div>

            <div className={`grid gap-5 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
                <section className="border border-white/10 rounded-3xl bg-zinc-950/70 p-6">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500 font-bold mb-2">
                                Guest Accounts
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">Redeemed accounts</h3>
                        </div>
                        <button
                            onClick={() => void loadData()}
                            className="p-2 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        >
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {accounts.map((account) => (
                            <div key={account.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-white font-bold truncate">{account.username}</div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                            {account.account_kind === 'guest'
                                                ? (account.is_expired ? 'Expired guest' : 'Active guest')
                                                : 'Secured standard account'}
                                            {' '}• Created by {account.created_by_username || 'Admin'}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border ${account.account_kind === 'guest'
                                        ? (account.is_expired
                                            ? 'border-red-500/20 bg-red-500/10 text-red-300'
                                            : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300')
                                        : 'border-green-500/20 bg-green-500/10 text-green-300'
                                        }`}>
                                        {account.account_kind === 'guest'
                                            ? (account.is_expired ? 'Expired' : 'Guest')
                                            : 'Secured'}
                                    </span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 mt-4 text-xs text-zinc-400">
                                    <div>
                                        <div className="text-zinc-500 uppercase tracking-widest text-[10px] mb-1">Expiry</div>
                                        <div>{formatGuestExpiry(account.guest_expires_at)}</div>
                                    </div>
                                    <div>
                                        <div className="text-zinc-500 uppercase tracking-widest text-[10px] mb-1">Secured</div>
                                        <div>{account.guest_secured_at ? formatGuestExpiry(account.guest_secured_at) : 'Not yet'}</div>
                                    </div>
                                </div>
                                {account.account_kind === 'guest' && !account.is_expired && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => void handleExtendGuest(account)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
                                        >
                                            <RefreshCw size={14} />
                                            Extend 7 Days
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {!isLoading && accounts.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-zinc-500">
                                No guest accounts have been redeemed yet.
                            </div>
                        )}
                    </div>
                </section>

                <section className="border border-white/10 rounded-3xl bg-zinc-950/70 p-6">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500 font-bold mb-2">
                                Guest Links
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">Issued access links</h3>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {links.map((link) => (
                            <div key={link.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-white font-bold truncate">{link.note || 'Guest access link'}</div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                            Expires {formatGuestExpiry(link.expires_at)} • {link.used_count}/{link.max_uses} uses
                                        </div>
                                        {link.redeemed_username && (
                                            <div className="text-xs text-zinc-400 mt-2">Redeemed by {link.redeemed_username}</div>
                                        )}
                                    </div>
                                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border ${link.status === 'active'
                                        ? 'border-green-500/20 bg-green-500/10 text-green-300'
                                        : link.status === 'disabled'
                                            ? 'border-red-500/20 bg-red-500/10 text-red-300'
                                            : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                                        }`}>
                                        {link.status}
                                    </span>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {latestCreatedLink?.id === link.id && (
                                        <button
                                            onClick={() => void handleCopyLatest()}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
                                        >
                                            <Copy size={14} />
                                            Copy Link
                                        </button>
                                    )}
                                    {link.status === 'active' && (
                                        <button
                                            onClick={() => void handleDisableLink(link.id)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500/15"
                                        >
                                            <Lock size={14} />
                                            Disable
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {!isLoading && links.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-zinc-500">
                                No guest links have been issued yet.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
