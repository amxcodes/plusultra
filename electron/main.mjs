import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const desktopIconPath = path.join(rootDir, 'public', 'pwa-512x512.png');
const DESKTOP_RENDERER_PORT = 57986;
const OFFLINE_LIBRARY_DIR = path.join(app.getPath('userData'), 'offline-library');
const OFFLINE_LIBRARY_CATALOG_PATH = path.join(OFFLINE_LIBRARY_DIR, 'catalog.json');
const MAX_CAPTURED_MEDIA = 100;
const CAPTURE_COOLDOWN_MS = 500;
const CAPTURE_TTL_MS = 1000 * 60 * 20;
const DESKTOP_USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let mainWindow = null;
let capturedMedia = [];
let activeCaptureSession = null;
let activeCaptureStartedAt = 0;
let localServer = null;
let localServerUrl = null;
let turnstileRequests = new Map();
let desktopUpdateState = {
    status: 'idle',
    currentVersion: app.getVersion(),
    latestVersion: null,
    message: null,
    downloadProgress: null,
};
let offlineDownloadCatalog = [];
let pendingOfflineDownloads = new Map();
let supersededOfflineDownloadIds = new Set();

const VIDEO_EXTENSION_MIME_TYPES = {
    '.m4v': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};
const MIME_TYPE_VIDEO_EXTENSIONS = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'video/x-m4v': '.m4v',
    'video/x-matroska': '.mkv',
};

const sendDesktopUpdateState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:update-state', desktopUpdateState);
    }
};

const sendOfflineDownloadsChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:offline-downloads-changed', offlineDownloadCatalog);
    }
};

const getOfflinePlaybackUrlForId = (downloadId) => (
    localServerUrl ? `${localServerUrl}/desktop-offline-media/${encodeURIComponent(downloadId)}` : null
);

const getOfflineBaseName = (entry) => (
    entry.mediaType === 'tv' && entry.season && entry.episode
        ? `${entry.title} S${String(entry.season).padStart(2, '0')}E${String(entry.episode).padStart(2, '0')}`
        : entry.title
);

const sanitizeOfflineName = (value) => String(value || 'download')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'download';

const getExtensionFromUrl = (targetUrl) => {
    try {
        const pathname = new URL(targetUrl).pathname;
        const extension = path.extname(pathname).toLowerCase();
        return extension || '.mp4';
    } catch {
        return '.mp4';
    }
};

const getExtensionFromMimeType = (mimeType) => {
    if (!mimeType) {
        return null;
    }

    const normalizedMimeType = String(mimeType).split(';')[0].trim().toLowerCase();
    return MIME_TYPE_VIDEO_EXTENSIONS[normalizedMimeType] || null;
};

const isLikelyPlayableVideoResponse = ({ contentType, contentDisposition, contentLength, contentRange }) => {
    const normalizedContentType = String(contentType || '').split(';')[0].trim().toLowerCase();
    const normalizedDisposition = String(contentDisposition || '').toLowerCase();
    const hasRangeResponse = Boolean(contentRange);

    const looksVideoLike = (
        normalizedContentType.startsWith('video/') ||
        normalizedContentType === 'application/octet-stream' ||
        normalizedDisposition.includes('attachment')
    );

    if (!looksVideoLike) {
        return false;
    }

    if (!hasRangeResponse && typeof contentLength === 'number' && Number.isFinite(contentLength) && contentLength > 0 && contentLength < 1024 * 1024 * 5) {
        return false;
    }

    return true;
};

