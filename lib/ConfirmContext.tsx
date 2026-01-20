import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions(opts);
            setResolveRef(() => resolve);
            setIsOpen(true);
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        resolveRef?.(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        resolveRef?.(false);
    };

    const variantStyles = {
        danger: {
            icon: 'text-red-400',
            button: 'bg-red-500 hover:bg-red-600 text-white'
        },
        warning: {
            icon: 'text-yellow-400',
            button: 'bg-yellow-500 hover:bg-yellow-600 text-black'
        },
        default: {
            icon: 'text-blue-400',
            button: 'bg-white hover:bg-zinc-100 text-black'
        }
    };

    const variant = options?.variant || 'default';
    const styles = variantStyles[variant];

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {isOpen && options && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={handleCancel}
                    />

                    {/* Modal */}
                    <div className="relative bg-[#1a1b20] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in duration-200">
                        {/* Header */}
                        <div className="flex items-start gap-4 p-6 pb-0">
                            <div className={`p-3 rounded-xl bg-white/5 ${styles.icon}`}>
                                <AlertTriangle size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-white mb-1">{options.title}</h3>
                                <p className="text-sm text-zinc-400 whitespace-pre-line">{options.message}</p>
                            </div>
                            <button
                                onClick={handleCancel}
                                className="p-1 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 p-6">
                            <button
                                onClick={handleCancel}
                                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
                            >
                                {options.cancelText || 'Cancel'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`flex-1 px-4 py-3 font-bold rounded-xl transition-colors ${styles.button}`}
                            >
                                {options.confirmText || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (context === undefined) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
};
