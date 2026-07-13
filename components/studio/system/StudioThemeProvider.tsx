import React, { useEffect, useState } from 'react';
import { getUiPreferences, subscribeToUiPreferences, UiPreferences } from '../../../lib/uiPreferences';
import './StudioTokens.css';

interface StudioThemeProviderProps {
  children: React.ReactNode;
}

export const StudioThemeProvider: React.FC<StudioThemeProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<UiPreferences>(() => getUiPreferences());

  useEffect(() => subscribeToUiPreferences(setPreferences), []);

  return (
    <div
      className="studio-theme min-h-screen"
      data-studio-accent={preferences.accentColor}
      data-studio-glass={preferences.glassIntensity}
      data-studio-refraction={preferences.glassRefraction}
      data-studio-density={preferences.posterDensity}
      data-studio-reduce-motion={preferences.reduceMotion ? 'true' : 'false'}
    >
      {children}
    </div>
  );
};