const inspectOfflineDownloadSource = async (targetUrl) => {
    const attemptFetch = async (method, extraHeaders = {}) => {
        const response = await session.defaultSession.fetch(targetUrl, {
            method,
            redirect: 'follow',
            headers: extraHeaders,
        });

        const contentType = response.headers.get('content-type') || '';
        const contentDisposition = response.headers.get('content-disposition') || '';
        const contentLengthHeader = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range') || '';
        const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null;

        return {
            ok: response.ok,
            finalUrl: response.url || targetUrl,
            contentType,
            contentDisposition,
            contentRange,
            contentLength: Number.isFinite(contentLength) ? contentLength : null,
        };
    };

    let inspection = null;
    try {
        inspection = await attemptFetch('HEAD');
    } catch {
        inspection = null;
    }

    if (!inspection || !inspection.ok || !isLikelyPlayableVideoResponse(inspection)) {
        try {
            inspection = await attemptFetch('GET', { Range: 'bytes=0-0' });
        } catch {
            inspection = null;
        }
    }

    if (!inspection || !inspection.ok || !isLikelyPlayableVideoResponse(inspection)) {
        return {
            ok: false,
            message: 'This captured link does not look like a stable downloadable video file. Try another detected stream link after playback settles.',
        };
    }

    const resolvedExtension = (
        getExtensionFromMimeType(inspection.contentType) ||
        getExtensionFromUrl(inspection.finalUrl) ||
        getExtensionFromUrl(targetUrl) ||
        '.mp4'
    );

    return {
        ok: true,
        finalUrl: inspection.finalUrl || targetUrl,
        resolvedExtension,
        contentType: inspection.contentType || VIDEO_EXTENSION_MIME_TYPES[resolvedExtension] || 'application/octet-stream',
        contentLength: inspection.contentLength,
    };
};

const saveOfflineCatalog = async () => {
    await mkdir(OFFLINE_LIBRARY_DIR, { recursive: true });
    await writeFile(OFFLINE_LIBRARY_CATALOG_PATH, JSON.stringify(offlineDownloadCatalog, null, 2), 'utf8');
};

const loadOfflineCatalog = async () => {
    try {
        await mkdir(OFFLINE_LIBRARY_DIR, { recursive: true });
        const raw = await readFile(OFFLINE_LIBRARY_CATALOG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        offlineDownloadCatalog = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        offlineDownloadCatalog = [];
    }
};

const upsertOfflineDownloadEntry = async (entry) => {
    const existingIndex = offlineDownloadCatalog.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) {
        offlineDownloadCatalog[existingIndex] = {
            ...offlineDownloadCatalog[existingIndex],
            ...entry,
        };
    } else {
        offlineDownloadCatalog = [entry, ...offlineDownloadCatalog];
    }

    await saveOfflineCatalog();
    sendOfflineDownloadsChanged();
};

const isSameOfflineTitle = (entry, target) => (
    entry.tmdbId === target.tmdbId &&
    entry.mediaType === target.mediaType &&
    (entry.season || null) === (target.season || null) &&
    (entry.episode || null) === (target.episode || null)
);

const removeOfflineFileIfUnshared = async (entry) => {
    if (!entry.filePath || !existsSync(entry.filePath)) {
        return;
    }

    const isSharedFile = offlineDownloadCatalog.some((item) => (
        item.id !== entry.id &&
        item.filePath === entry.filePath
    ));

    if (!isSharedFile) {
        await rm(entry.filePath, { force: true }).catch(() => undefined);
    }
};

const purgeOfflineDownloadEntries = async (entries) => {
    if (!entries.length) {
        return;
    }

    for (const entry of entries) {
        supersededOfflineDownloadIds.add(entry.id);
        const pendingDownload = pendingOfflineDownloads.get(entry.id);
        if (pendingDownload?.item && !pendingDownload.item.isDestroyed?.()) {
            pendingDownload.item.cancel();
        }
        pendingOfflineDownloads.delete(entry.id);
        await removeOfflineFileIfUnshared(entry);
    }

    const removedIds = new Set(entries.map((entry) => entry.id));
    offlineDownloadCatalog = offlineDownloadCatalog.filter((entry) => !removedIds.has(entry.id));
    await saveOfflineCatalog();
    sendOfflineDownloadsChanged();
};

const removeOfflineDownloadEntry = async (downloadId) => {
    offlineDownloadCatalog = offlineDownloadCatalog.filter((entry) => entry.id !== downloadId);
    await saveOfflineCatalog();
    sendOfflineDownloadsChanged();
};

