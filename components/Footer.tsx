import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full bg-[#0f1014] py-16 px-8 mt-20 border-t border-zinc-900">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">

                {/* Brand & Description */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-bold text-white tracking-tighter">
                        PlusUltra
                    </h2>
                    <p className="text-zinc-500 text-sm leading-relaxed max-w-sm">
                        A premium curation platform for your favorite movies, series, and anime.
                        Experience a seamless discovery interface designed for entertainment enthusiasts.
                    </p>
                </div>

                {/* Links */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Legal</h3>
                    <div className="flex flex-col gap-2 text-sm text-zinc-600">
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Contact</a>
                    </div>
                </div>

                {/* Disclaimer / DMCA */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Disclaimer</h3>
                    <p className="text-zinc-600 text-xs leading-relaxed">
                        This site does not store any files on its server. All contents are provided by non-affiliated third parties.
                        This is a curation website for media discovery.
                    </p>
                    <p className="text-zinc-600 text-xs font-medium">
                        Please contact us before filing any DMCA issues.
                    </p>
                </div>

            </div>

            <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center text-zinc-700 text-xs text-center md:text-left">
                <p>&copy; {new Date().getFullYear()} PlusUltra. All rights reserved.</p>
                <p>Go Beyond.</p>
            </div>
        </footer>
    );
};
