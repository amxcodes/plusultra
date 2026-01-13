
import React, { useState, useEffect } from 'react';
import { X, Puzzle, ArrowRight, ExternalLink } from 'lucide-react';

interface WatchPartyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/synclify-watch-in-sync-wi/okdfcljlaacbdacenfeaiekllplonlfm';
const FIREFOX_STORE_URL = 'https://addons.mozilla.org/en-US/firefox/addon/synclify/';

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({ isOpen, onClose }) => {
    const [browserType, setBrowserType] = useState<'chrome' | 'firefox' | 'other'>('chrome');

    useEffect(() => {
        // Simple client-side browser detection
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('firefox')) {
            setBrowserType('firefox');
        } else if (ua.includes('chrome') || ua.includes('edge') || ua.includes('brave')) {
            setBrowserType('chrome');
        } else {
            setBrowserType('other');
        }
    }, []);

    const handleInstall = () => {
        const url = browserType === 'firefox' ? FIREFOX_STORE_URL : CHROME_STORE_URL;
        window.open(url, '_blank');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/5">

                {/* Subtle Gradient Glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors z-20 hover:bg-white/10 rounded-full"
                >
                    <X size={18} />
                </button>

                <div className="p-8 text-center relative z-10">
                    {/* Realistic Illustration - Premium Ver. */}
                    <div className="relative w-full max-w-[280px] mx-auto mb-10 select-none group">
                        {/* Browser Window wireframe */}
                        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col aspect-[16/10] relative transition-transform duration-700 ease-out group-hover:scale-[1.02] group-hover:rotate-x-2">

                            {/* Gloss Reflection */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50 pointer-events-none" />

                            {/* Address bar & Toolbar */}
                            <div className="h-10 border-b border-white/5 bg-[#1a1a1a] flex items-center px-3 gap-3">
                                {/* Mac-style Dots - Muted for elegance */}
                                <div className="flex gap-1.5 shrink-0 opacity-80">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57] shadow-inner" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e] shadow-inner" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840] shadow-inner" />
                                </div>

                                {/* Address Input - Glassy */}
                                <div className="flex-1 h-6 bg-black/30 rounded-lg flex items-center px-2 border border-white/5 shadow-inner">
                                    <div className="w-2 h-2 rounded-full bg-zinc-600" />
                                    <div className="mx-2 h-1.5 w-20 bg-zinc-700/50 rounded-full" />
                                </div>

                                {/* Extensions Toolbar - The Focus */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="p-1 rounded-md bg-white/10 text-white shadow ring-1 ring-white/20 transition-all duration-500 group-hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                                        <Puzzle size={14} />
                                    </div>
                                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/5" />
                                </div>
                            </div>

                            {/* Content Body */}
                            <div className="flex-1 bg-[#0f0f0f] flex flex-col p-4 gap-3 relative overflow-hidden">
                                <div className="space-y-3 opacity-20">
                                    <div className="h-2 bg-gradient-to-r from-zinc-500 to-zinc-700 rounded-full w-3/4" />
                                    <div className="h-2 bg-zinc-700 rounded-full w-1/2" />
                                    <div className="h-32 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg w-full mt-4 border border-white/5" />
                                </div>
                            </div>
                        </div>

                        {/* Static Pointer - Refined Shadow & Crispness */}
                        <div className="absolute -top-1 -right-3 z-20 flex flex-col items-center">
                            {/* Cursor */}
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl rotate-[-12deg] translate-y-1 translate-x-1" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))' }}>
                                <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                            {/* Tooltip - Premium Gradient */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-xl border border-blue-400/30 whitespace-nowrap -translate-x-6 mt-1">
                                Add Synclify
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Watch Party</h3>
                    <p className="text-zinc-400 text-sm mb-8 leading-relaxed max-w-xs mx-auto">
                        Install the <span className="text-white font-semibold">Synclify</span> extension to synchronize playback with friends perfectly.
                    </p>

                    {/* Action Button - Glow Effect */}
                    <button
                        onClick={handleInstall}
                        className="w-full py-4 bg-white text-black font-bold rounded-2xl transition-all duration-300
                        hover:bg-zinc-100 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]
                        active:scale-[0.98] flex items-center justify-center gap-2 group/btn"
                    >
                        {browserType === 'firefox' ? 'Get for Firefox' : 'Add to Browser'}
                        <ExternalLink size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>

                    <p className="mt-5 text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                        {browserType === 'firefox' ? 'Mozilla Add-on' : 'Chrome Web Store'}
                    </p>
                </div>
            </div>
        </div>
    );
};
