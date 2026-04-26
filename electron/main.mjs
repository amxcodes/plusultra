import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const desktopIconPath = path.join(rootDir, 'public', 'pwa-512x512.png');
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
};

const sendDesktopUpdateState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:update-state', desktopUpdateState);
    }
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

    autoUpdater.autoDownload = true;
    autoUpdater.on('checking-for-update', () => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'checking',
            message: 'Checking for updates...',
        };
        sendDesktopUpdateState();
    });
    autoUpdater.on('update-available', (info) => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'available',
            latestVersion: info.version || null,
            message: info.version
                ? `Update available: v${info.version}.`
                : 'An update is available.',
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
        };
        sendDesktopUpdateState();
    });
    autoUpdater.on('error', (error) => {
        desktopUpdateState = {
            ...desktopUpdateState,
            status: 'error',
            message: mapDesktopUpdateErrorMessage(error),
        };
        sendDesktopUpdateState();
    });
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
        console.error('[desktop-updater] initial update check failed', error);
    });

    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((error) => {
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

    localServer = createServer((request, response) => {
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
        localServer.listen(0, '127.0.0.1', () => {
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

app.whenReady().then(async () => {
    registerNetworkCapture();
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
