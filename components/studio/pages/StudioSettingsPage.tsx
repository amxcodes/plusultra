import React, { useState } from 'react';
import { LogOut, Palette, SlidersHorizontal, Zap } from 'lucide-react';
import { getUiPreferences, saveUiPreferences, StudioAccentColor, StudioGlassIntensity, StudioGlassRefraction, StudioPlayerChrome, StudioPlayerControlDensity, StudioPosterDensity, UiPreferences } from '../../../lib/uiPreferences';
import { StudioPageFrame } from '../system/StudioPageFrame';
import { StudioSurface } from '../system/StudioSurface';
import { StudioButton } from '../system/StudioButton';
import { StudioSelectContent, StudioSelectItem, StudioSelectRoot, StudioSelectTrigger, StudioSelectValue, StudioSwitch, StudioTabsContent, StudioTabsList, StudioTabsRoot, StudioTabsTrigger } from '../system/StudioControls';
import { useAuth } from '../../../lib/AuthContext';

const accentOptions: { value: StudioAccentColor; label: string }[] = [
  { value: 'default', label: 'Purple' },
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Pink' },
  { value: 'cyan', label: 'Cyan' },
];

const glassOptions: { value: StudioGlassIntensity; label: string }[] = [
  { value: 'subtle', label: 'Subtle' },
  { value: 'standard', label: 'Standard' },
  { value: 'strong', label: 'Strong' },
];

const refractionOptions: { value: StudioGlassRefraction; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'deep', label: 'Deep' },
];

