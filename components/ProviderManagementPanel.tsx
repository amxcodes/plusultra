import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { SocialService } from '../lib/social';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
import { getDefaultProviderRecords, PlayerProviderRecord } from '../lib/playerProviders';
import type { AdminProviderAnalytics } from '../services/AdminService';

interface ProviderManagementPanelProps {
    compact?: boolean;
}

type ProviderFormState = {
    id: string;
    name: string;
    render_mode: 'embed' | 'direct';
    enabled: boolean;
    sort_order: number;
    has_events: boolean;
    risk_level: 'low' | 'medium' | 'high';
    tags: string;
    best_for: string;
    movie_embed_template: string;
    tv_embed_template: string;
    movie_direct_template: string;
    tv_direct_template: string;
};

const BUILT_IN_PROVIDER_IDS = new Set(getDefaultProviderRecords().map(provider => provider.id));

const createEmptyForm = (): ProviderFormState => ({
    id: '',
    name: '',
    render_mode: 'embed',
    enabled: true,
    sort_order: 100,
    has_events: false,
    risk_level: 'medium',
    tags: '',
    best_for: '',
    movie_embed_template: '',
    tv_embed_template: '',
    movie_direct_template: '',
    tv_direct_template: '',
});

const recordToForm = (record: PlayerProviderRecord): ProviderFormState => ({
    id: record.id,
    name: record.name,
    render_mode: record.render_mode,
    enabled: record.enabled,
    sort_order: record.sort_order,
    has_events: record.has_events,
    risk_level: record.risk_level,
    tags: (record.tags || []).join(', '),
    best_for: record.best_for || '',
    movie_embed_template: record.movie_embed_template || '',
    tv_embed_template: record.tv_embed_template || '',
    movie_direct_template: record.movie_direct_template || '',
    tv_direct_template: record.tv_direct_template || '',
});

const formToRecord = (form: ProviderFormState): PlayerProviderRecord => ({
    id: form.id.trim(),
    name: form.name.trim(),
    render_mode: form.render_mode,
    enabled: form.enabled,
    sort_order: Number(form.sort_order) || 0,
    has_events: form.has_events,
    risk_level: form.risk_level,
    tags: form.tags.split(',').map(item => item.trim()).filter(Boolean),
    best_for: form.best_for.trim() || null,
    movie_embed_template: form.movie_embed_template.trim() || null,
    tv_embed_template: form.tv_embed_template.trim() || null,
    movie_direct_template: form.movie_direct_template.trim() || null,
    tv_direct_template: form.tv_direct_template.trim() || null,
});

