// Sentry must be initialized first to catch all errors
import { initSentry } from './lib/sentry';
initSentry();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

const updateServiceWorker = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update();

    if (typeof window !== 'undefined') {
      window.setInterval(() => {
        void registration?.update();
      }, 60 * 1000);
    }
  },
  onNeedRefresh() {
    updateServiceWorker(true);
  },
  onOfflineReady() {
    console.info('[PWA] Offline cache is ready');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
