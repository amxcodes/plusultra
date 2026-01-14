import React from 'react';
import { Play } from 'lucide-react';

export const WrappedCard = () => {
    return (
        <div className="relative bg-[#08080a]/50 border border-white/5 rounded-[28px] p-8 overflow-hidden flex flex-col justify-center items-center text-center hover:bg-[#08080a] transition-colors duration-500 group">
            {/* Very subtle glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-purple-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-purple-500/10 transition-colors duration-700" />

            <div className="relative z-10">
                <span className="inline-block mb-4 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600 group-hover:text-zinc-500 transition-colors">Coming Soon</span>

                <h3 className="text-4xl font-thin text-white mb-1 tracking-tighter group-hover:scale-110 transition-transform duration-700">
                    2026
                </h3>
                <div className="text-lg font-light text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-600 mb-6 tracking-wide">
                    Wrapped
                </div>

                <div className="w-10 h-10 mx-auto rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-500 mb-4 group-hover:scale-110 group-hover:border-purple-500/30 group-hover:text-purple-400 transition-all duration-500">
                    <Play size={14} fill="currentColor" className="ml-0.5 opacity-50 group-hover:opacity-100" />
                </div>

                <p className="text-[10px] text-zinc-600 font-medium tracking-wide">December 1st</p>
            </div>
        </div>
    );
};
