
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, ArrowRight } from 'lucide-react';
import { TmdbService } from '../services/tmdb';

// Fallback images in case API fails or key is missing
const FALLBACK_POSTERS = [
    "https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHjgAmHp7Pm.jpg",
    "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
    "https://image.tmdb.org/t/p/w500/fiVW06jE7z9YnO4trhaMEdclSiC.jpg",
    "https://image.tmdb.org/t/p/w500/u3YQJctMzFN2wV4ALbszSxuv0Tm.jpg",
    "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
    "https://image.tmdb.org/t/p/w500/pFlaoHTZeyNkG83vxsAJiGzfSsa.jpg",
    "https://image.tmdb.org/t/p/w500/r7e1EZuSl92rp5kmYFkL9T6Yt3d.jpg",
    "https://image.tmdb.org/t/p/w500/z1p34vh7dEOnLDmyCrlUVLuoDzd.jpg",
    "https://image.tmdb.org/t/p/w500/wKiOkZTN9lUUUNZLmtnwubZYONg.jpg",
    "https://image.tmdb.org/t/p/w500/wigZBAmNrIhxp2FNGOROUAeHvdh.jpg",
    "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Gr7en8srPaTTS8.jpg",
    "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg"
];

export const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [posters, setPosters] = useState<string[]>([]);

    useEffect(() => {
        const fetchPosters = async () => {
            try {
                const trending = await TmdbService.getTrending();
                if (trending && trending.length > 0) {
                    const images = trending
                        .filter(m => m.imageUrl && !m.imageUrl.includes('placeholder'))
                        .map(m => m.imageUrl);
                    setPosters(images.slice(0, 18));
                } else {
                    setPosters(FALLBACK_POSTERS);
                }
            } catch (e) {
                setPosters(FALLBACK_POSTERS);
            }
        };
        fetchPosters();
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-black text-white relative overflow-hidden">

            {/* Dim Lit Movie Poster Collage Background */}
            <div className="absolute inset-0 z-0">
                {/* Poster Grid - INCREASED OPACITY to 60% */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 opacity-60 grayscale animate-in fade-in duration-1000">
                    {(posters.length > 0 ? posters : FALLBACK_POSTERS).map((src, index) => (
                        <div key={index} className="aspect-[2/3] overflow-hidden rounded-sm relative">
                            <img
                                src={src}
                                alt=""
                                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
                            />
                        </div>
                    ))}
                </div>

                {/* Vignette Overlay for "Dim Lit" effect - LIGHTER: from black/80 via transparent to black/90 */}
                {/* Removed the solid bg-black/40 layer */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-black/90 pointer-events-none" />
            </div>

            <div className="w-full max-w-[360px] flex flex-col relative z-10 p-8 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl">
                {/* Minimal Header */}
                <div className="mb-10 text-center">
                    <h1 className="text-xl font-medium tracking-tight mb-2 text-white">
                        {isLogin ? 'Welcome back' : 'Create account'}
                    </h1>
                    <p className="text-xs text-zinc-400">
                        {isLogin ? 'Enter your details to access.' : 'Join for free unlimited streaming.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-md text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-black/50 border border-zinc-700 rounded-md py-2.5 px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:bg-black/80 transition-all font-medium"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-black/50 border border-zinc-700 rounded-md py-2.5 px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:bg-black/80 transition-all font-medium"
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-6 bg-white text-black text-sm font-bold h-10 rounded-md hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : (
                            <>
                                <span>{isLogin ? 'Continue' : 'Get Started'}</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/10 flex justify-center items-center gap-2">
                    <span className="text-xs text-zinc-500">
                        {isLogin ? "New user?" : "Already have an account?"}
                    </span>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-xs text-white hover:text-zinc-300 transition-colors font-medium hover:underline"
                    >
                        {isLogin ? 'Sign up' : 'Log in'}
                    </button>
                </div>
            </div>
        </div>
    );
};
