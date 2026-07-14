import React, { useEffect, useState } from 'react';
import { Database, Download, History, Lock, LogOut, Palette, ShieldCheck, SlidersHorizontal, Trash2, Trophy, Zap } from 'lucide-react';
import { getUiPreferences, saveUiPreferences, StudioAccentColor, StudioGlassIntensity, StudioGlassRefraction, StudioPlayerChrome, StudioPlayerControlDensity, StudioPosterDensity, UiPreferences } from '../../../lib/uiPreferences';
import { StudioPageFrame } from '../system/StudioPageFrame';
import { StudioSurface } from '../system/StudioSurface';
import { StudioButton } from '../system/StudioButton';
import { StudioSelectContent, StudioSelectItem, StudioSelectRoot, StudioSelectTrigger, StudioSelectValue, StudioSwitch, StudioTabsContent, StudioTabsList, StudioTabsRoot, StudioTabsTrigger } from '../system/StudioControls';
import { useAuth } from '../../../lib/AuthContext';
import { SocialService } from '../../../lib/social';
import { isWrappedUnlocked } from '../../../lib/wrappedSettings';
import { WrappedPage } from '../../WrappedPage';
import { GuestSecurityCard } from '../../GuestSecurityCard';

interface UserStats {
  historyCount: number;
  playlistsCount: number;
  likedPlaylistsCount: number;
  totalPlaylistViews: number;
}

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
  const { user, signOut, profile } = useAuth();
  const canStream = profile?.can_stream || profile?.role === 'admin';
  const [preferences, setPreferences] = useState<UiPreferences>(() => getUiPreferences());
  const [stats, setStats] = useState<UserStats | null>(null);
  const [wrappedUnlocked, setWrappedUnlocked] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    isWrappedUnlocked().then(setWrappedUnlocked);

    if (!user) return;
    SocialService.getUserStats(user.id)
      .then(setStats)
      .catch(error => console.error('Failed to load Studio settings stats', error));
  }, [user]);

  const updatePreferences = (nextPreferences: Partial<UiPreferences>) => {
    setPreferences(saveUiPreferences(nextPreferences));
  };

  const showStatus = (message: string) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExport = async () => {
    if (!user) return;

    const history = await SocialService.getFullWatchHistory(user.id);
    const exportData = {
      version: 2,
      source: 'Cloud',
      timestamp: new Date().toISOString(),
      userId: user.id,
      watchHistory: history,
      uiPreferences: preferences,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plus-ultra-backup-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showStatus('Data export started.');
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    try {
      await SocialService.clearWatchHistory();
      if (user) setStats(await SocialService.getUserStats(user.id));
      showStatus('Watch history cleared.');
    } catch (error: any) {
      showStatus(error?.message || 'Could not clear watch history.');
    } finally {
      setClearingHistory(false);
    }
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
      {showWrapped && <WrappedPage onClose={() => setShowWrapped(false)} />}

      <StudioTabsRoot defaultValue="appearance" className="space-y-6">
        <StudioTabsList>
          <StudioTabsTrigger value="appearance">Appearance</StudioTabsTrigger>
          <StudioTabsTrigger value="player">Player</StudioTabsTrigger>
          <StudioTabsTrigger value="performance">Performance</StudioTabsTrigger>
          <StudioTabsTrigger value="account">Account</StudioTabsTrigger>
          <StudioTabsTrigger value="wrapped">Wrapped</StudioTabsTrigger>
          <StudioTabsTrigger value="data">Data</StudioTabsTrigger>
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

        <StudioTabsContent value="account">
          <div className="grid gap-5">
            <GuestSecurityCard compact />
            <StudioSurface className="p-5 md:p-7">
              <PreferenceRow
                icon={<ShieldCheck size={18} />}
                title="Streaming access"
                description={canStream ? 'Your account can open player surfaces and continue-watching actions.' : 'An admin has disabled streaming for this account. Studio removes play controls and blocks player access.'}
              >
                <span className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${canStream ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                  {canStream ? 'Allowed' : 'Blocked'}
                </span>
              </PreferenceRow>
            </StudioSurface>
          </div>
        </StudioTabsContent>

        <StudioTabsContent value="wrapped">
          <StudioSurface className="overflow-hidden p-0">
            <button
              type="button"
              onClick={() => wrappedUnlocked && setShowWrapped(true)}
              disabled={!wrappedUnlocked}
              className="group flex w-full flex-col gap-5 p-6 text-left transition-colors hover:bg-white/[0.025] disabled:cursor-default disabled:opacity-65 md:flex-row md:items-center md:justify-between md:p-8"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70">
                  {wrappedUnlocked ? <Trophy size={21} /> : <Lock size={20} />}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/38">
                    {wrappedUnlocked ? 'Ready' : 'Locked'}
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{currentYear} Wrapped</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                    {wrappedUnlocked
                      ? `Your ${currentYear} Wrapped is ready from qualified viewing sessions.`
                      : `Unlocks automatically on Dec 20, ${currentYear}, unless the admin override is enabled.`}
                  </p>
                </div>
              </div>
              <StudioButton variant="glass" disabled={!wrappedUnlocked}>
                Open Wrapped
              </StudioButton>
            </button>
          </StudioSurface>
        </StudioTabsContent>

        <StudioTabsContent value="data">
          <div className="grid gap-5 lg:grid-cols-2">
            <StudioSurface className="p-5 md:p-7">
              <div className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-white/38">
                <History size={15} />
                Account activity
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['History', stats?.historyCount || 0],
                  ['Playlists', stats?.playlistsCount || 0],
                  ['Liked lists', stats?.likedPlaylistsCount || 0],
                  ['Views', stats?.totalPlaylistViews || 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/34">{label}</div>
                    <div className="mt-2 text-3xl font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
            </StudioSurface>

            <StudioSurface className="p-5 md:p-7">
              <div className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-white/38">
                <Database size={15} />
                Privacy and data
              </div>
              <div className="space-y-3">
                <StudioButton variant="glass" onClick={handleExport} className="w-full justify-center">
                  <Download size={16} />
                  Export Data
                </StudioButton>
                <StudioButton variant="subtle" onClick={handleClearHistory} disabled={clearingHistory} className="w-full justify-center text-red-200 hover:text-red-100">
                  <Trash2 size={16} />
                  {clearingHistory ? 'Clearing...' : 'Clear Watch History'}
                </StudioButton>
              </div>
              <p className="mt-5 text-sm leading-6 text-white/44">
                Export includes cloud watch history and Studio preferences. Clearing history also resets active Wrapped session state.
              </p>
            </StudioSurface>
          </div>
        </StudioTabsContent>
      </StudioTabsRoot>

      {statusMessage && (
        <div className="fixed bottom-8 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-bold text-black shadow-2xl">
          {statusMessage}
        </div>
      )}
    </StudioPageFrame>
  );
};
