import React from 'react';
import { Play } from 'lucide-react';
import type { LatestTrailerItem } from '../services/latestTrailers';

interface LatestTrailerCardProps {
    movie: LatestTrailerItem;
}

export const LatestTrailerCard: React.FC<LatestTrailerCardProps> = ({ movie }) => {
    const image = movie.thumbnailUrl;

    return (
        <a
            href={movie.url}
            target="_blank"
            rel="noreferrer"
            className="relative group/card block min-w-[240px] w-[240px] cursor-pointer md:min-w-[320px] md:w-[320px]"
        >
            <div className="relative aspect-video overflow-hidden rounded-[24px] border border-white/5 bg-[#0a0a0a] transition-all duration-500 transform-gpu group-hover/card:-translate-y-2 group-hover/card:border-white/10 group-hover/card:shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                <img
                    src={image}
                    alt={movie.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-105"
                    loading="lazy"
                />

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 opacity-0 backdrop-blur-[2px] transition-all duration-500 group-hover/card:opacity-100">
                    <div className="flex h-12 w-12 translate-y-4 items-center justify-center rounded-[18px] border border-white/5 bg-gradient-to-tr from-white/20 to-white/5 text-white opacity-0 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-xl transition-all delay-75 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:translate-y-0 group-hover/card:opacity-100">
                        <Play className="ml-0.5 fill-white" size={20} strokeWidth={1.5} />
                    </div>
                    <span className="translate-y-3 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/80 opacity-0 backdrop-blur-xl transition-all delay-100 duration-500 group-hover/card:translate-y-0 group-hover/card:opacity-100">
                        YouTube trailer
                    </span>
                </div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-90" />

                <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
                    {movie.countryCode}
                </div>

                <div className="pointer-events-none absolute bottom-3 left-3 right-3">
                    <h3 className="line-clamp-2 text-[13px] font-black leading-tight text-white drop-shadow-md md:text-[14px]">
                        {movie.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/48">
                        {movie.sourceName || movie.channelTitle}
                    </p>
                </div>
            </div>
        </a>
    );
};