const densityOptions: { value: StudioPosterDensity; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

const playerChromeOptions: { value: StudioPlayerChrome; label: string }[] = [
  { value: 'studio', label: 'Studio' },
  { value: 'classic', label: 'Classic' },
];

const playerDensityOptions: { value: StudioPlayerControlDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
];

interface PreferenceRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

const PreferenceRow: React.FC<PreferenceRowProps> = ({ icon, title, description, children }) => (
  <div className="flex flex-col gap-4 border-b border-white/8 py-5 last:border-b-0 md:flex-row md:items-center md:justify-between">
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/7 text-white/70">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-white">{title}</div>
        <p className="mt-1 max-w-xl text-sm leading-6 text-white/48">{description}</p>
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const StudioSettingsPage: React.FC = () => {
  const { signOut } = useAuth();
  const [preferences, setPreferences] = useState<UiPreferences>(() => getUiPreferences());

  const updatePreferences = (nextPreferences: Partial<UiPreferences>) => {
    setPreferences(saveUiPreferences(nextPreferences));
  };

  return (
    <StudioPageFrame
      title="Settings"
      subtitle="Studio controls"
      actions={
        <StudioButton variant="subtle" onClick={signOut}>
          <LogOut size={16} />
          Sign out
        </StudioButton>
      }
    >
      <StudioTabsRoot defaultValue="appearance" className="space-y-6">
        <StudioTabsList>
          <StudioTabsTrigger value="appearance">Appearance</StudioTabsTrigger>
          <StudioTabsTrigger value="player">Player</StudioTabsTrigger>
          <StudioTabsTrigger value="performance">Performance</StudioTabsTrigger>
        </StudioTabsList>

        <StudioTabsContent value="appearance">
          <StudioSurface className="p-5 md:p-7">
            <PreferenceRow
              icon={<Palette size={18} />}
              title="Layout"
              description="Switch between the original Plus Ultra interface and the separate Studio layout."
            >
              <StudioSelectRoot value={preferences.layoutMode} onValueChange={(value) => updatePreferences({ layoutMode: value as UiPreferences['layoutMode'] })}>
                <StudioSelectTrigger>
                  <StudioSelectValue />
                </StudioSelectTrigger>
                <StudioSelectContent>
                  <StudioSelectItem value="classic">Classic</StudioSelectItem>
                  <StudioSelectItem value="studio">Studio</StudioSelectItem>
                </StudioSelectContent>
              </StudioSelectRoot>
            </PreferenceRow>

            <PreferenceRow
              icon={<Palette size={18} />}
              title="Accent color"
              description="Controls focused buttons, active tabs, progress accents, and highlighted pills."
            >
              <StudioSelectRoot value={preferences.accentColor} onValueChange={(value) => updatePreferences({ accentColor: value as StudioAccentColor })}>
                <StudioSelectTrigger>
                  <StudioSelectValue />
                </StudioSelectTrigger>
                <StudioSelectContent>
                  {accentOptions.map(option => (
                    <StudioSelectItem key={option.value} value={option.value}>{option.label}</StudioSelectItem>
                  ))}
                </StudioSelectContent>
              </StudioSelectRoot>
            </PreferenceRow>

            <PreferenceRow
              icon={<SlidersHorizontal size={18} />}
              title="Glass strength"
              description="Keeps glass selective: header, controls, drawers, and important buttons only."
            >
              <StudioSelectRoot value={preferences.glassIntensity} onValueChange={(value) => updatePreferences({ glassIntensity: value as StudioGlassIntensity })}>
                <StudioSelectTrigger>
                  <StudioSelectValue />
                </StudioSelectTrigger>
                <StudioSelectContent>
                  {glassOptions.map(option => (
                    <StudioSelectItem key={option.value} value={option.value}>{option.label}</StudioSelectItem>
                  ))}
                </StudioSelectContent>
              </StudioSelectRoot>
            </PreferenceRow>

            <PreferenceRow
              icon={<SlidersHorizontal size={18} />}
              title="Glass refraction"
              description="Controls the edge-bending effect on Studio glass surfaces like the nav and search bar."
            >
              <StudioSelectRoot value={preferences.glassRefraction} onValueChange={(value) => updatePreferences({ glassRefraction: value as StudioGlassRefraction })}>
                <StudioSelectTrigger>
                  <StudioSelectValue />
                </StudioSelectTrigger>
                <StudioSelectContent>
                  {refractionOptions.map(option => (
                    <StudioSelectItem key={option.value} value={option.value}>{option.label}</StudioSelectItem>
                  ))}
                </StudioSelectContent>
              </StudioSelectRoot>
            </PreferenceRow>

            <PreferenceRow
              icon={<SlidersHorizontal size={18} />}
              title="Poster density"
              description="Compact mode fits more posters per row while keeping the same card component."
            >
              <StudioSelectRoot value={preferences.posterDensity} onValueChange={(value) => updatePreferences({ posterDensity: value as StudioPosterDensity })}>
                <StudioSelectTrigger>
                  <StudioSelectValue />
                </StudioSelectTrigger>
                <StudioSelectContent>
                  {densityOptions.map(option => (
                    <StudioSelectItem key={option.value} value={option.value}>{option.label}</StudioSelectItem>
                  ))}
                </StudioSelectContent>
              </StudioSelectRoot>
            </PreferenceRow>
          </StudioSurface>
        </StudioTabsContent>

        <StudioTabsContent value="player">
          <StudioSurface className="p-5 md:p-7">
            <PreferenceRow
              icon={<SlidersHorizontal size={18} />}
              title="Player chrome"
              description="Controls the unified player overlay. Studio uses smaller glass controls while Classic keeps the older labeled toolbar."
            >
              <StudioSelectRoot value={preferences.playerChrome} onValueChange={(value) => updatePreferences({ playerChrome: value as StudioPlayerChrome })}>
                <StudioSelectTrigger>
                  <StudioSelectValue />
                </StudioSelectTrigger>
                <StudioSelectContent>
                  {playerChromeOptions.map(option => (
                    <StudioSelectItem key={option.value} value={option.value}>{option.label}</StudioSelectItem>
                  ))}
                </StudioSelectContent>
              </StudioSelectRoot>
            </PreferenceRow>

            <PreferenceRow
              icon={<SlidersHorizontal size={18} />}
              title="Control size"
              description="Compact keeps the player closer to Shuttle-style icon controls. Comfortable gives controls more hit area."
            >
              <StudioSelectRoot value={preferences.playerControlDensity} onValueChange={(value) => updatePreferences({ playerControlDensity: value as StudioPlayerControlDensity })}>
                <StudioSelectTrigger>
                  <StudioSelectValue />
                </StudioSelectTrigger>
                <StudioSelectContent>
                  {playerDensityOptions.map(option => (
                    <StudioSelectItem key={option.value} value={option.value}>{option.label}</StudioSelectItem>
                  ))}
                </StudioSelectContent>
              </StudioSelectRoot>
            </PreferenceRow>

            <PreferenceRow
              icon={<SlidersHorizontal size={18} />}
              title="Control labels"
              description="Shows short text labels beside player icons. Keep this off for the cleanest Studio player."
            >
              <StudioSwitch checked={preferences.playerControlLabels} onCheckedChange={(checked) => updatePreferences({ playerControlLabels: checked })} />
            </PreferenceRow>

            <PreferenceRow
              icon={<SlidersHorizontal size={18} />}
              title="Auto-hide controls"
              description="Fades Studio player controls until hover or focus so embeds stay visually clean."
            >
              <StudioSwitch checked={preferences.playerAutoHideControls} onCheckedChange={(checked) => updatePreferences({ playerAutoHideControls: checked })} />
            </PreferenceRow>
          </StudioSurface>
        </StudioTabsContent>

        <StudioTabsContent value="performance">
          <StudioSurface className="p-5 md:p-7">
            <PreferenceRow
              icon={<Zap size={18} />}
              title="Smooth scrolling"
              description="Enables the Studio smooth-scroll layer. It stays off inside drawers, overlays, and the player."
            >
              <StudioSwitch checked={preferences.smoothScroll} onCheckedChange={(checked) => updatePreferences({ smoothScroll: checked })} />
            </PreferenceRow>

            <PreferenceRow
              icon={<Zap size={18} />}
              title="Hero trailer preview"
              description="Autoplays a muted trailer layer in the Studio hero when a trailer is available. Turn it off for a calmer home."
            >
              <StudioSwitch checked={preferences.heroPreviewMotion} onCheckedChange={(checked) => updatePreferences({ heroPreviewMotion: checked })} />
            </PreferenceRow>

            <PreferenceRow
              icon={<Zap size={18} />}
              title="Reduce motion"
              description="Minimizes transitions and disables the smooth-scroll layer."
            >
              <StudioSwitch checked={preferences.reduceMotion} onCheckedChange={(checked) => updatePreferences({ reduceMotion: checked })} />
            </PreferenceRow>
          </StudioSurface>
        </StudioTabsContent>
      </StudioTabsRoot>
    </StudioPageFrame>
  );
};
