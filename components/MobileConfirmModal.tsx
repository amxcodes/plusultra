
import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

interface MobileConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    icon?: React.ElementType;
}

export const MobileConfirmModal: React.FC<MobileConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDestructive = false,
    icon: Icon = AlertTriangle
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 bg-[#18181b] rounded-t-3xl p-6 pb-safe animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-6" />

                <div className="flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                        }`}>
                        <Icon size={32} />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-zinc-400 text-sm mb-8 leading-relaxed max-w-xs">{description}</p>

                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`w-full h-14 rounded-xl font-bold text-base flex items-center justify-center transition-transform active:scale-[0.98] ${isDestructive
                                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20'
                                    : 'bg-white text-black hover:bg-zinc-200'
                                }`}
                        >
                            {confirmLabel}
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full h-14 rounded-xl font-medium text-zinc-400 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-900 hover:text-white transition-colors"
                        >
                            {cancelLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
