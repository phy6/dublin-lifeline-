# Deploying to GitHub Pages

## One-Time Setup

1. Go to your repository on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
3. Select branch: `main` (or `master`), folder: `/ (root)`.
4. Click **Save**. GitHub will publish at `https://<username>.github.io/<repo>/`.

## How It Works

- The app is a static site — no server required.
- All assets are relative paths (`./data/services.json`, `./js/app.js`, etc.) so they work from any base URL.
- Routing uses hash fragments (`#/map`, `#/timetable`, `#/guide`) which require no server-side configuration.

## Verify Deployment

1. Push to the `main` branch.
2. Wait ~1 minute for GitHub Pages to build.
3. Visit `https://<username>.github.io/<repo>/` — the emergency banner and map should load.
4. Test offline: open DevTools → Application → Service Workers → Offline, reload.

## Updating Data

- Data updates are automated via the `scrape-sync` workflow (weekly, Monday 6 AM Europe/Dublin).
- Manual trigger: **Actions** → **Dublin Lifeline Scrape-Sync** → **Run workflow**.
- Or run locally: `npm run scrape && npm run merge` then commit `data/services.json`.

## PWA Install

- On mobile/desktop, the browser will offer **Install** / **Add to Home Screen**.
- Requires HTTPS (GitHub Pages provides this automatically).
