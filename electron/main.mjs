import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
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
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
        console.error('[desktop-updater] initial update check failed', error);
    });

    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((error) => {
            console.error('[desktop-updater] periodic update check failed', error);
        });
    }, 1000 * 60 * 60 * 6);
};

const startLocalRendererServer = async () => {
    if (localServer && localServerUrl) {
        return localServerUrl;
    }

    localServer = createServer((request, response) => {
        const requestUrl = request.url || '/';
        const normalizedPath = decodeURIComponent(requestUrl.split('?')[0] || '/');
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
ipcMain.handle('desktop:open-external', (_event, targetUrl) => shell.openExternal(targetUrl));
ipcMain.handle('desktop:check-for-updates', async () => {
    if (!app.isPackaged) {
        return { ok: false, message: 'Auto-update is only available in packaged builds.' };
    }

    try {
        await autoUpdater.checkForUpdates();
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Update check failed.',
        };
    }
});

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
    if (localServer) {
        localServer.close();
        localServer = null;
        localServerUrl = null;
    }
});