const mapDesktopUpdateErrorMessage = (error) => {
    const rawMessage = error instanceof Error ? error.message : String(error || 'Update check failed.');
    const normalized = rawMessage.toLowerCase();

    if (
        normalized.includes('please ensure a production release exists') ||
        normalized.includes('unable to find latest version on github')
    ) {
        return 'No published latest desktop release is available yet. Ask an admin to publish the latest release.';
    }

    if (
        normalized.includes('releases.atom') ||
        normalized.includes('/releases/latest') ||
        normalized.includes('cannot parse releases feed') ||
        normalized.includes('authentication token is correct') ||
        normalized.includes('httperror: 404') ||
        normalized.includes('httperror: 406')
    ) {
        return 'Updates are unavailable right now. Ask an admin for the latest desktop build.';
    }

    return rawMessage;
};

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const isInterestingRequest = (rawUrl) => {
    const url = rawUrl.toLowerCase();
    if (
        url.includes('manifest.webmanifest') ||
        url.includes('pwa-') ||
        url.includes('workbox') ||
        url.includes('favicon')
    ) {
        return false;
    }

    return (
        url.includes('.m3u8') ||
        url.includes('.mp4') ||
        url.includes('.mpd') ||
        url.includes('m3u8-proxy=') ||
        url.includes('/download?') ||
        url.includes('manifest')
    );
};

const getCaptureSessionKey = (sessionInfo) => {
    if (!sessionInfo || typeof sessionInfo !== 'object') {
        return '';
    }

    return [
        sessionInfo.tmdbId,
        sessionInfo.mediaType,
        sessionInfo.season || 1,
        sessionInfo.episode || 1,
        sessionInfo.providerId,
    ].join(':');
};

const rememberCapturedMedia = (item) => {
    if (!activeCaptureSession) {
        return;
    }

    const now = Date.now();
    if (now - activeCaptureStartedAt < CAPTURE_COOLDOWN_MS) {
        return;
    }

    if (capturedMedia.some((entry) => entry.url === item.url)) {
        return;
    }

    const scopedItem = {
        ...item,
        captureKey: activeCaptureSession.key,
        media: activeCaptureSession,
    };

    capturedMedia = [scopedItem, ...capturedMedia]
        .filter((entry) => now - entry.timestamp <= CAPTURE_TTL_MS)
        .filter((entry) => entry.captureKey === activeCaptureSession.key)
        .slice(0, MAX_CAPTURED_MEDIA);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:captured-media', scopedItem);
    }
};

const registerOfflineDownloadHandler = () => {
    session.defaultSession.on('will-download', async (event, item) => {
        const itemUrls = [item.getURL(), ...(item.getURLChain?.() || [])].filter(Boolean);
        const pendingDownload = [...pendingOfflineDownloads.values()].find((candidate) => (
            itemUrls.some((url) => candidate.matchUrls.includes(url))
        ));

        if (!pendingDownload) {
            return;
        }

        const sourceExtension = pendingDownload.resolvedExtension || getExtensionFromUrl(pendingDownload.sourceUrl);
        const targetFileName = `${pendingDownload.entry.id}-${sanitizeOfflineName(pendingDownload.baseName)}${sourceExtension}`;
        const targetFilePath = path.join(OFFLINE_LIBRARY_DIR, targetFileName);
        pendingDownload.item = item;

        if (supersededOfflineDownloadIds.has(pendingDownload.entry.id)) {
            item.cancel();
            return;
        }

        item.setSavePath(targetFilePath);

        await upsertOfflineDownloadEntry({
            ...pendingDownload.entry,
            fileName: targetFileName,
            filePath: targetFilePath,
            status: 'downloading',
            bytesReceived: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes(),
        });

        item.on('updated', async () => {
            if (supersededOfflineDownloadIds.has(pendingDownload.entry.id)) {
                item.cancel();
                return;
            }

            await upsertOfflineDownloadEntry({
                ...pendingDownload.entry,
                fileName: targetFileName,
                filePath: targetFilePath,
                status: 'downloading',
                bytesReceived: item.getReceivedBytes(),
                totalBytes: item.getTotalBytes(),
            });
        });

        item.once('done', async (_event, state) => {
            pendingOfflineDownloads.delete(pendingDownload.entry.id);

            if (supersededOfflineDownloadIds.has(pendingDownload.entry.id)) {
                supersededOfflineDownloadIds.delete(pendingDownload.entry.id);
                await removeOfflineFileIfUnshared({
                    ...pendingDownload.entry,
                    fileName: targetFileName,
                    filePath: targetFilePath,
                });
                return;
            }

            if (state === 'completed') {
                const fileStats = await stat(targetFilePath).catch(() => null);
                await upsertOfflineDownloadEntry({
                    ...pendingDownload.entry,
                    fileName: targetFileName,
                    filePath: targetFilePath,
                    fileSize: fileStats?.size,
                    mimeType: pendingDownload.mimeType || VIDEO_EXTENSION_MIME_TYPES[sourceExtension] || null,
                    status: 'completed',
                    bytesReceived: item.getReceivedBytes(),
                    totalBytes: item.getTotalBytes(),
                    completedAt: new Date().toISOString(),
                });
                return;
            }

            await upsertOfflineDownloadEntry({
                ...pendingDownload.entry,
                fileName: targetFileName,
                filePath: targetFilePath,
                status: state === 'cancelled' ? 'cancelled' : 'failed',
                bytesReceived: item.getReceivedBytes(),
                totalBytes: item.getTotalBytes(),
            });
        });
    });
};

