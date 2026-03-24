import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { handleRecommendationBridge } from './server/recommendationBridgeHandler';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/anilist': {
          target: 'https://graphql.anilist.co',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/anilist/, '')
        }
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-recommendation-bridge',
        configureServer(server) {
          server.middlewares.use('/api/recommendation-bridge', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }

            const rawBody = Buffer.concat(chunks).toString('utf8');
            const body = rawBody ? JSON.parse(rawBody) : null;
            const response = await handleRecommendationBridge(body, {
              VITE_TASTEDIVE_API_KEY: env.VITE_TASTEDIVE_API_KEY,
              VITE_OMDB_API_KEY: env.VITE_OMDB_API_KEY,
            });

            res.statusCode = response.status;
            Object.entries(response.headers).forEach(([key, value]) => res.setHeader(key, value));
            res.end(response.body);
          });
        }
      },
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
        },
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'Plus Ultra',
          short_name: 'Plus Ultra',
          description: 'Your ultimate streaming companion. ',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
