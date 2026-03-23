# QA and Release Checklist

## Local QA

Run the full local gate before pushing:

```bash
npm ci
npm run qa
```

Manual smoke checks:

1. Sign in and confirm profile loads without console errors.
2. Open playlists and verify personal playlists and featured playlists load.
3. Open admin dashboard and verify providers, presence, and wrapped controls load.
4. Open wrapped/stats on desktop and mobile layouts.
5. Open player, switch providers once, and confirm session tracking still works.
6. Check mobile/PWA back navigation, menu navigation, and wrapped slides.

## CI

GitHub Actions workflow:

- [ci.yml](/C:/Users/AMAN%20ANU/Desktop/amxcodes/stream/.github/workflows/ci.yml)

It runs:

1. `npm ci`
2. `npm run typecheck`
3. `npm run test:run`
4. `npm run build`

## CD

Deployment uses the existing Netlify GitHub integration for this repository.

Netlify build config is stored in:

- [netlify.toml](/C:/Users/AMAN%20ANU/Desktop/amxcodes/stream/netlify.toml)

## Notes

- `.nvmrc` pins CI to Node 22.
- `npm run test:coverage` is available for deeper QA runs.
- GitHub Actions handles CI only; Netlify handles deploys after pushes according to the site integration settings.