const registerNetworkCapture = () => {
    session.defaultSession.setUserAgent(DESKTOP_USER_AGENT);

    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
        callback({
            requestHeaders: {
                ...details.requestHeaders,
                'User-Agent': DESKTOP_USER_AGENT,
            },
        });
    });

    session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        if (isInterestingRequest(details.url)) {
            rememberCapturedMedia({
                url: details.url,
                resourceType: details.resourceType,
                timestamp: Date.now(),
            });
        }

        callback({});
    });
};

const setupAutoUpdate = () => {
    if (!app.isPackaged) {
        return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.on('checking-for-update', () => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'checking',
            message: 'Checking for updates...',
            downloadProgress: null,
        };
        sendDesktopUpdateState();
    });
    autoUpdater.on('update-available', (info) => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'available',
            latestVersion: info.version || null,
            message: info.version
                ? `Update available: v${info.version}. Download it to install the latest desktop build.`
                : 'An update is available.',
            downloadProgress: null,
        };
        sendDesktopUpdateState();
    });
    autoUpdater.on('update-not-available', (info) => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'not-available',
            latestVersion: info?.version || desktopUpdateState.currentVersion,
            message: info?.version
                ? `You're already on the latest version (v${info.version}).`
                : 'You are already on the latest version.',
            downloadProgress: null,
        };
        sendDesktopUpdateState();
    });
    autoUpdater.on('download-progress', (progress) => {
        const percent = Number.isFinite(progress?.percent) ? Math.round(progress.percent) : 0;
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'downloading',
            message: percent > 0
                ? `Downloading update... ${percent}%`
                : 'Downloading update...',
            downloadProgress: percent,
        };
        sendDesktopUpdateState();
    });
    autoUpdater.on('update-downloaded', (info) => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'downloaded',
            latestVersion: info?.version || desktopUpdateState.latestVersion,
            message: info?.version
                ? `v${info.version} is ready. Restart the app to finish updating.`
                : 'The update is ready. Restart the app to finish updating.',
            downloadProgress: 100,
        };
        sendDesktopUpdateState();
    });
    autoUpdater.on('error', (error) => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'error',
            message: mapDesktopUpdateErrorMessage(error),
            downloadProgress: null,
        };
        sendDesktopUpdateState();
    });
    autoUpdater.checkForUpdates().catch((error) => {
        console.error('[desktop-updater] initial update check failed', error);
    });

    setInterval(() => {
        autoUpdater.checkForUpdates().catch((error) => {
            console.error('[desktop-updater] periodic update check failed', error);
        });
    }, 1000 * 60 * 60 * 6);
};

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderTurnstileHelperPage = (requestId, requestInfo) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Security Check</title>
  <style>
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      background: #0b0b0f;
      color: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .panel {
      width: min(100%, 420px);
      background: #111318;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.45);
    }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #71717a;
      margin-bottom: 12px;
      font-weight: 700;
    }
    h1 {
      font-size: 24px;
      line-height: 1.1;
      margin: 0 0 8px;
    }
    p {
      color: #a1a1aa;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 20px;
    }
    #widget {
      min-height: 70px;
    }
    .status {
      margin-top: 16px;
      font-size: 13px;
      color: #d4d4d8;
      min-height: 40px;
      line-height: 1.5;
    }
    .status.error {
      color: #fca5a5;
    }
    .status.success {
      color: #86efac;
    }
    .status code {
      color: #f4f4f5;
      background: rgba(255,255,255,0.06);
      border-radius: 6px;
      padding: 1px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="label">Plus Ultra Desktop</div>
    <h1>Security check</h1>
    <p>Complete the Cloudflare check to continue in the desktop app.</p>
    <div id="widget"></div>
    <div id="status" class="status"></div>
  </div>
  <script>
    const requestId = ${JSON.stringify(requestId)};
    const action = ${JSON.stringify(requestInfo.action)};
    const siteKey = ${JSON.stringify(requestInfo.siteKey)};
    const currentHost = window.location.hostname;
    const statusNode = document.getElementById('status');
    const widgetNode = document.getElementById('widget');
    let widgetRendered = false;
    let renderAttempts = 0;

    const setStatus = (message, className = '') => {
      statusNode.className = className ? 'status ' + className : 'status';
      statusNode.innerHTML = message;
    };

    const renderWidget = () => {
      if (widgetRendered || !window.turnstile || !widgetNode) {
        return;
      }

      widgetRendered = true;
      setStatus('Cloudflare loaded. Waiting for verification...', '');

      window.turnstile.render(widgetNode, {
        sitekey: siteKey,
        theme: 'dark',
        action,
        callback: async (token) => {
          setStatus('Verifying with the desktop app...', '');

          try {
            const response = await fetch('/desktop-turnstile/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId, token }),
            });

            if (!response.ok) {
              throw new Error('Verification handoff failed');
            }

            setStatus('Done. Return to the desktop app.', 'success');
          } catch (error) {
            setStatus('Failed to return the token to the desktop app. Try again.', 'error');
          }
        },
        'error-callback': (code) => {
          setStatus('Cloudflare rejected this browser challenge (' + String(code) + ').', 'error');
        },
        'expired-callback': () => setStatus('Challenge expired. Retry the check.', 'error'),
      });
    };

    const waitForTurnstile = () => {
      renderAttempts += 1;

      if (window.turnstile) {
        renderWidget();
        return;
      }

      if (renderAttempts >= 80) {
        setStatus(
          'Cloudflare Turnstile did not load in this browser. If you use Cloudflare hostname restrictions, add <code>localhost</code> and <code>127.0.0.1</code> to the allowed hostnames for this site key, then retry.',
          'error'
        );
        return;
      }

      window.setTimeout(waitForTurnstile, 100);
    };

    setStatus('Loading Cloudflare Turnstile on <code>' + currentHost + '</code>...', '');

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setStatus(
        'The Cloudflare Turnstile script failed to load. Check browser privacy shields, extensions, or network filtering, then retry.',
        'error'
      );
    };
    document.head.appendChild(script);

    waitForTurnstile();
  </script>
