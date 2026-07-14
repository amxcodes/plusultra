import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Radio, ShieldCheck, Trophy, RefreshCw, X, Play, Tv, Shield, Car, Info } from 'lucide-react';
import { StudioPageFrame } from '../system/StudioPageFrame';
import { StudioSurface } from '../system/StudioSurface';
import { StudioSkeleton } from '../system/StudioSkeleton';
import { StudioBadge } from '../system/StudioBadge';

interface LiveStream {
  name: string;
  category: string;
  league: string;
  stream_key: string;
  match_timestamp: number;
  embed_url: string;
  thumbnail_url: string;
}

const DEFAULT_CATEGORIES = ['All', 'Soccer', 'Basketball', 'Hockey', 'Combat', 'Baseball', 'Football', 'Racing', 'Tennis', 'Cricket'];

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'all': return <Tv size={14} />;
    case 'combat': return <Shield size={14} />;
    case 'racing': return <Car size={14} />;
    default: return <Trophy size={14} />;
  }
};

const getFallbackThumbnail = (category: string) => {
  const cat = category.toLowerCase();
  switch (cat) {
    case 'soccer':
      return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80';
    case 'basketball':
      return 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80';
    case 'hockey':
      return 'https://images.unsplash.com/photo-1515703407324-2f753eed8045?w=600&auto=format&fit=crop&q=80';
    case 'combat':
      return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80';
    case 'baseball':
      return 'https://images.unsplash.com/photo-1471295268307-f17543f02213?w=600&auto=format&fit=crop&q=80';
    case 'football':
      return 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=600&auto=format&fit=crop&q=80';
    case 'racing':
      return 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80';
    case 'tennis':
      return 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&auto=format&fit=crop&q=80';
    case 'cricket':
      return 'https://images.unsplash.com/photo-1531415080290-bc9854503f37?w=600&auto=format&fit=crop&q=80';
    default:
      return 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=80';
  }
};

interface StudioSportsPageProps {
  canStream?: boolean;
}

