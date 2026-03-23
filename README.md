# Plus Ultra

Plus Ultra is a React + TypeScript + Vite streaming companion app with:

- TMDB-powered discovery for movies and TV
- Supabase auth, profiles, playlists, follows, and admin tooling
- wrapped/stats based on session tracking
- provider management and provider health analytics
- mobile/PWA support

## Stack

- React 19
- TypeScript
- Vite
- Supabase
- Vitest
- Netlify

## Local Development

Prerequisites:

- Node.js 22

Setup:

1. Install dependencies with `npm ci`
2. Add local env values in `.env.local`
3. Start the app with `npm run dev`

## Quality Checks

Run the full local gate with:

```bash
npm run qa
```

That runs:

1. `npm run typecheck`
2. `npm run test:run`
3. `npm run build`

## Deployment

- CI runs through GitHub Actions in `.github/workflows/ci.yml`
- Deployment runs through the existing Netlify GitHub integration
- Netlify build settings are defined in `netlify.toml`

## Notes

- Wrapped stats are based on qualified sessions, not exact embedded-player playback
- Provider ranking blends manual survey feedback with automatic session heuristics
