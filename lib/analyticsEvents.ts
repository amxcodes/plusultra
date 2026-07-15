import { supabase } from './supabase';

export type AnalyticsMediaType = 'movie' | 'tv' | 'sports';

export interface AnalyticsEventInput {
  eventName: string;
  eventCategory?: string;
  sessionId?: string;
  attemptId?: string;
  tmdbId?: string | number;
  mediaType?: AnalyticsMediaType;
  season?: number;
  episode?: number;
  providerId?: string;
  pagePath?: string;
  payload?: Record<string, unknown>;
  flush?: boolean;
}

interface BufferedAnalyticsEvent {
  eventId: string;
  eventName: string;
  eventCategory: string;
  sessionId?: string;
  attemptId?: string;
  tmdbId?: string;
  mediaType?: AnalyticsMediaType;
  season?: number;
  episode?: number;
  providerId?: string;
  pagePath?: string;
  clientContext: Record<string, unknown>;
  payload: Record<string, unknown>;
  occurredAt: string;
}

const STORAGE_KEY = 'plusultra_pending_analytics_events';
const MAX_BATCH_SIZE = 24;
const MAX_QUEUE_SIZE = 120;
const FLUSH_DELAY_MS = 9000;

let queue: BufferedAnalyticsEvent[] = [];
let flushTimer: number | null = null;
let flushInFlight = false;
let pendingLoaded = false;

const makeEventId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getClientContext = (): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};

  return {
    appSurface: window.desktop?.isDesktop ? 'tauri' : 'web',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    visibility: typeof document === 'undefined' ? 'visible' : document.visibilityState,
    focused: typeof document === 'undefined' ? true : document.hasFocus(),
    userAgent: navigator.userAgent.slice(0, 220),
  };
};

const loadPending = () => {
  if (pendingLoaded || typeof localStorage === 'undefined') return;
  pendingLoaded = true;

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) {
      queue = stored.slice(-MAX_QUEUE_SIZE);
    }
  } catch {
    queue = [];
  }
};

const persistPending = () => {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Storage can be unavailable or full. Analytics should never break UX.
  }
};

const scheduleFlush = () => {
  if (typeof window === 'undefined' || flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushAnalyticsEvents();
  }, FLUSH_DELAY_MS);
};

export const flushAnalyticsEvents = async () => {
  loadPending();
  if (flushInFlight || queue.length === 0) return;

  flushInFlight = true;
  const batch = queue.slice(0, MAX_BATCH_SIZE);

  try {
    const { error } = await supabase.rpc('record_analytics_events', {
      p_events: batch,
    });

    if (!error) {
      queue = queue.slice(batch.length);
      persistPending();
    }
  } catch {
    // Keep the queue for the next flush.
  } finally {
    flushInFlight = false;
    if (queue.length > 0) scheduleFlush();
  }
};

export const trackAnalyticsEvent = (input: AnalyticsEventInput) => {
  loadPending();

  const event: BufferedAnalyticsEvent = {
    eventId: makeEventId(),
    eventName: input.eventName,
    eventCategory: input.eventCategory || 'general',
    sessionId: input.sessionId,
    attemptId: input.attemptId,
    tmdbId: input.tmdbId === undefined ? undefined : String(input.tmdbId),
    mediaType: input.mediaType,
    season: input.season,
    episode: input.episode,
    providerId: input.providerId,
    pagePath: input.pagePath || (typeof window !== 'undefined' ? window.location.pathname : undefined),
    clientContext: getClientContext(),
    payload: input.payload || {},
    occurredAt: new Date().toISOString(),
  };

  queue.push(event);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(-MAX_QUEUE_SIZE);
  }
  persistPending();

  if (input.flush || queue.length >= MAX_BATCH_SIZE) {
    void flushAnalyticsEvents();
  } else {
    scheduleFlush();
  }
};

export const installAnalyticsFlushHandlers = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const flush = () => {
    void flushAnalyticsEvents();
  };

  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
};
