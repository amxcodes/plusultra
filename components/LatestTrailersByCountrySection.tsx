import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CountryTrailerGroup } from '../services/latestTrailers';
import { LatestTrailerCard } from './LatestTrailerCard';

interface LatestTrailersByCountrySectionProps {
    groups: CountryTrailerGroup[];
}

export const LatestTrailersByCountrySection: React.FC<LatestTrailersByCountrySectionProps> = ({
    groups,
}) => {
    const availableGroups = useMemo(() => groups.filter(group => group.trailers.length > 0), [groups]);
    const [activeCountry, setActiveCountry] = useState('');
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!activeCountry && availableGroups[0]) {
            setActiveCountry(availableGroups[0].country.code);
        }
    }, [activeCountry, availableGroups]);

    const activeGroup = availableGroups.find(group => group.country.code === activeCountry) || availableGroups[0];

    const handleScroll = () => {
        if (!rowRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
        setShowLeft(scrollLeft > 0);
        setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    };

    useEffect(() => {
        if (activeGroup) {
            window.requestAnimationFrame(handleScroll);
        }
    }, [activeCountry, activeGroup?.trailers?.length]);

    if (availableGroups.length === 0 || !activeGroup) return null;

    const scroll = (direction: 'left' | 'right') => {
        const node = rowRef.current;
        if (!node) return;
        const { scrollLeft, clientWidth } = node;
        node.scrollTo({
            left: direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth,
            behavior: 'smooth',
        });
    };

    return (
        <section className="relative z-10 group my-6 pl-4 md:my-8 md:pl-12">
            <div className="mb-4 flex flex-col gap-3 pr-4 md:flex-row md:items-end md:justify-between md:pr-12">
                <div className="pl-2">
                    <h2 className="text-lg font-semibold text-white/90 transition-colors group-hover:text-white md:text-2xl">
                        Latest Trailers
                    </h2>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto px-2 pb-1 scrollbar-hide md:max-w-[50vw]">
                    {availableGroups.map(group => {
                        const isActive = activeGroup.country.code === group.country.code;
                        return (
                            <button
                                key={group.country.code}
                                type="button"
                                onClick={() => {
                                    setActiveCountry(group.country.code);
                                    rowRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                                }}
                                className={`shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition md:text-[11px] ${
                                    isActive
                                        ? 'border-white/75 bg-white text-black'
                                        : 'border-white/10 bg-white/[0.035] text-white/50 hover:border-white/25 hover:text-white'
                                }`}
                            >
                                {group.country.code}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="relative">
                <div
                    className={`absolute top-0 bottom-0 left-0 z-[60] hidden w-12 items-center justify-center transition-opacity duration-300 md:flex ${showLeft ? 'opacity-0 group-hover:opacity-100' : 'pointer-events-none opacity-0'}`}
                >
                    <button
                        type="button"
                        onClick={() => scroll('left')}
                        className="rounded-full border border-white/20 bg-black/60 p-2 text-white shadow-xl backdrop-blur-md transition hover:scale-110 hover:bg-white hover:text-black active:scale-95"
                    >
                        <ChevronLeft size={24} />
                    </button>
                </div>

                <div
                    ref={rowRef}
                    onScroll={handleScroll}
                    className="flex items-stretch gap-3 overflow-x-auto px-2 py-4 scrollbar-hide md:gap-6 md:px-4 md:py-6"
                    style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                >
                    {activeGroup.trailers.map(movie => (
                        <LatestTrailerCard
                            key={`${movie.countryCode}-${movie.videoId}`}
                            movie={movie}
                        />
                    ))}
                </div>

                <div
                    className={`absolute top-0 bottom-0 right-0 z-[60] hidden w-12 items-center justify-center transition-opacity duration-300 md:flex ${showRight ? 'opacity-0 group-hover:opacity-100' : 'pointer-events-none opacity-0'}`}
                >
                    <button
                        type="button"
                        onClick={() => scroll('right')}
                        className="rounded-full border border-white/20 bg-black/60 p-2 text-white shadow-xl backdrop-blur-md transition hover:scale-110 hover:bg-white hover:text-black active:scale-95"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </section>
    );
};
