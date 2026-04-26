import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
    isDesktop: true,
    getCapturedMedia: () => ipcRenderer.invoke('desktop:get-captured-media'),
    openExternal: (targetUrl) => ipcRenderer.invoke('desktop:open-external', targetUrl),
    checkForUpdates: () => ipcRenderer.invoke('desktop:check-for-updates'),
    onCapturedMedia: (listener) => {
        const wrapped = (_event, payload) => listener(payload);
        ipcRenderer.on('desktop:captured-media', wrapped);
        return () => ipcRenderer.removeListener('desktop:captured-media', wrapped);
    },
});
