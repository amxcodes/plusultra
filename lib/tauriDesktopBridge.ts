import type { OfflineDownloadEntry } from '../types';

interface TauriDownloadEntry {
  id: string;
  title: string;
  sourceUrl: string;
  filePath: string;
  status: string;
  createdAt: number;
  completedAt?: number | null;
  bytesReceived?: number | null;
  totalBytes?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
  message?: string | null;
  tmdbId?: number | null;
  mediaType?: 'movie' | 'tv' | string | null;
  season?: number | null;
  episode?: number | null;
  providerId?: string | null;
  providerName?: string | null;
  imageUrl?: string | null;
  backdropUrl?: string | null;
  description?: string | null;
  year?: number | null;
  genre?: string[] | null;
}

interface TauriUpdateHandle {
  currentVersion: string;
  version: string;
  download: (onEvent?: (event: TauriDownloadEvent) => void) => Promise<void>;
  install: () => Promise<void>;
}

type TauriDownloadEvent = (
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' }
);

interface DesktopUpdateState {
  status: string;
  currentVersion: string;
  latestVersion: string | null;
  message: string | null;
  downloadProgress: number | null;
}

const isTauriRuntime = () => (
  typeof window !== 'undefined'
  && '__TAURI_INTERNALS__' in window
);

const getUpdaterTarget = () => {
  if (typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent)) {
    return 'windows-x86_64-nsis';
  }

  return undefined;
};

const statusMap: Record<string, OfflineDownloadEntry['status']> = {
  complete: 'completed',
  completed: 'completed',
  downloading: 'downloading',
  failed: 'failed',
  cancelled: 'cancelled',
};

const toOfflineEntry = (entry: TauriDownloadEntry): OfflineDownloadEntry => ({
  id: entry.id,
  tmdbId: Number(entry.tmdbId || 0),
  title: entry.title,
  mediaType: entry.mediaType === 'tv' ? 'tv' : 'movie',
  season: entry.season || undefined,
  episode: entry.episode || undefined,
  year: entry.year || undefined,
  imageUrl: entry.imageUrl || '',
  backdropUrl: entry.backdropUrl || undefined,
  description: entry.description || undefined,
  genre: entry.genre || undefined,
  fileName: entry.filePath.split(/[\\/]/).pop() || entry.id,
  filePath: entry.filePath,
  fileSize: entry.fileSize || undefined,
  mimeType: entry.mimeType || undefined,
  sourceUrl: entry.sourceUrl,
  status: statusMap[entry.status] || 'failed',
  providerId: entry.providerId || undefined,
  providerName: entry.providerName || undefined,
  createdAt: new Date(entry.createdAt || Date.now()).toISOString(),
  completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString() : undefined,
  bytesReceived: entry.bytesReceived || undefined,
  totalBytes: entry.totalBytes || undefined,
  message: entry.message || undefined,
});

