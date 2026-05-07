export type ActivityMode =
  | 'browse'
  | 'search'
  | 'detail'
  | 'watch'
  | 'chat'
  | 'admin'
  | 'download'
  | 'library'
  | 'playlist'
  | 'social'
  | 'stats'
  | 'requests'
  | 'settings'
  | 'unknown';

export interface TrackingContext {
  isVisible: boolean;
  isFocused: boolean;
  hasRecentInteraction: boolean;
  idleSeconds: number;
  activityMode: ActivityMode;
}

const RECENT_INTERACTION_WINDOW_MS = 90_000;
const DEFAULT_ACTIVITY_MODE: ActivityMode = 'browse';

let lastInteractionAt = typeof Date !== 'undefined' ? Date.now() : 0;
let listenersAttached = false;

const markInteraction = () => {
  lastInteractionAt = Date.now();
};

const attachListeners = () => {
  if (listenersAttached || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  listenersAttached = true;
  const listenerOptions: AddEventListenerOptions = { passive: true };

  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((eventName) => {
    window.addEventListener(eventName, markInteraction, listenerOptions);
  });

  window.addEventListener('focus', markInteraction, listenerOptions);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      markInteraction();
    }
  }, listenerOptions);
};

attachListeners();

const coerceActivityMode = (value: string | undefined): ActivityMode => {
  if (!value) return DEFAULT_ACTIVITY_MODE;

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'browse':
    case 'search':
    case 'detail':
    case 'watch':
    case 'chat':
    case 'admin':
    case 'download':
    case 'library':
    case 'playlist':
    case 'social':
    case 'stats':
    case 'requests':
    case 'settings':
      return normalized;
    default:
      return 'unknown';
  }
};

export const setActivityMode = (mode: ActivityMode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.amxActivityMode = mode;
};

export const getActivityMode = (): ActivityMode => {
  if (typeof document === 'undefined') return DEFAULT_ACTIVITY_MODE;
  return coerceActivityMode(document.documentElement.dataset.amxActivityMode);
};

export const getTrackingContext = (): TrackingContext => {
  const now = Date.now();
  const idleSeconds = Math.max(0, Math.floor((now - lastInteractionAt) / 1000));

  return {
    isVisible: typeof document === 'undefined' ? true : document.visibilityState === 'visible',
    isFocused: typeof document === 'undefined' ? true : document.hasFocus(),
    hasRecentInteraction: now - lastInteractionAt <= RECENT_INTERACTION_WINDOW_MS,
    idleSeconds,
    activityMode: getActivityMode(),
  };
};

export const shouldTrackActively = (context: TrackingContext) => (
  context.isVisible && context.isFocused && context.hasRecentInteraction
);
