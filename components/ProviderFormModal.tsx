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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="w-full max-w-2xl bg-[#121214] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] md:max-h-[85vh] m-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-zinc-900/50">
                    <div>
                        <h3 className="font-bold text-white text-lg">{isEditing ? 'Edit Provider' : 'Add Provider'}</h3>
                        <p className="text-zinc-400 text-xs mt-1">
                            Create new providers or tune existing ones without changing code.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-black/40 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    {errorMsg && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                placeholder="example-provider"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Display Name</span>
                            <input
                                value={form.name}
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all"
                                placeholder="Server 8"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Mode</span>
                            <select
                                value={form.render_mode}
                                onChange={(e) => setForm(prev => ({ ...prev, render_mode: e.target.value as 'embed' | 'direct' }))}
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all appearance-none"
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
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Risk</span>
                            <select
                                value={form.risk_level}
                                onChange={(e) => setForm(prev => ({ ...prev, risk_level: e.target.value as 'low' | 'medium' | 'high' }))}
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all appearance-none"
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
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all"
                                placeholder="Fast, No Ads"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Best For</span>
                            <input
                                value={form.best_for}
                                onChange={(e) => setForm(prev => ({ ...prev, best_for: e.target.value }))}
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all"
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
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none resize-y transition-all font-mono"
                                placeholder="https://example.com/movie/{{tmdbId}}"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">TV Embed Template</span>
                            <textarea
                                value={form.tv_embed_template}
                                onChange={(e) => setForm(prev => ({ ...prev, tv_embed_template: e.target.value }))}
                                rows={compact ? 2 : 2}
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none resize-y transition-all font-mono"
                                placeholder="https://example.com/tv/{{tmdbId}}/{{season}}/{{episode}}"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Movie Direct Template</span>
                            <textarea
                                value={form.movie_direct_template}
                                onChange={(e) => setForm(prev => ({ ...prev, movie_direct_template: e.target.value }))}
                                rows={compact ? 2 : 2}
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none resize-y transition-all font-mono"
                                placeholder="https://cdn.example.com/movie/{{tmdbId}}.m3u8"
                            />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">TV Direct Template</span>
                            <textarea
                                value={form.tv_direct_template}
                                onChange={(e) => setForm(prev => ({ ...prev, tv_direct_template: e.target.value }))}
                                rows={compact ? 2 : 2}
                                className="w-full bg-[#09090b] text-sm text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none resize-y transition-all font-mono"
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
                <div className="p-4 bg-[#18181b] border-t border-white/5 shrink-0 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-zinc-400 text-sm font-medium hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveClick}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5 active:scale-[0.98]"
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
