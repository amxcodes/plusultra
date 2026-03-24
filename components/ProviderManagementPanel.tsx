import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, GripVertical } from 'lucide-react';
import { ProviderFormModal } from './ProviderFormModal';
import { SocialService } from '../lib/social';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
import { getDefaultProviderRecords, PlayerProviderRecord } from '../lib/playerProviders';
import type { AdminProviderAnalytics } from '../services/AdminService';

interface ProviderManagementPanelProps {
    compact?: boolean;
}

const BUILT_IN_PROVIDER_IDS = new Set(getDefaultProviderRecords().map(provider => provider.id));

export const ProviderManagementPanel: React.FC<ProviderManagementPanelProps> = ({ compact = false }) => {
    const { success, error, info } = useToast();
    const confirm = useConfirm();
    const [providers, setProviders] = useState<PlayerProviderRecord[]>([]);
    const [analytics, setAnalytics] = useState<AdminProviderAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<PlayerProviderRecord | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

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

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setTimeout(() => {
           if (e.target instanceof HTMLElement) {
             e.target.style.opacity = '0.5';
           }
        }, 0);
    };

    const handleDragEnter = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        setDragOverId(id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            setDragOverId(null);
            return;
        }

        const currentSorted = [...sortedProviders];
        const draggedIndex = currentSorted.findIndex(p => p.id === draggedId);
        const targetIndex = currentSorted.findIndex(p => p.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const updated = [...currentSorted];
        const [movedItem] = updated.splice(draggedIndex, 1);
        updated.splice(targetIndex, 0, movedItem);

        const reorderedProviders = updated.map((p, index) => ({
            ...p,
            sort_order: index + 1
        }));

        setProviders(reorderedProviders);
        setDraggedId(null);
        setDragOverId(null);

        try {
            await SocialService.upsertProviders(reorderedProviders);
            success('Provider ordering saved');
            await loadProviders();
        } catch (err) {
            console.error(err);
            error('Failed to save ordering');
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.target instanceof HTMLElement) {
            e.target.style.opacity = '1';
        }
        setDraggedId(null);
        setDragOverId(null);
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

    const handleAddClick = () => {
        setEditingProvider(null);
        setIsModalOpen(true);
    };

    const handleEdit = (provider: PlayerProviderRecord) => {
        setEditingProvider(provider);
        setIsModalOpen(true);
    };

    const handleSaveProvider = async (record: PlayerProviderRecord, isEditing: boolean) => {
        await SocialService.upsertProvider(record);
        success(isEditing ? 'Provider updated' : 'Provider added');
        await loadProviders();
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
            if (editingProvider?.id === provider.id) {
                setIsModalOpen(false);
                setEditingProvider(null);
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
                        onClick={handleAddClick}
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
                        <div 
                            key={provider.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, provider.id)}
                            onDragEnter={(e) => handleDragEnter(e, provider.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, provider.id)}
                            onDragEnd={handleDragEnd}
                            className={`border ${dragOverId === provider.id ? 'border-zinc-500 bg-white/5' : 'border-zinc-800 bg-black/20'} rounded-xl p-4 transition-all flex items-center gap-4 ${draggedId === provider.id ? 'opacity-50' : 'opacity-100'} shadow-sm`}
                        >
                            <div className="cursor-grab text-zinc-600 hover:text-white shrink-0 active:cursor-grabbing flex flex-col items-center p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <GripVertical size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
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
                        </div>
                    ))}
                </div>
            </div>

            <ProviderFormModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProvider}
                initialData={editingProvider}
                compact={compact}
            />
        </div>
    );
};
