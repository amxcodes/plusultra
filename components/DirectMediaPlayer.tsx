import React from 'react';
import { DirectPlaybackSource } from '../lib/playerProviders';

interface DirectMediaPlayerProps {
    sources: DirectPlaybackSource[];
    title: string;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    onReady?: () => void;
    onError?: () => void;
}

export const DirectMediaPlayer: React.FC<DirectMediaPlayerProps> = ({ sources, title, videoRef, onReady, onError }) => {
    const primarySource = sources[0];

    if (!primarySource) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-zinc-500 text-sm">
                No direct playback source is available for this provider yet.
            </div>
        );
    }

    return (
        <video
            ref={videoRef}
            className="w-full h-full bg-black"
            controls
            playsInline
            autoPlay={false}
            preload="metadata"
            title={title}
            onLoadedMetadata={onReady}
            onCanPlay={onReady}
            onError={onError}
        >
            {sources.map(source => (
                <source key={`${source.src}-${source.type || 'auto'}`} src={source.src} type={source.type} />
            ))}
            Your browser does not support direct video playback.
        </video>
    );
};
