import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
    isDesktop: true,
    startMediaCapture: (sessionInfo) => ipcRenderer.invoke('desktop:start-media-capture', sessionInfo),
    stopMediaCapture: (captureKey) => ipcRenderer.invoke('desktop:stop-media-capture', captureKey),
    getCapturedMedia: (captureKey) => ipcRenderer.invoke('desktop:get-captured-media', captureKey),
    openExternal: (targetUrl) => ipcRenderer.invoke('desktop:open-external', targetUrl),
    checkForUpdates: () => ipcRenderer.invoke('desktop:check-for-updates'),
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
});
