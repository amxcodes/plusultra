import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DirectPlaybackSource } from '../lib/playerProviders';
import { useWatchHistory } from './useWatchHistory';

interface DirectMediaProgressContext {
    storageKey: string;
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    provider: string;
    title?: string;
    posterUrl?: string;
    backdropUrl?: string;
    year?: number;
    genres?: string[];
    voteAverage?: number;
    episodeImage?: string;
}

interface DirectMediaPlayerProps {
    sources: DirectPlaybackSource[];
    title: string;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    onReady?: () => void;
    onError?: () => void;
    badge?: string;
    subtitle?: string;
    progressContext?: DirectMediaProgressContext;
}

const formatTime = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const DirectMediaPlayer: React.FC<DirectMediaPlayerProps> = ({
    sources,
    title,
    videoRef,
    onReady,
    onError,
    badge = 'Direct Playback',
    subtitle,
    progressContext,
}) => {
    const primarySource = sources[0];
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    const resolvedVideoRef = videoRef ?? internalVideoRef;
    const resumeAppliedRef = useRef(false);
    const { updateProgress } = useWatchHistory();
    const [resumeLabel, setResumeLabel] = useState<string | null>(null);

    const savedProgress = useMemo(() => {
        if (!progressContext || typeof window === 'undefined') {
            return null;
        }

        try {
            const raw = window.localStorage.getItem(progressContext.storageKey);
            if (!raw) {
                return null;
            }

            const parsed = JSON.parse(raw);
            return typeof parsed?.time === 'number' ? parsed : null;
        } catch {
            return null;
        }
    }, [progressContext]);

    const persistProgress = (force = false, options?: { skipStorage?: boolean }) => {
        const video = resolvedVideoRef.current;
        if (!video || !progressContext) {
            return;
        }

        const time = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;

        if (!force && time < 5) {
            return;
        }

        if (!options?.skipStorage) {
            try {
                window.localStorage.setItem(progressContext.storageKey, JSON.stringify({
                    time,
                    duration,
                    updatedAt: Date.now(),
                }));
            } catch {
                // Ignore local storage write failures.
            }
        }

        void updateProgress({
            tmdbId: progressContext.tmdbId,
            type: progressContext.mediaType,
            season: progressContext.season,
            episode: progressContext.episode,
            time,
            duration,
            lastUpdated: Date.now(),
            provider: progressContext.provider,
            title: progressContext.title,
            posterPath: progressContext.posterUrl,
            voteAverage: progressContext.voteAverage,
            year: progressContext.year,
            backdropUrl: progressContext.backdropUrl,
            episodeImage: progressContext.episodeImage,
            genres: progressContext.genres,
        });
    };

    useEffect(() => {
        if (!progressContext) {
            return;
        }

        const video = resolvedVideoRef.current;
        if (!video) {
            return;
        }

        const handlePause = () => {
            persistProgress(true);
        };
        const handleEnded = () => {
            try {
                window.localStorage.removeItem(progressContext.storageKey);
            } catch {
                // Ignore local storage cleanup failures.
            }
            persistProgress(true, { skipStorage: true });
            setResumeLabel(null);
        };

        const interval = window.setInterval(() => {
            if (!video.paused && !video.ended) {
                persistProgress();
            }
        }, 10000);

        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        return () => {
            window.clearInterval(interval);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            persistProgress(true);
        };
    }, [progressContext, resolvedVideoRef, updateProgress]);

    useEffect(() => {
        resumeAppliedRef.current = false;
        setResumeLabel(null);
    }, [progressContext?.storageKey, primarySource?.src]);

    if (!primarySource) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-zinc-500 text-sm">
                No direct playback source is available for this provider yet.
            </div>
        );
    }

    return (
        <div className="relative h-full w-full bg-black">
            <video
                ref={resolvedVideoRef}
                className="h-full w-full bg-black object-contain"
                controls
                playsInline
                autoPlay={false}
                preload="metadata"
                title={title}
                controlsList="nodownload"
                onLoadedMetadata={() => {
                    const video = resolvedVideoRef.current;
                    if (
                        video &&
                        progressContext &&
                        savedProgress &&
                        !resumeAppliedRef.current &&
                        savedProgress.time >= 10 &&
                        Number.isFinite(video.duration) &&
                        savedProgress.time < Math.max(video.duration - 15, 15)
                    ) {
                        video.currentTime = savedProgress.time;
                        resumeAppliedRef.current = true;
                        setResumeLabel(`Resumed from ${formatTime(savedProgress.time)}`);
                        window.setTimeout(() => setResumeLabel(null), 2800);
                    }
                    onReady?.();
                }}
                onCanPlay={onReady}
                onError={onError}
            >
                {sources.map(source => (
                    <source key={`${source.src}-${source.type || 'auto'}`} src={source.src} type={source.type} />
                ))}
                Your browser does not support direct video playback.
            </video>

            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200 backdrop-blur-md">
                            {badge}
                        </div>
                        <h2 className="mt-3 max-w-3xl truncate text-lg font-semibold text-white md:text-2xl">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {resumeLabel && (
                        <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium text-zinc-100 backdrop-blur-md">
                            {resumeLabel}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