</body>
</html>`;

const startLocalRendererServer = async () => {
    if (localServer && localServerUrl) {
        return localServerUrl;
    }

    localServer = createServer(async (request, response) => {
        const requestUrl = request.url || '/';
        const normalizedPath = decodeURIComponent(requestUrl.split('?')[0] || '/');

        if (normalizedPath === '/desktop-turnstile' && request.method === 'GET') {
            const url = new URL(requestUrl, 'http://localhost');
            const requestId = url.searchParams.get('requestId') || '';
            const requestInfo = turnstileRequests.get(requestId);

            if (!requestInfo) {
                response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end('Unknown or expired Turnstile request.');
                return;
            }

            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(renderTurnstileHelperPage(requestId, requestInfo));
            return;
        }

        if (normalizedPath === '/desktop-turnstile/complete' && request.method === 'POST') {
            const chunks = [];
            request.on('data', (chunk) => chunks.push(chunk));
            request.on('end', () => {
                try {
                    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    const requestId = String(payload.requestId || '');
                    const token = String(payload.token || '');
                    const requestInfo = turnstileRequests.get(requestId);

                    if (!requestInfo || !token) {
                        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        response.end(JSON.stringify({ ok: false }));
                        return;
                    }

                    turnstileRequests.delete(requestId);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('desktop:turnstile-token', {
                            requestId,
                            token,
                            action: requestInfo.action,
                        });
                    }

                    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    response.end(JSON.stringify({ ok: true }));
                } catch {
                    response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    response.end(JSON.stringify({ ok: false }));
                }
            });
            return;
        }

        if (normalizedPath.startsWith('/desktop-offline-media/') && request.method === 'GET') {
            const downloadId = normalizedPath.replace('/desktop-offline-media/', '');
            const download = offlineDownloadCatalog.find((entry) => entry.id === downloadId && entry.status === 'completed');

            if (!download || !download.filePath || !existsSync(download.filePath)) {
                response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end('Offline media not found.');
                return;
            }

            const fileStats = await stat(download.filePath).catch(() => null);
            if (!fileStats) {
                response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end('Offline media is unavailable.');
                return;
            }

            const fileSize = fileStats.size;
            const rangeHeader = request.headers.range;
            const mimeType = download.mimeType || VIDEO_EXTENSION_MIME_TYPES[path.extname(download.fileName || download.filePath).toLowerCase()] || 'application/octet-stream';

            if (rangeHeader) {
                const [startRaw, endRaw] = rangeHeader.replace(/bytes=/, '').split('-');
                const start = Number.parseInt(startRaw, 10);
                const end = endRaw ? Number.parseInt(endRaw, 10) : fileSize - 1;

                if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
                    response.writeHead(416, { 'Content-Type': 'text/plain; charset=utf-8' });
                    response.end('Requested range not satisfiable.');
                    return;
                }

                response.writeHead(206, {
                    'Content-Type': mimeType,
                    'Content-Length': end - start + 1,
                    'Accept-Ranges': 'bytes',
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Cache-Control': 'no-store',
                });
                createReadStream(download.filePath, { start, end }).pipe(response);
                return;
            }

            response.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-store',
            });
            createReadStream(download.filePath).pipe(response);
            return;
        }

        const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '');
        const candidatePath = path.normalize(path.join(distDir, relativePath));
        const safePath = candidatePath.startsWith(distDir) ? candidatePath : path.join(distDir, 'index.html');

        let filePath = safePath;
        if (!existsSync(filePath) || (existsSync(filePath) && path.extname(filePath) === '')) {
            filePath = path.join(distDir, 'index.html');
        }

        const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        response.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': 'no-store',
        });
        createReadStream(filePath).pipe(response);
    });

    await new Promise((resolve, reject) => {
        localServer.once('error', reject);
        localServer.listen(DESKTOP_RENDERER_PORT, '127.0.0.1', () => {
            resolve();
        });
    });

    const address = localServer.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start local renderer server');
    }

    localServerUrl = `http://localhost:${address.port}`;
    return localServerUrl;
};