export const ProviderManagementPanel: React.FC<ProviderManagementPanelProps> = ({ compact = false }) => {
    const { success, error, info } = useToast();
    const confirm = useConfirm();
    const [providers, setProviders] = useState<PlayerProviderRecord[]>([]);
    const [analytics, setAnalytics] = useState<AdminProviderAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<ProviderFormState>(createEmptyForm());

    const loadProviders = async () => {
        setLoading(true);
        try {
            const [providerRows, analyticsRows] = await Promise.all([
                SocialService.getProviders({ includeDisabled: true }),
                SocialService.getProviderAnalytics(30)
            ]);
            const analyticsMap = new Map(analyticsRows.map(row => [row.provider_id, row]));
            const merged = providerRows.map(row => ({
                ...row,
                sort_order: analyticsMap.get(row.id)?.sort_order ?? row.sort_order,
            }));
            setProviders(merged);
            setAnalytics(analyticsRows);
        } catch (e) {
            console.error(e);
            error('Failed to load providers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadProviders();
    }, []);

    const sortedProviders = useMemo(() => (
        [...providers].sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
    ), [providers]);

    const analyticsByProvider = useMemo(() => {
        const map = new Map<string, AdminProviderAnalytics>();
        analytics.forEach(item => map.set(item.provider_id, item));
        return map;
    }, [analytics]);

    const resetForm = () => {
        setEditingId(null);
        setForm(createEmptyForm());
    };

    const handleEdit = (provider: PlayerProviderRecord) => {
        setEditingId(provider.id);
        setForm(recordToForm(provider));
    };

    const handleSave = async () => {
        const normalizedId = form.id.trim().toLowerCase().replace(/\s+/g, '-');
        if (!normalizedId || !form.name.trim()) {
            info('Provider id and name are required');
            return;
        }

        const record = formToRecord({
            ...form,
            id: normalizedId,
        });

        if (record.render_mode === 'embed' && !record.movie_embed_template && !record.tv_embed_template) {
            info('Add at least one embed template for an embed provider');
            return;
        }

        if (record.render_mode === 'direct' && !record.movie_direct_template && !record.tv_direct_template) {
            info('Add at least one direct template for a direct provider');
            return;
        }

        setSaving(true);
        try {
            await SocialService.upsertProvider(record);
            success(editingId ? 'Provider updated' : 'Provider added');
            await loadProviders();
            resetForm();
        } catch (e) {
            console.error(e);
            error('Failed to save provider');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (provider: PlayerProviderRecord) => {
        if (BUILT_IN_PROVIDER_IDS.has(provider.id)) {
            info('Built-in providers should be disabled instead of deleted');
            return;
        }

        const confirmed = await confirm({
            title: 'Delete Provider',
            message: `Delete provider "${provider.name}"?`,
            confirmText: 'Delete',
            variant: 'danger'
        });
        if (!confirmed) return;

        try {
            await SocialService.deleteProvider(provider.id);
            success('Provider deleted');
            if (editingId === provider.id) {
                resetForm();
            }
            await loadProviders();
        } catch (e) {
            console.error(e);
            error('Failed to delete provider');
        }
    };

    const toggleProvider = async (provider: PlayerProviderRecord) => {
        try {
            await SocialService.upsertProvider({
                ...provider,
                enabled: !provider.enabled,
            });
            setProviders(prev => prev.map(item => item.id === provider.id ? {
                ...item,
                enabled: !item.enabled,
            } : item));
        } catch (e) {
            console.error(e);
            error('Failed to update provider');
        }
    };

    return (
        <div className="space-y-5">
            <div className={`border border-zinc-800 rounded-2xl overflow-hidden ${compact ? 'bg-zinc-900' : 'bg-zinc-900/20'}`}>
                <div className={`${compact ? 'p-5' : 'p-5 border-b border-zinc-800/80'} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
                    <div>
                        <h3 className="font-bold text-white text-base">Provider Control</h3>
                        <p className="text-zinc-500 text-sm">
                            Enable, reorder, and add embed or direct providers. Use <code>{'{{tmdbId}}'}</code>, <code>{'{{season}}'}</code>, and <code>{'{{episode}}'}</code> in templates.
                        </p>
                    </div>
                    <button
                        onClick={resetForm}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 bg-black/40 text-white text-sm font-medium hover:border-zinc-500 transition-colors"
                    >
                        <Plus size={14} />
                        New Provider
                    </button>
                </div>

                <div className={compact ? 'p-4 space-y-3' : 'p-5 space-y-3'}>
                    {loading ? (
                        <div className="text-sm text-zinc-500">Loading providers...</div>
                    ) : sortedProviders.map(provider => (
                        <div key={provider.id} className="border border-zinc-800 rounded-xl bg-black/20 p-4">
                            {(() => {
                                const providerAnalytics = analyticsByProvider.get(provider.id);
                                return (
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-white font-medium">{provider.name}</span>
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${provider.enabled
                                            ? 'border-green-500/30 bg-green-500/10 text-green-300'
                                            : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {provider.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-300">
                                            {provider.render_mode}
                                        </span>
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${provider.risk_level === 'high'
                                            ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                            : provider.risk_level === 'medium'
                                                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                                                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                            }`}>
                                            {provider.risk_level} risk
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        <code>{provider.id}</code> - order {provider.sort_order}
                                        {provider.best_for ? ` - ${provider.best_for}` : ''}
                                    </div>
                                    {provider.tags.length > 0 && (
                                        <div className="text-xs text-zinc-600">{provider.tags.join(' - ')}</div>
                                    )}
                                    {providerAnalytics && (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <span className="text-[10px] text-zinc-400 bg-zinc-800/60 border border-zinc-700 px-2 py-1 rounded-full">
                                                Votes {providerAnalytics.manual_votes}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 bg-zinc-800/60 border border-zinc-700 px-2 py-1 rounded-full">
                                                Attempts {providerAnalytics.total_attempts}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 bg-zinc-800/60 border border-zinc-700 px-2 py-1 rounded-full">
                                                Success {providerAnalytics.success_rate}%
                                            </span>
                                            <span className={`text-[10px] border px-2 py-1 rounded-full ${providerAnalytics.automatic_score >= 0
                                                ? 'text-green-300 border-green-500/30 bg-green-500/10'
                                                : 'text-red-300 border-red-500/30 bg-red-500/10'
                                                }`}>
                                                Auto Score {providerAnalytics.automatic_score}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 bg-zinc-800/50 border border-zinc-800 px-2 py-1 rounded-full">
                                                Quick exits {providerAnalytics.quick_exit_count}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 bg-zinc-800/50 border border-zinc-800 px-2 py-1 rounded-full">
                                                No ready {providerAnalytics.no_ready_timeout_count}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 bg-zinc-800/50 border border-zinc-800 px-2 py-1 rounded-full">
                                                Early switches {providerAnalytics.switched_early_count}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 bg-zinc-800/50 border border-zinc-800 px-2 py-1 rounded-full">
                                                Retries {providerAnalytics.retry_attempt_count}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleProvider(provider)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${provider.enabled
                                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                            : 'bg-white text-black hover:bg-zinc-200'
                                            }`}
                                    >
                                        {provider.enabled ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                        onClick={() => handleEdit(provider)}
                                        className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    {!BUILT_IN_PROVIDER_IDS.has(provider.id) && (
                                        <button
                                            onClick={() => handleDelete(provider)}
                                            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            </div>

            <div className={`border border-zinc-800 rounded-2xl overflow-hidden ${compact ? 'bg-zinc-900' : 'bg-zinc-900/20'}`}>
                <div className={`${compact ? 'p-5' : 'p-5 border-b border-zinc-800/80'}`}>
                    <h3 className="font-bold text-white text-base">{editingId ? 'Edit Provider' : 'Add Provider'}</h3>
                    <p className="text-zinc-500 text-sm">
                        Create new providers or tune existing ones without changing code.
                    </p>
                </div>

                <div className={`${compact ? 'p-4' : 'p-5'} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Provider Id</span>
                        <input
                            value={form.id}
                            onChange={(e) => setForm(prev => ({ ...prev, id: e.target.value }))}
                            disabled={Boolean(editingId)}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none disabled:opacity-60"
                            placeholder="example-provider"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Display Name</span>
                        <input
                            value={form.name}
                            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none"
                            placeholder="Server 8"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Mode</span>
                        <select
                            value={form.render_mode}
                            onChange={(e) => setForm(prev => ({ ...prev, render_mode: e.target.value as 'embed' | 'direct' }))}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none"
                        >
                            <option value="embed">Embed</option>
                            <option value="direct">Direct</option>
                        </select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Sort Order</span>
                        <input
                            type="number"
                            value={form.sort_order}
                            onChange={(e) => setForm(prev => ({ ...prev, sort_order: Number(e.target.value) }))}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Risk</span>
                        <select
                            value={form.risk_level}
                            onChange={(e) => setForm(prev => ({ ...prev, risk_level: e.target.value as 'low' | 'medium' | 'high' }))}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Tags</span>
                        <input
                            value={form.tags}
                            onChange={(e) => setForm(prev => ({ ...prev, tags: e.target.value }))}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none"
                            placeholder="Fast, No Ads"
                        />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Best For</span>
                        <input
                            value={form.best_for}
                            onChange={(e) => setForm(prev => ({ ...prev, best_for: e.target.value }))}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none"
                            placeholder="Backup, Best Quality, Direct HLS"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Movie Embed Template</span>
                        <textarea
                            value={form.movie_embed_template}
                            onChange={(e) => setForm(prev => ({ ...prev, movie_embed_template: e.target.value }))}
                            rows={compact ? 2 : 3}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none resize-y"
                            placeholder="https://example.com/movie/{{tmdbId}}"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">TV Embed Template</span>
                        <textarea
                            value={form.tv_embed_template}
                            onChange={(e) => setForm(prev => ({ ...prev, tv_embed_template: e.target.value }))}
                            rows={compact ? 2 : 3}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none resize-y"
                            placeholder="https://example.com/tv/{{tmdbId}}/{{season}}/{{episode}}"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Movie Direct Template</span>
                        <textarea
                            value={form.movie_direct_template}
                            onChange={(e) => setForm(prev => ({ ...prev, movie_direct_template: e.target.value }))}
                            rows={compact ? 2 : 3}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none resize-y"
                            placeholder="https://cdn.example.com/movie/{{tmdbId}}.m3u8"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">TV Direct Template</span>
                        <textarea
                            value={form.tv_direct_template}
                            onChange={(e) => setForm(prev => ({ ...prev, tv_direct_template: e.target.value }))}
                            rows={compact ? 2 : 3}
                            className="w-full bg-black/50 text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-zinc-600 outline-none resize-y"
                            placeholder="https://cdn.example.com/tv/{{tmdbId}}/{{season}}/{{episode}}.m3u8"
                        />
                    </label>
                    <div className="md:col-span-2 flex flex-wrap items-center gap-4 pt-1">
                        <label className="flex items-center gap-3 text-sm text-zinc-300">
                            <input
                                type="checkbox"
                                checked={form.enabled}
                                onChange={(e) => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
                            />
                            Enabled
                        </label>
                        <label className="flex items-center gap-3 text-sm text-zinc-300">
                            <input
                                type="checkbox"
                                checked={form.has_events}
                                onChange={(e) => setForm(prev => ({ ...prev, has_events: e.target.checked }))}
                            />
                            Provider emits events
                        </label>
                    </div>
                    <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                        >
                            <Save size={14} />
                            {editingId ? 'Save Changes' : 'Add Provider'}
                        </button>
                        {editingId && (
                            <button
                                onClick={resetForm}
                                className="px-5 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 transition-colors"
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