export const StudioSportsPage: React.FC<StudioSportsPageProps> = ({ canStream = true }) => {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPlayerChrome, setShowPlayerChrome] = useState(true);

  // Fetch categories on mount
  useEffect(() => {
    let active = true;
    setLoadingCategories(true);
    fetch('https://streamfree.top/api/v1/categories')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data && Array.isArray(data.categories)) {
          const capitalized = data.categories.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1));
          setCategories(['All', ...capitalized]);
        }
      })
      .catch((err) => {
        console.error('Failed to load categories, using defaults', err);
      })
      .finally(() => {
        if (active) setLoadingCategories(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch streams helper
  const fetchStreams = useCallback(async (cat: string, isRefreshAction = false) => {
    if (isRefreshAction) {
      setIsRefreshing(true);
    } else {
      setLoadingStreams(true);
    }
    setError(null);

    try {
      const url = cat === 'All'
        ? 'https://streamfree.top/api/v1/streams'
        : `https://streamfree.top/api/v1/streams?category=${cat.toLowerCase()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load streams: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedStreams: LiveStream[] = data.streams || [];
      setStreams(fetchedStreams);

      // If the active stream is no longer live, close it
      if (activeStream) {
        const stillLive = fetchedStreams.some((s) => s.stream_key === activeStream.stream_key);
        if (!stillLive) {
          // Double check if the single stream API returns 404
          try {
            const checkUrl = `https://streamfree.top/api/v1/streams/${activeStream.stream_key}`;
            const checkRes = await fetch(checkUrl);
            if (checkRes.status === 404) {
              setActiveStream(null);
            }
          } catch {
            // Keep active if API check fails to prevent accidental closes
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading streams:', err);
      setError(err.message || 'Failed to connect to the stream catalog API.');
    } finally {
      setLoadingStreams(false);
      setIsRefreshing(false);
    }
  }, [activeStream]);

  // Fetch streams on category change
  useEffect(() => {
    fetchStreams(selectedCategory);
  }, [selectedCategory, fetchStreams]);

  // Polling every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStreams(selectedCategory, true);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCategory, fetchStreams]);

  useEffect(() => {
    if (!activeStream) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setShowPlayerChrome(true);

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeStream]);

  useEffect(() => {
    if (!activeStream || !showPlayerChrome) return;
    const timer = window.setTimeout(() => setShowPlayerChrome(false), 2600);
    return () => window.clearTimeout(timer);
  }, [activeStream, showPlayerChrome]);

  useEffect(() => {
    if (!canStream && activeStream) setActiveStream(null);
  }, [activeStream, canStream]);

  const handleManualRefresh = () => {
    fetchStreams(selectedCategory, true);
  };

  const revealPlayerChrome = () => {
    if (activeStream) setShowPlayerChrome(true);
  };

  const otherStreams = streams.filter((s) => s.stream_key !== activeStream?.stream_key);
  const categoryLabel = selectedCategory === 'All' ? 'all sports' : selectedCategory.toLowerCase();

  return (
    <StudioPageFrame
      title="Sports"
      subtitle="Live desk"
      actions={(
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          title="Refresh catalogue"
          className="inline-flex h-9 items-center gap-2 rounded-full px-2 text-sm font-medium text-white/55 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      )}
    >
      <section className="mb-8 space-y-5">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--studio-subtle)]">
              <Radio size={14} className="text-red-400" />
              Live coverage
            </div>
            <p className="text-sm leading-6 text-[var(--studio-muted)]">
            Browse live events in Studio mode. Selecting a feed opens a dedicated player layer, separate from the page.
            </p>
            {!canStream && (
              <p className="mt-3 inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200">
                Streaming is disabled for this account.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/44">
            <span className="rounded-full bg-white/[0.045] px-3 py-1.5">{streams.length} events</span>
            <span className="rounded-full bg-white/[0.045] px-3 py-1.5">{categoryLabel}</span>
          </div>
        </div>

        <div className="studio-row-mask -mx-4 overflow-x-auto px-4 pb-1 studio-scrollbar md:-mx-8 md:px-8" aria-label="Sports categories">
          <div className="flex min-w-max items-center gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedCategory(item)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors duration-200 ${
                  selectedCategory === item
                    ? 'border-white/18 bg-white/[0.105] text-white'
                    : 'border-white/[0.07] bg-white/[0.025] text-white/48 hover:border-white/14 hover:bg-white/[0.055] hover:text-white/78'
                }`}
              >
                {getCategoryIcon(item)}
                <span>{item}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeStream && (
        <div className="fixed inset-0 z-[160] bg-black animate-in fade-in duration-300">
          <div
            className="studio-sports-player group relative h-full w-full bg-black"
            onMouseMove={revealPlayerChrome}
            onPointerDown={revealPlayerChrome}
            onFocusCapture={revealPlayerChrome}
          >
            <iframe
              src={activeStream.embed_url}
              className="absolute inset-0 h-full w-full border-none"
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              frameBorder="0"
              title={`Sports player - ${activeStream.name}`}
            />

            <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 transition-opacity duration-300 md:p-5 ${showPlayerChrome ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="studio-control-glass min-w-0 max-w-[calc(100vw-5.5rem)] rounded-full px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="truncate text-sm font-black text-white">{activeStream.name}</span>
                  <span className="hidden text-xs font-bold text-white/38 sm:inline">{activeStream.league || activeStream.category}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStream(null)}
                className="pointer-events-auto studio-button-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/78 transition-colors hover:text-white"
                aria-label="Close sports player"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 transition-opacity duration-300 md:p-5 ${showPlayerChrome ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StudioBadge tone="accent">{activeStream.category.toUpperCase()}</StudioBadge>
                    {activeStream.league && <StudioBadge tone="neutral">{activeStream.league}</StudioBadge>}
                  </div>
                  <h2 className="line-clamp-2 max-w-4xl text-2xl font-black leading-tight text-white md:text-4xl">{activeStream.name}</h2>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-white/42">
                    <Info size={12} /> Player is detached from the sports page. Close to return to browsing.
                  </p>
                </div>
                {otherStreams.length > 0 && (
                  <div className="pointer-events-auto hidden w-[min(360px,34vw)] shrink-0 lg:block">
                    <div className="studio-sports-sidepanel max-h-[48vh] overflow-hidden rounded-[var(--studio-radius-lg)] p-3">
                      <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                        <Radio size={12} className="text-emerald-300" />
                        Other live events
                      </div>
                      <div className="studio-scrollbar max-h-[calc(48vh-2.5rem)] space-y-1.5 overflow-y-auto pr-1">
                        {otherStreams.slice(0, 8).map((stream) => (
                          <button
                            key={stream.stream_key}
                            type="button"
                            onClick={() => setActiveStream(stream)}
                            className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
                          >
                            <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                              <img
                                src={stream.thumbnail_url}
                                alt={stream.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = getFallbackThumbnail(stream.category);
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-white/82 group-hover:text-white">{stream.name}</div>
                              <div className="mt-0.5 truncate text-[10px] text-white/38">{stream.league || stream.category}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div>
        {activeStream && streams.length > 1 && (
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Trophy size={18} className="text-white/60" /> All Live Events
          </h2>
        )}

        {loadingStreams ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <StudioSkeleton className="aspect-video w-full rounded-[var(--studio-radius-md)]" />
                <StudioSkeleton className="h-4 w-3/4 rounded" />
                <StudioSkeleton className="h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <StudioSurface className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center" glass>
            <div className="mb-4 text-red-400">
              <Info size={36} />
            </div>
            <h3 className="text-lg font-bold text-white">Connection Error</h3>
            <p className="mt-2 max-w-sm text-sm text-white/50">{error}</p>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-sm font-medium text-white/70 transition-colors hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
            >
              <RefreshCw size={14} /> Retry Connection
            </button>
          </StudioSurface>
        ) : streams.length === 0 ? (
          <StudioSurface className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/75">
              <Trophy size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-white">
              No {categoryLabel} feeds are live
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/50">
              There are currently no active live streams for this category. We automatically check every 30 seconds.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleManualRefresh}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-sm font-medium text-white/70 transition-colors hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
              >
                <RefreshCw size={15} /> Check Again
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-sm font-medium text-white/70 transition-colors hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
              >
                <CalendarDays size={16} /> Schedule
              </button>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs text-white/32">
              <ShieldCheck size={13} /> Streams open only from verified rights holders.
            </div>
          </StudioSurface>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {streams.map((stream) => {
              const isActive = activeStream?.stream_key === stream.stream_key;
              return (
                <button
                  key={stream.stream_key}
                  type="button"
                  onClick={() => {
                    if (canStream) setActiveStream(stream);
                  }}
                  disabled={!canStream}
                  className="group relative flex min-w-0 flex-col text-left disabled:cursor-default"
                >
                  <div className={`relative aspect-video w-full overflow-hidden rounded-[var(--studio-radius-md)] border bg-white/[0.045] shadow-[0_14px_38px_rgba(0,0,0,0.34)] transition-[transform,filter,box-shadow,border-color] duration-300 ${
                    isActive
                      ? 'border-white/18 brightness-110'
                      : 'border-white/[0.055] group-hover:scale-[1.018] group-hover:border-white/14 group-hover:brightness-110 group-hover:shadow-[0_18px_48px_rgba(0,0,0,0.5)]'
                  }`}>
                    <img
                      src={stream.thumbnail_url}
                      alt={stream.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = getFallbackThumbnail(stream.category);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-80" />
                    
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/46 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 backdrop-blur-md">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                      </span>
                      Live
                    </div>

                    <div className="absolute right-3 top-3 rounded-full border border-white/[0.08] bg-black/36 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-md">
                      {stream.category}
                    </div>

                    {canStream && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/34 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <div className="studio-control-glass flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-105 hover:bg-white/[0.16]">
                          <Play size={18} fill="currentColor" className="ml-0.5" />
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <div className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-white/46">{stream.league || 'Event'}</div>
                      <div className="mt-1 line-clamp-2 min-h-[2.25rem] text-sm font-semibold leading-[1.15] text-white">
                        {stream.name}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex min-w-0 items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white/70">{stream.name}</div>
                      <div className="mt-0.5 truncate text-[11px] text-white/30">{stream.league || 'Live event'}</div>
                    </div>
                    {canStream && (
                      <span className="shrink-0 text-xs font-medium text-white/42 transition-colors group-hover:text-white/72">
                        {isActive ? 'Watching' : 'Open'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </StudioPageFrame>
  );
};
