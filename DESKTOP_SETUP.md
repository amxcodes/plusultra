# Desktop Setup

The repo now uses one shared app codebase for both web and desktop.

Web:

- `npm run build`
- Netlify can keep using the normal root Vite build

Desktop:

- `npm run desktop:dev`
- `npm run desktop:dist`

Release flow:

1. Push normal commits to update the shared codebase.
2. Netlify deploys the web app from the same root project.
3. Push a version tag like `v1.0.0` to trigger the desktop release workflow.
4. `electron-builder` publishes the desktop installer and update metadata to GitHub Releases.

Auto-update is configured for:

- GitHub owner: `amxcodes`
- GitHub repo: `plusultra`

The built-in workflow token is used in CI:

```yaml
GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