const createWindow = async () => {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        icon: desktopIconPath,
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    const devServerUrl = process.env.ELECTRON_START_URL;
    if (devServerUrl) {
        mainWindow.webContents.setUserAgent(DESKTOP_USER_AGENT);
        await mainWindow.loadURL(devServerUrl, { userAgent: DESKTOP_USER_AGENT });
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        return;
    }

    const rendererUrl = await startLocalRendererServer();
    mainWindow.webContents.setUserAgent(DESKTOP_USER_AGENT);
    await mainWindow.loadURL(rendererUrl, { userAgent: DESKTOP_USER_AGENT });
};

ipcMain.handle('desktop:start-media-capture', (_event, sessionInfo) => {
    const key = getCaptureSessionKey(sessionInfo);
    if (!key) {
        activeCaptureSession = null;
        capturedMedia = [];
        return { ok: false };
    }

    activeCaptureSession = {
        ...sessionInfo,
        key,
    };
    activeCaptureStartedAt = Date.now();
    capturedMedia = [];

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:captured-media-reset', { captureKey: key });
    }

    return { ok: true, captureKey: key };
});
ipcMain.handle('desktop:stop-media-capture', (_event, captureKey) => {
    if (activeCaptureSession?.key === captureKey) {
        activeCaptureSession = null;
        capturedMedia = [];
    }

    return { ok: true };
});
ipcMain.handle('desktop:get-captured-media', (_event, captureKey) => (
    captureKey
        ? capturedMedia.filter((entry) => entry.captureKey === captureKey)
        : []
));
ipcMain.handle('desktop:start-turnstile-check', async (_event, payload) => {
    const rendererUrl = await startLocalRendererServer();
    const requestId = randomUUID();
    const requestInfo = {
        action: String(payload?.action || 'auth'),
        siteKey: String(payload?.siteKey || '').trim(),
        createdAt: Date.now(),
    };

    if (!requestInfo.siteKey) {
        return { ok: false, message: 'Missing Turnstile site key.' };
    }

    turnstileRequests.set(requestId, requestInfo);
    const helperUrl = `${rendererUrl}/desktop-turnstile?requestId=${encodeURIComponent(requestId)}`;
    try {
        await shell.openExternal(helperUrl);
        return { ok: true, requestId };
    } catch (error) {
        turnstileRequests.delete(requestId);
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Failed to open the browser for security check.',
        };
    }
});
ipcMain.handle('desktop:open-external', (_event, targetUrl) => shell.openExternal(targetUrl));
ipcMain.handle('desktop:download-offline-media', async (_event, payload) => {
    if (!app.isPackaged && !process.env.ELECTRON_START_URL) {
        return { ok: false, message: 'Desktop offline downloads are unavailable in this build.' };
    }

    const sourceUrl = String(payload?.sourceUrl || '').trim();
    const title = String(payload?.title || '').trim();
    const tmdbId = Number(payload?.tmdbId);
    const mediaType = payload?.mediaType === 'tv' ? 'tv' : 'movie';

    if (!sourceUrl || !title || !Number.isFinite(tmdbId)) {
        return { ok: false, message: 'Missing offline download metadata.' };
    }

    const titleKey = {
        tmdbId,
        mediaType,
        season: typeof payload?.season === 'number' ? payload.season : undefined,
        episode: typeof payload?.episode === 'number' ? payload.episode : undefined,
    };
    const existingEntry = offlineDownloadCatalog.find((entry) => (
        entry.sourceUrl === sourceUrl &&
        isSameOfflineTitle(entry, titleKey) &&
        (entry.status === 'downloading' || entry.status === 'completed')
    ));

    if (existingEntry) {
        return { ok: true, entry: existingEntry };
    }

    const inspectedSource = await inspectOfflineDownloadSource(sourceUrl);
    if (!inspectedSource.ok) {
        return {
            ok: false,
            message: inspectedSource.message,
        };
    }

    const downloadId = randomUUID();
    const offlineEntry = {
        id: downloadId,
        tmdbId,
        title,
        mediaType,
        season: typeof payload?.season === 'number' ? payload.season : undefined,
        episode: typeof payload?.episode === 'number' ? payload.episode : undefined,
        year: typeof payload?.year === 'number' ? payload.year : undefined,
        imageUrl: String(payload?.imageUrl || ''),
        backdropUrl: payload?.backdropUrl ? String(payload.backdropUrl) : undefined,
        description: payload?.description ? String(payload.description) : undefined,
        genre: Array.isArray(payload?.genre) ? payload.genre.filter((item) => typeof item === 'string') : [],
        fileName: '',
        filePath: '',
        sourceUrl,
        mimeType: inspectedSource.contentType || undefined,
        status: 'downloading',
        providerId: payload?.providerId ? String(payload.providerId) : undefined,
        providerName: payload?.providerName ? String(payload.providerName) : undefined,
        createdAt: new Date().toISOString(),
        bytesReceived: 0,
        totalBytes: 0,
    };

    const replacedEntries = offlineDownloadCatalog.filter((entry) => (
        entry.id !== offlineEntry.id &&
        isSameOfflineTitle(entry, offlineEntry)
    ));
    await purgeOfflineDownloadEntries(replacedEntries);

    pendingOfflineDownloads.set(downloadId, {
        sourceUrl,
        matchUrls: [...new Set([sourceUrl, inspectedSource.finalUrl].filter(Boolean))],
        resolvedExtension: inspectedSource.resolvedExtension,
        mimeType: inspectedSource.contentType || null,
        baseName: getOfflineBaseName(offlineEntry),
        entry: offlineEntry,
    });

    await upsertOfflineDownloadEntry(offlineEntry);

    try {
        mainWindow?.webContents.downloadURL(sourceUrl);
        return { ok: true, entry: offlineEntry };
    } catch (error) {
        pendingOfflineDownloads.delete(downloadId);
        await upsertOfflineDownloadEntry({
            ...offlineEntry,
            status: 'failed',
        });
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Failed to start offline download.',
        };
    }
});
ipcMain.handle('desktop:get-offline-downloads', async () => offlineDownloadCatalog);
ipcMain.handle('desktop:remove-offline-download', async (_event, downloadId) => {
    const entry = offlineDownloadCatalog.find((item) => item.id === downloadId);
    if (!entry) {
        return { ok: false, message: 'Offline download not found.' };
    }

    const isSharedFile = entry.filePath && offlineDownloadCatalog.some((item) => (
        item.id !== entry.id &&
        item.filePath === entry.filePath
    ));

    if (entry.filePath && !isSharedFile && existsSync(entry.filePath)) {
        await rm(entry.filePath, { force: true }).catch(() => undefined);
    }

    await removeOfflineDownloadEntry(downloadId);
    return { ok: true };
});
ipcMain.handle('desktop:get-offline-playback-url', async (_event, downloadId) => {
    const entry = offlineDownloadCatalog.find((item) => item.id === downloadId && item.status === 'completed');
    if (!entry) {
        return { ok: false, message: 'Offline download not found.' };
    }

    if (!entry.filePath || !existsSync(entry.filePath)) {
        await upsertOfflineDownloadEntry({
            ...entry,
            status: 'failed',
        });
        return { ok: false, message: 'Offline file is missing. Remove it from Download Quest and download it again.' };
    }

    await startLocalRendererServer();
    const url = getOfflinePlaybackUrlForId(downloadId);
    if (!url) {
        return { ok: false, message: 'Offline playback is unavailable.' };
    }

    return { ok: true, url };
});
ipcMain.handle('desktop:check-for-updates', async () => {
    if (!app.isPackaged) {
        return { ok: false, message: 'Auto-update is only available in packaged builds.' };
    }

    try {
        const result = await autoUpdater.checkForUpdates();
        return {
            ok: true,
            status: desktopUpdateState.status,
            currentVersion: desktopUpdateState.currentVersion,
            latestVersion: result?.updateInfo?.version || desktopUpdateState.latestVersion,
            message: desktopUpdateState.message,
        };
    } catch (error) {
        const message = mapDesktopUpdateErrorMessage(error);
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'error',
            message,
        };
        sendDesktopUpdateState();
        return {
            ok: false,
            status: 'error',
            currentVersion: desktopUpdateState.currentVersion,
            latestVersion: desktopUpdateState.latestVersion,
            message,
        };
    }
});
ipcMain.handle('desktop:get-update-state', async () => ({
    ...desktopUpdateState,
}));
ipcMain.handle('desktop:download-update', async () => {
    if (!app.isPackaged) {
        return { ok: false, message: 'Auto-update is only available in packaged builds.' };
    }

    try {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'downloading',
            message: 'Downloading update...',
            downloadProgress: desktopUpdateState.downloadProgress ?? 0,
        };
        sendDesktopUpdateState();
        await autoUpdater.downloadUpdate();
        return {
            ok: true,
            status: desktopUpdateState.status,
            currentVersion: desktopUpdateState.currentVersion,
            latestVersion: desktopUpdateState.latestVersion,
            message: desktopUpdateState.message,
            downloadProgress: desktopUpdateState.downloadProgress,
        };
    } catch (error) {
        const message = mapDesktopUpdateErrorMessage(error);
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'error',
            message,
            downloadProgress: null,
        };
        sendDesktopUpdateState();
        return {
            ok: false,
            status: 'error',
            currentVersion: desktopUpdateState.currentVersion,
            latestVersion: desktopUpdateState.latestVersion,
            message,
            downloadProgress: desktopUpdateState.downloadProgress,
        };
    }
});
ipcMain.handle('desktop:install-update', async () => {
    if (!app.isPackaged) {
        return { ok: false, message: 'Auto-update is only available in packaged builds.' };
    }

    if (desktopUpdateState.status !== 'downloaded') {
        return {
            ok: false,
            status: desktopUpdateState.status,
            currentVersion: desktopUpdateState.currentVersion,
            latestVersion: desktopUpdateState.latestVersion,
            message: 'Download the update before installing it.',
            downloadProgress: desktopUpdateState.downloadProgress,
        };
    }

    setImmediate(() => {
        autoUpdater.quitAndInstall();
    });

    return {
        ok: true,
        status: 'installing',
        currentVersion: desktopUpdateState.currentVersion,
        latestVersion: desktopUpdateState.latestVersion,
        message: 'Restarting to install the update...',
        downloadProgress: desktopUpdateState.downloadProgress,
    };
});

app.whenReady().then(async () => {
    await loadOfflineCatalog();
    registerNetworkCapture();
    registerOfflineDownloadHandler();
    await createWindow();
    setupAutoUpdate();

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    turnstileRequests.clear();
    if (localServer) {
        localServer.close();
        localServer = null;
        localServerUrl = null;
    }
});
