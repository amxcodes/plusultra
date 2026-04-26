import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
    isDesktop: true,
    startMediaCapture: (sessionInfo) => ipcRenderer.invoke('desktop:start-media-capture', sessionInfo),
    stopMediaCapture: (captureKey) => ipcRenderer.invoke('desktop:stop-media-capture', captureKey),
    getCapturedMedia: (captureKey) => ipcRenderer.invoke('desktop:get-captured-media', captureKey),
    startTurnstileCheck: (payload) => ipcRenderer.invoke('desktop:start-turnstile-check', payload),
    openExternal: (targetUrl) => ipcRenderer.invoke('desktop:open-external', targetUrl),
    checkForUpdates: () => ipcRenderer.invoke('desktop:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('desktop:download-update'),
    installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
    getUpdateState: () => ipcRenderer.invoke('desktop:get-update-state'),
    onCapturedMedia: (listener) => {
        const wrapped = (_event, payload) => listener(payload);
        ipcRenderer.on('desktop:captured-media', wrapped);
        return () => ipcRenderer.removeListener('desktop:captured-media', wrapped);
    },
    onCapturedMediaReset: (listener) => {
        const wrapped = (_event, payload) => listener(payload);
        ipcRenderer.on('desktop:captured-media-reset', wrapped);
        return () => ipcRenderer.removeListener('desktop:captured-media-reset', wrapped);
    },
    onTurnstileToken: (listener) => {
        const wrapped = (_event, payload) => listener(payload);
        ipcRenderer.on('desktop:turnstile-token', wrapped);
        return () => ipcRenderer.removeListener('desktop:turnstile-token', wrapped);
    },
    onUpdateState: (listener) => {
        const wrapped = (_event, payload) => listener(payload);
        ipcRenderer.on('desktop:update-state', wrapped);
        return () => ipcRenderer.removeListener('desktop:update-state', wrapped);
    },
});
