import React, { useState } from 'react';
import { X, Sparkles, Send } from 'lucide-react';
import { getMovieRecommendation } from '../services/geminiService';

interface AiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ isOpen, onClose }) => {
  const [mood, setMood] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAsk = async () => {
    if (!mood.trim()) return;
    setLoading(true);
    setResult(null);
    const recommendation = await getMovieRecommendation(mood);
    setResult(recommendation);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1b21] w-full max-w-md rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-purple-900/20 to-transparent">
          <div className="flex items-center gap-2">
            <Sparkles className="text-purple-400" size={20} />
            <h3 className="font-semibold text-white">Gemini Assistant</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {!result ? (
            <div className="text-center py-6">
              <p className="text-gray-300 mb-4">What kind of movie are you in the mood for today?</p>
              <div className="relative">
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g., 'Something sad set in space'..."
                  className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors pr-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                />
                <button 
                  onClick={handleAsk}
                  disabled={loading || !mood}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          ) : (
             <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
               <h4 className="text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">Gemini Recommends</h4>
               <p className="text-gray-200 leading-relaxed text-sm">{result}</p>
               <button 
                onClick={() => { setResult(null); setMood(''); }}
                className="mt-4 text-xs text-gray-400 hover:text-white underline"
               >
                 Ask another
               </button>
             </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};