export type StudioLayoutMode = 'classic' | 'studio';
export type StudioAccentColor = 'default' | 'purple' | 'blue' | 'red' | 'green' | 'orange' | 'pink' | 'cyan';
export type StudioGlassIntensity = 'subtle' | 'standard' | 'strong';
export type StudioGlassRefraction = 'calm' | 'balanced' | 'deep';
export type StudioPosterDensity = 'comfortable' | 'compact';
export type StudioPlayerChrome = 'studio' | 'classic';
export type StudioPlayerControlDensity = 'compact' | 'comfortable';

export interface UiPreferences {
  layoutMode: StudioLayoutMode;
  accentColor: StudioAccentColor;
  glassIntensity: StudioGlassIntensity;
  glassRefraction: StudioGlassRefraction;
  smoothScroll: boolean;
  heroPreviewMotion: boolean;
  posterDensity: StudioPosterDensity;
  playerChrome: StudioPlayerChrome;
  playerControlDensity: StudioPlayerControlDensity;
  playerControlLabels: boolean;
  playerAutoHideControls: boolean;
  reduceMotion: boolean;
}

export const UI_PREFERENCES_KEY = 'PLUS_ULTRA_UI_PREFERENCES';
export const UI_PREFERENCES_CHANGED_EVENT = 'plus-ultra-ui-preferences-changed';

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  layoutMode: 'studio',
  accentColor: 'default',
  glassIntensity: 'standard',
  glassRefraction: 'balanced',
  smoothScroll: true,
  heroPreviewMotion: false,
  posterDensity: 'comfortable',
  playerChrome: 'studio',
  playerControlDensity: 'compact',
  playerControlLabels: false,
  playerAutoHideControls: true,
  reduceMotion: false,
};

const hasWindow = () => typeof window !== 'undefined';

const normalizePreferences = (value: Partial<UiPreferences> | null | undefined): UiPreferences => ({
  ...DEFAULT_UI_PREFERENCES,
  ...(value || {}),
});

export const getUiPreferences = (): UiPreferences => {
  if (!hasWindow()) return DEFAULT_UI_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_KEY);
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
};

export const saveUiPreferences = (preferences: Partial<UiPreferences>) => {
  if (!hasWindow()) return normalizePreferences(preferences);

  const next = normalizePreferences({
    ...getUiPreferences(),
    ...preferences,
  });

  window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(UI_PREFERENCES_CHANGED_EVENT, { detail: next }));
  return next;
};

export const subscribeToUiPreferences = (callback: (preferences: UiPreferences) => void) => {
  if (!hasWindow()) return () => undefined;

  const handleChange = (event: Event) => {
    callback((event as CustomEvent<UiPreferences>).detail || getUiPreferences());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === UI_PREFERENCES_KEY) {
      callback(getUiPreferences());
    }
  };

  window.addEventListener(UI_PREFERENCES_CHANGED_EVENT, handleChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(UI_PREFERENCES_CHANGED_EVENT, handleChange);
    window.removeEventListener('storage', handleStorage);
  };
};
