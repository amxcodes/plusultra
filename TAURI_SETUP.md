# Plus Ultra Tauri App

This is the Rust/Tauri desktop app for the existing Plus Ultra React web app.

## What It Reuses

- React app entrypoints: `index.html`, `index.tsx`, `App.tsx`
- Supabase client and existing environment variables
- Vite build output from `dist/`
- Existing UI, routing, player, provider, and settings logic

## Commands

```bash
npm run tauri:dev
npm run tauri:build
npm run tauri:validate
```

## Notes

- `npm run tauri:dev` starts Vite and opens the Tauri webview.
- `npm run tauri:build` runs the normal web build first, then packages with Tauri.
- `npm run build` remains the web/PWA build.

## Current Scope

The Tauri app includes a native Rust shield layer:

- blocks known ad/tracker/redirect hosts on webview navigation
- denies embed-created popup/new-window requests
- avoids iframe sandboxing so sandbox-detecting providers can still play

It also exposes an initial Tauri-compatible `window.desktop` bridge for native
offline download commands:

- `downloadOfflineMedia`
- `getOfflineDownloads`
- `removeOfflineDownload`
- `getOfflinePlaybackUrl`
- `openExternal`

Downloads are handled by Rust as streaming background jobs. The bridge emits
catalog changes to the existing downloads UI and converts local files to Tauri
asset URLs for playback.

## Updates and Releases

Tauri updates are wired through the same `window.desktop` update methods used by
the app UI:

- `checkForUpdates`
- `downloadUpdate`
- `installUpdate`
- `getUpdateState`
- `onUpdateState`

The Tauri release workflow is `.github/workflows/tauri-release.yml`. It runs on
manual dispatch or tags matching `tauri-v*`, builds the Windows Tauri bundle, and
uploads signed updater artifacts to GitHub releases.

The updater public key is already configured in `src-tauri/tauri.conf.json`.
The generated private key is intentionally ignored at:

```bash
.tauri-keys/tauri-updater.key
```

Before shipping production Tauri updates:

1. Add the private key to GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY`.
2. Add the password as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key is
   password protected.

Still pending for deeper native parity:

- media request capture from the webview network stack
- stream-aware HLS/DASH download assembly
- desktop notifications
- Turnstile helper window
