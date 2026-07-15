import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import { PlayerProviderRecord } from '../lib/playerProviders';

interface ProviderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (record: PlayerProviderRecord, isEditing: boolean) => Promise<void>;
    initialData?: PlayerProviderRecord | null;
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

export const ProviderFormModal: React.FC<ProviderFormModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    initialData,
    compact = false
}) => {
    const [form, setForm] = useState<ProviderFormState>(createEmptyForm());
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isEditing = Boolean(initialData);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setForm(recordToForm(initialData));
            } else {
                setForm(createEmptyForm());
            }
            setErrorMsg(null);
            setSaving(false);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSaveClick = async () => {
        setErrorMsg(null);
        const normalizedId = form.id.trim().toLowerCase().replace(/\s+/g, '-');
        if (!normalizedId || !form.name.trim()) {
            setErrorMsg('Provider id and name are required');
            return;
        }

        const record = formToRecord({
            ...form,
            id: normalizedId,
        });

        if (record.render_mode === 'embed' && !record.movie_embed_template && !record.tv_embed_template) {
            setErrorMsg('Add at least one embed template for an embed provider');
            return;
        }

        if (record.render_mode === 'direct' && !record.movie_direct_template && !record.tv_direct_template) {
            setErrorMsg('Add at least one direct template for a direct provider');
            return;
        }

        setSaving(true);
        try {
            await onSave(record, isEditing);
            onClose();
        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message || 'Failed to save provider');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 backdrop-blur-xl animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="studio-glass flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/12 shadow-[0_30px_120px_rgba(0,0,0,0.72)] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/24 px-5 py-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Routing source</div>
                        <h3 className="mt-1 text-xl font-black tracking-tight text-white">{isEditing ? 'Edit Provider' : 'Add Provider'}</h3>
                        <p className="mt-1 text-xs text-white/45">
                            Create new providers or tune existing ones without changing code.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full border border-white/10 bg-white/[0.06] p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {errorMsg && (
                        <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm font-semibold text-red-200">
                            {errorMsg}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Provider Id</span>
                            <input
                                value={form.id}
                                onChange={(e) => setForm(prev => ({ ...prev, id: e.target.value }))}
                                disabled={isEditing}
                                className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="example-provider"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Display Name</span>
                            <input
                                value={form.name}
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                                placeholder="Server 8"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Mode</span>
                            <select
                                value={form.render_mode}
                                onChange={(e) => setForm(prev => ({ ...prev, render_mode: e.target.value as 'embed' | 'direct' }))}
                                className="w-full appearance-none rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                            >
                                <option value="embed">Embed</option>
                                <option value="direct">Direct</option>
                            </select>
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Sort Order</span>
                            <input
                                type="number"
                                value={form.sort_order}
                                onChange={(e) => setForm(prev => ({ ...prev, sort_order: Number(e.target.value) }))}
                                className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Risk</span>
                            <select
                                value={form.risk_level}
                                onChange={(e) => setForm(prev => ({ ...prev, risk_level: e.target.value as 'low' | 'medium' | 'high' }))}
                                className="w-full appearance-none rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Tags</span>
                            <input
                                value={form.tags}
                                onChange={(e) => setForm(prev => ({ ...prev, tags: e.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                                placeholder="Fast, No Ads"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Best For</span>
                            <input
                                value={form.best_for}
                                onChange={(e) => setForm(prev => ({ ...prev, best_for: e.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                                placeholder="Backup, Best Quality, Direct HLS"
                            />
                        </label>
                        
                        <div className="md:col-span-2 mt-2 mb-1">
                            <div className="h-px w-full bg-white/5" />
                        </div>

                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Movie Embed Template</span>
                            <textarea
                                value={form.movie_embed_template}
                                onChange={(e) => setForm(prev => ({ ...prev, movie_embed_template: e.target.value }))}
                                rows={compact ? 2 : 2}
                                className="w-full resize-y rounded-2xl border border-white/10 bg-black/28 px-4 py-3 font-mono text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                                placeholder="https://example.com/movie/{{tmdbId}}"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">TV Embed Template</span>
                            <textarea
                                value={form.tv_embed_template}
                                onChange={(e) => setForm(prev => ({ ...prev, tv_embed_template: e.target.value }))}
                                rows={compact ? 2 : 2}
                                className="w-full resize-y rounded-2xl border border-white/10 bg-black/28 px-4 py-3 font-mono text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                                placeholder="https://example.com/tv/{{tmdbId}}/{{season}}/{{episode}}"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Movie Direct Template</span>
                            <textarea
                                value={form.movie_direct_template}
                                onChange={(e) => setForm(prev => ({ ...prev, movie_direct_template: e.target.value }))}
                                rows={compact ? 2 : 2}
                                className="w-full resize-y rounded-2xl border border-white/10 bg-black/28 px-4 py-3 font-mono text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                                placeholder="https://cdn.example.com/movie/{{tmdbId}}.m3u8"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">TV Direct Template</span>
                            <textarea
                                value={form.tv_direct_template}
                                onChange={(e) => setForm(prev => ({ ...prev, tv_direct_template: e.target.value }))}
                                rows={compact ? 2 : 2}
                                className="w-full resize-y rounded-2xl border border-white/10 bg-black/28 px-4 py-3 font-mono text-sm text-white outline-none transition-all focus:border-white/25 focus:ring-2 focus:ring-white/10"
                                placeholder="https://cdn.example.com/tv/{{tmdbId}}/{{season}}/{{episode}}.m3u8"
                            />
                        </label>
                        
                        <div className="md:col-span-2 flex flex-wrap items-center gap-6 pt-2 pb-2">
                            <label className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer group">
                                <div className="relative flex items-center justify-center w-5 h-5 rounded border border-zinc-700 bg-[#09090b] group-hover:border-zinc-500 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={form.enabled}
                                        onChange={(e) => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                        className="sr-only"
                                    />
                                    {form.enabled && <div className="w-3 h-3 bg-white rounded-sm" />}
                                </div>
                                <span className="font-medium">Enabled</span>
                            </label>
                            <label className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer group">
                                <div className="relative flex items-center justify-center w-5 h-5 rounded border border-zinc-700 bg-[#09090b] group-hover:border-zinc-500 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={form.has_events}
                                        onChange={(e) => setForm(prev => ({ ...prev, has_events: e.target.checked }))}
                                        className="sr-only"
                                    />
                                    {form.has_events && <div className="w-3 h-3 bg-white rounded-sm" />}
                                </div>
                                <span className="font-medium">Provider emits events</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 bg-black/24 p-4">
                    <button
                        onClick={onClose}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/62 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveClick}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-black text-black shadow-lg shadow-white/5 transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {isEditing ? 'Save Changes' : 'Add Provider'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
