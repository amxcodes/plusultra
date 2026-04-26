import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import electronUpdater from 'electron-updater';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const MAX_CAPTURED_MEDIA = 100;

let mainWindow = null;
let capturedMedia = [];

const isInterestingRequest = (rawUrl) => {
    const url = rawUrl.toLowerCase();
    return (
        url.includes('.m3u8') ||
        url.includes('.mp4') ||
        url.includes('.mpd') ||
        url.includes('m3u8-proxy=') ||
        url.includes('/download?') ||
        url.includes('manifest')
    );
};

const rememberCapturedMedia = (item) => {
    if (capturedMedia.some((entry) => entry.url === item.url)) {
        return;
    }

    capturedMedia = [item, ...capturedMedia].slice(0, MAX_CAPTURED_MEDIA);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:captured-media', item);
    }
};

const registerNetworkCapture = () => {
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
        await mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        return;
    }

    await mainWindow.loadFile(path.join(rootDir, 'dist', 'index.html'));
};

ipcMain.handle('desktop:get-captured-media', () => capturedMedia);
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
