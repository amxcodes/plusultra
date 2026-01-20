import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 3000, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const bgColors = {
        success: 'bg-green-500/10 border-green-500/20 text-green-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
    };

    const icons = {
        success: <CheckCircle className="w-5 h-5" />,
        error: <AlertCircle className="w-5 h-5" />,
        info: <Info className="w-5 h-5" />,
        warning: <AlertTriangle className="w-5 h-5" />
    };

    return (
        <div className={`
            flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg 
            animate-in slide-in-from-top-2 fade-in duration-300
            ${bgColors[type]}
            min-w-[300px] max-w-md pointer-events-auto
        `}>
            <div className="shrink-0">
                {icons[type]}
            </div>
            <p className="text-sm font-medium flex-1">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