export const installTauriDesktopBridge = async () => {
  if (!isTauriRuntime() || window.desktop) {
    return;
  }

  const [{ invoke, convertFileSrc }, { getVersion }, { listen }, { openUrl }, updater, process] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/app'),
    import('@tauri-apps/api/event'),
    import('@tauri-apps/plugin-opener'),
    import('@tauri-apps/plugin-updater'),
    import('@tauri-apps/plugin-process'),
  ]);

  const emptyUnsubscribe = () => {};
  const updateListeners = new Set<(payload: DesktopUpdateState) => void>();
  let pendingUpdate: TauriUpdateHandle | null = null;
  let pendingUpdateDownloaded = false;
  const appVersion = await getVersion().catch(() => 'tauri');
  let updateState: DesktopUpdateState = {
    status: 'idle',
    currentVersion: appVersion,
    latestVersion: null,
    message: null,
    downloadProgress: null,
  };

  const setUpdateState = (patch: Partial<DesktopUpdateState>) => {
    updateState = { ...updateState, ...patch };
    updateListeners.forEach((listener) => listener(updateState));
    return updateState;
  };

  const ensureUpdate = async () => {
    if (pendingUpdate) {
      return pendingUpdate;
    }

    setUpdateState({ status: 'checking', message: null, downloadProgress: null });
    const nextUpdate = await updater.check({ target: getUpdaterTarget() });
    pendingUpdate = nextUpdate as TauriUpdateHandle | null;
    pendingUpdateDownloaded = false;

    if (!pendingUpdate) {
      setUpdateState({
        status: 'idle',
        currentVersion: appVersion,
        latestVersion: null,
        message: 'You are on the latest version.',
        downloadProgress: null,
      });
      return null;
    }

    setUpdateState({
      status: 'available',
      currentVersion: pendingUpdate.currentVersion || appVersion,
      latestVersion: pendingUpdate.version,
      message: `Update ${pendingUpdate.version} is available.`,
      downloadProgress: null,
    });
    return pendingUpdate;
  };

  const unsupported = async <T>(message: string, fallback: T): Promise<T> => {
    console.info(`[TauriDesktopBridge] ${message}`);
    return fallback;
  };

  window.desktop = {
    isDesktop: true,
    showNotification: (payload) => unsupported(`Notification skipped: ${payload.title}`, { ok: false, message: 'Tauri notifications are not wired yet.' }),
    startMediaCapture: async (sessionInfo) => {
      try {
        return await invoke<{ ok: boolean; captureKey?: string }>('tauri_start_media_capture', { sessionInfo });
      } catch {
        return { ok: false };
      }
    },
    stopMediaCapture: async (captureKey) => {
      try {
        return await invoke<{ ok: boolean }>('tauri_stop_media_capture', { captureKey });
      } catch {
        return { ok: false };
      }
    },
    getCapturedMedia: async (captureKey) => {
      try {
        return await invoke<DesktopCapturedMedia[]>('tauri_get_captured_media', { captureKey });
      } catch {
        return [];
      }
    },
    discoverDownloadSources: async (url) => {
      try {
        return await invoke<Array<{ url: string; sourceType: 'mp4' | 'webm' | 'mkv' | 'm3u8' | 'mpd' }>>('tauri_discover_offline_sources', { sourceUrl: url });
      } catch {
        return [];
      }
    },
    probePlaybackSource: async ({ url }) => {
      try {
        const probe = await invoke<{
          finalUrl: string;
          contentType?: string | null;
          contentLength?: number | null;
          sourceType: 'mp4' | 'webm' | 'mkv' | 'm3u8' | 'mpd';
        }>('tauri_probe_offline_download', { sourceUrl: url });
        return {
          ok: true,
          finalUrl: probe.finalUrl,
          contentType: probe.contentType || undefined,
          contentLength: probe.contentLength || null,
          sourceType: probe.sourceType,
        };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
    startTurnstileCheck: () => unsupported('Turnstile native check is not wired yet.', { ok: false, message: 'Tauri Turnstile check is not wired yet.' }),
    openExternal: (targetUrl) => openUrl(targetUrl),
    enterCompactPlayer: async () => {
      try {
        await invoke('tauri_enter_compact_player');
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
    restorePlayerWindow: async () => {
      try {
        await invoke('tauri_restore_player_window');
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
    downloadOfflineMedia: async (payload) => {
      try {
        const entry = await invoke<TauriDownloadEntry>('tauri_start_offline_download', {
          request: {
            sourceUrl: payload.sourceUrl,
            title: payload.title,
            tmdbId: payload.tmdbId,
            mediaType: payload.mediaType,
            season: payload.season,
            episode: payload.episode,
            providerId: payload.providerId,
            providerName: payload.providerName,
            imageUrl: payload.imageUrl,
            backdropUrl: payload.backdropUrl,
            description: payload.description,
            year: payload.year,
            genre: payload.genre,
          },
        });

        return { ok: true, entry: toOfflineEntry(entry) };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
    getOfflineDownloads: async () => {
      const entries = await invoke<TauriDownloadEntry[]>('tauri_list_offline_downloads');
      return entries.map(toOfflineEntry);
    },
    removeOfflineDownload: async (downloadId) => {
      try {
        await invoke<TauriDownloadEntry[]>('tauri_remove_offline_download', { id: downloadId });
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
    getOfflinePlaybackUrl: async (downloadId) => {
      const entries = await invoke<TauriDownloadEntry[]>('tauri_list_offline_downloads');
      const entry = entries.find((item) => item.id === downloadId);
      return entry
        ? { ok: true, url: convertFileSrc(entry.filePath) }
        : { ok: false, message: 'Download not found.' };
    },
    checkForUpdates: async () => {
      try {
        await ensureUpdate();
        return { ok: true, ...updateState };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, ...setUpdateState({ status: 'error', message }) };
      }
    },
    downloadUpdate: async () => {
      try {
        const update = await ensureUpdate();
        if (!update) {
          return { ok: true, ...updateState };
        }

        let downloaded = 0;
        let total = 0;
        setUpdateState({ status: 'downloading', message: 'Downloading update...', downloadProgress: 0 });
        await update.download((event) => {
          if (event.event === 'Started') {
            total = event.data.contentLength || 0;
          } else if (event.event === 'Progress') {
            downloaded += event.data.chunkLength;
            setUpdateState({
              status: 'downloading',
              downloadProgress: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null,
            });
          } else if (event.event === 'Finished') {
            pendingUpdateDownloaded = true;
            setUpdateState({ status: 'downloaded', message: 'Update downloaded. Ready to install.', downloadProgress: 100 });
          }
        });

        return { ok: true, ...updateState };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, ...setUpdateState({ status: 'error', message }) };
      }
    },
    installUpdate: async () => {
      try {
        const update = await ensureUpdate();
        if (!update) {
          return { ok: true, ...updateState };
        }

        if (!pendingUpdateDownloaded) {
          const result = await window.desktop?.downloadUpdate();
          if (!result?.ok) {
            return { ok: false, ...updateState };
          }
        }

        setUpdateState({ status: 'installing', message: 'Installing update...', downloadProgress: 100 });
        await update.install();
        setUpdateState({ status: 'installed', message: 'Update installed. Relaunching...', downloadProgress: 100 });
        setTimeout(() => {
          void process.relaunch();
        }, 500);
        return { ok: true, ...updateState };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, ...setUpdateState({ status: 'error', message }) };
      }
    },
    getUpdateState: async () => updateState,
    onCapturedMedia: (listener) => {
      let disposed = false;
      const unlistenPromise = listen<DesktopCapturedMedia>('tauri-captured-media', (event) => {
        if (!disposed) listener(event.payload);
      });
      return () => {
        disposed = true;
        void unlistenPromise.then((unlisten) => unlisten());
      };
    },
    onCapturedMediaReset: (listener) => {
      let disposed = false;
      const unlistenPromise = listen<{ captureKey: string }>('tauri-captured-media-reset', (event) => {
        if (!disposed) listener(event.payload);
      });
      return () => {
        disposed = true;
        void unlistenPromise.then((unlisten) => unlisten());
      };
    },
    onTurnstileToken: () => emptyUnsubscribe,
    onUpdateState: (listener) => {
      updateListeners.add(listener);
      listener(updateState);
      return () => {
        updateListeners.delete(listener);
      };
    },
    onOfflineDownloadsChanged: (listener) => {
      let disposed = false;
      const unlistenPromise = listen<TauriDownloadEntry[]>('tauri-offline-downloads-changed', (event) => {
        if (!disposed) {
          listener(event.payload.map(toOfflineEntry));
        }
      });

      return () => {
        disposed = true;
        void unlistenPromise.then((unlisten) => unlisten());
      };
    },
  };
};
