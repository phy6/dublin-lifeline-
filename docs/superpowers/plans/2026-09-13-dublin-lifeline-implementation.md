# Dublin Lifeline Directory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable-to-GitHub-Pages PWA — Dublin Lifeline Directory — with interactive map, searchable directory, timetable, pathways guide, and offline support.

**Architecture:** Single-page static app with hash-based routing. Vanilla ES Modules organized by feature (map, directory, timetable, guide, services). Tailwind CDN for styling. Dark theme via CSS variables. PWA manifest + service worker for installability and offline mode. Node.js scraping pipeline produces `services.json` consumed by the frontend.

**Tech Stack:** Vanilla JS (ES Modules), Tailwind CDN, Leaflet.js, OpenStreetMap, Service Worker, Web App Manifest, Node.js (scraper/merger), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-13-dublin-lifeline-rebuild-design.md`

---

## Global Constraints

- No build step (no Vite, Webpack, or bundler)
- Tailwind via CDN only (`<script src="https://cdn.tailwindcss.com">`)
- Leaflet.js via CDN with integrity hashes
- All JS uses ES module syntax (`import`/`export`)
- Dark theme is the default; CSS variables in `:root` and `[data-theme="dark"]`
- All external resources use HTTPS with integrity attributes
- GPS location stays on device only (never stored or transmitted)
- `services.json` is the single source of truth for the frontend
- Provider IDs are unique URL-friendly slugs
- Phone numbers in international format (`+353-...`)

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | Single page app shell, hash routing, nav tabs, `noscript` fallback |
| `css/app.css` | Tailwind CDN + custom CSS variables, component styles |
| `js/app.js` | Orchestrator, hash router, theme manager, init |
| `js/map.js` | Leaflet map init, markers, GPS, map fallback |
| `js/directory.js` | Filter chips, search, cards, stats, directory rendering |
| `js/timetable.js` | Day/week/month grids, modal, localStorage schedule |
| `js/guide.js` | Accordions, pathways content rendering |
| `js/services.js` | Data layer: fetch `services.json`, normalize, cache |
| `data/services.json` | Curated provider data (single source of truth) |
| `sw.js` | Service worker for offline PWA |
| `manifest.json` | PWA install manifest |
| `scripts/scraper.js` | Fixed-selectors scraper + provider discovery |
| `scripts/mergeData.js` | Merges scraped + fallback → `services.json` |
| `config/sources.json` | Per-provider config with selectors and fallbacks |
| `tests/test-scraper.js` | Scraper unit tests |
| `tests/test-mergeData.js` | Merger unit tests |
| `.github/workflows/scrape-sync.yml` | CI/CD pipeline |
| `package.json` | Dependencies + scripts |

---

## Task 1: Project Scaffolding

**Files:** `package.json`, `index.html` (scaffold)

**Interfaces:**
- `package.json` defines project metadata and scripts
- `index.html` provides the basic HTML shell with CDN links and hash routing structure

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dublin-lifeline-directory",
  "version": "3.0.0",
  "description": "Dublin Lifeline Directory - Free, open-source directory of Dublin's essential community support providers.",
  "main": "scripts/scraper.js",
  "scripts": {
    "scrape": "node scripts/scraper.js",
    "merge": "node scripts/mergeData.js",
    "start": "node scripts/scraper.js && node scripts/mergeData.js",
    "test": "node --test tests/",
    "dev": "npx serve . -p 8080"
  },
  "dependencies": {
    "cheerio": "^1.2.0"
  },
  "author": "Dublin Lifeline Pipeline",
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd /home/martin/Dublin\ Services && npm install`

- [ ] **Step 3: Scaffold `index.html`**

Create the complete HTML structure:
- DOCTYPE, `<html lang="en">`, `<head>` with charset, viewport, theme-color, description, title
- Tailwind CDN script tag
- Leaflet CSS via CDN with integrity
- Custom `<style>` block with CSS variables for dark/light themes
- `<body>` with:
  - Emergency banner (`<div class="emergency">`) with 1800 707 707 and 999/112 links
  - `<header>` with brand and theme toggle button
  - `<main>` with nav-tabs (Map & Directory, Timetable, Pathways)
  - Three `<section>` elements with `id="homePage"`, `id="timetablePage"`, `id="guidePage"` and `role="tabpanel"`
  - Modal overlay for schedule form
  - `<footer>` with data update info
  - `<noscript>` fallback showing core services
  - Leaflet JS via CDN with integrity
  - `<script type="module" src="js/app.js">`
- [ ] **Step 4: Create `css/app.css`**

Empty file that will be referenced by `<link>` in `index.html`. Tailwind CDN handles most styling, but this file holds custom styles that can't be done via Tailwind utility classes (e.g., custom animations, card hover effects).

- [ ] **Step 5: Commit scaffolding**

```bash
git add package.json package-lock.json index.html css/app.css
git commit -m "feat: scaffold project with package.json and index.html"
```

---

## Task 2: Data Layer and Initial Dataset

**Files:** `data/services.json`, `js/services.js`

**Interfaces:**
- `js/services.js` exports `loadServices()`, `getAllServices()`, `searchServices()`, `filterByCategory()`
- `data/services.json` is the single source of truth consumed by all modules

- [ ] **Step 1: Create `data/services.json`** with all 7 providers plus 3 newly discovered providers

The 7 existing providers (with corrected data):
1. Capuchin Day Centre — 29 Bow St, Dublin 7 — category: Emergency Shelter
2. Merchants Quay Ireland — 8 Merchants Quay, Dublin 8 — category: Addiction Support
3. Focus Ireland — 218-222 Phibsborough Road, Dublin 7 — category: Housing Support
4. Dublin Simon Community — 85 Capel Street, Dublin 1 — category: Emergency Shelter
5. Samaritans Ireland — 191 Great Denmark Street, Dublin 1 — category: Crisis Support
6. Crosscare — 127 Parnell Square West, Dublin 1 — category: Community Support
7. Mendicity Institution — 115 Usher's Island, Dublin 8 — category: Community Support

3 new providers discovered via Dublin charity directories:
8. Peter McVerry Trust — 8 North Richmond Street, Dublin 1 — category: Housing Support
9. COPE (Community Projects for Employment) — 68-72 Amiens Street, Dublin 1 — category: Employment Support
10. Simon Community Employment — various locations — category: Employment Support

Each provider must have: `id`, `name`, `address`, `phone`, `email`, `website`, `hours`, `tags`, `services`, `category`, `latitude`, `longitude`, `description`, `lastVerified`

- [ ] **Step 2: Create `js/services.js`**

Export module with:
- `loadServices()` — fetches `./data/services.json`, returns parsed JSON
- `getAllServices()` — returns all providers
- `searchServices(query)` — filters providers by name/description/address matching query
- `filterByCategory(providers, category)` — filters providers by category or tag
- `formatHours(hours)` — converts hours object to readable string (handles "closed", "mon-fri", etc.)
- `escapeHtml(str)` — HTML entity escaping (same as current implementation)

- [ ] **Step 3: Verify data layer**

Create a temporary test file to verify `loadServices()` returns valid data and `filterByCategory()` works correctly.

- [ ] **Step 4: Commit data layer**

```bash
git add data/services.json js/services.js
git commit -m "feat: add data layer with 10 Dublin service providers"
```

---

## Task 3: App Orchestrator and Router

**Files:** `js/app.js`

**Interfaces:**
- `js/app.js` imports from `js/map.js`, `js/directory.js`, `js/timetable.js`, `js/guide.js`, `js/services.js`
- Orchestrates initialization, hash routing, theme management

- [ ] **Step 1: Create `js/app.js`**

Implement as an IIFE or class:
- `init()` — removes `no-js` class, loads services, initializes all modules, sets up hash routing
- `handleRoute()` — reads `window.location.hash`, shows corresponding page view, hides others
- `setupTheme()` — reads `localStorage` for theme preference, applies `data-theme` attribute, toggles button text
- `setupNavigation()` — sets up tab click handlers, updates `aria-selected`, calls `handleRoute()`
- `registerServiceWorker()` — registers `./sw.js` if available
- Expose `init` globally: `window.DublinLifelineApp = { init }`

- [ ] **Step 2: Wire up imports**

Add `import` statements at the top of `js/app.js` for all module files. Update `index.html` to use `<script type="module" src="js/app.js">` instead of `js/modules.js`.

- [ ] **Step 3: Test app initialization**

Start a local server (`npx serve . -p 8080`) and verify:
- Page loads without console errors
- Hash routing works (`#/map`, `#/timetable`, `#/guide`)
- Dark theme toggle works
- Service worker registers (or fails gracefully)

- [ ] **Step 4: Commit orchestrator**

```bash
git add js/app.js
git commit -m "feat: add app orchestrator with hash routing and theme manager"
```

---

## Task 4: Interactive Map Module

**Files:** `js/map.js`

**Interfaces:**
- `js/map.js` exports `initMap()`, `centerOnMap(lat, lng)`, `addMarkers(providers)`
- Called by `js/app.js` on initialization and tab switch

- [ ] **Step 1: Create `js/map.js`**

Implement:
- `initMap()` — creates Leaflet map centered on Dublin (53.3498, -6.2603), zoom 13
- Adds OpenStreetMap tile layer with attribution
- Creates `markersLayer` as `L.layerGroup()`
- `addMarkers(providers)` — iterates providers, creates custom emoji markers (🍲🏠🩺📍), binds popups with name, address, phone, website
- `centerOnMap(lat, lng)` — sets view to coordinates, opens popup at matching marker
- `setupMapFallback()` — 5-second timeout that shows fallback message if no tile layer renders
- `handleThemeChange()` — calls `map.invalidateSize()` when theme toggles

- [ ] **Step 2: Add map container to `index.html`**

The `#map` div inside `#homePage` section with proper `aria-label`.

- [ ] **Step 3: Test map rendering**

Verify map tiles load, markers display, popups show correct info, GPS button works.

- [ ] **Step 4: Commit map module**

```bash
git add js/map.js
git commit -m "feat: add Leaflet map module with markers and GPS"
```

---

## Task 5: Directory Module with Search

**Files:** `js/directory.js`

**Interfaces:**
- `js/directory.js` exports `init()`, `renderCards(providers)`, `filterServices(filter)`, `searchServices(query)`
- Called by `js/app.js` during initialization

- [ ] **Step 1: Create `js/directory.js`**

Implement:
- `init()` — sets up filter chip click handlers, search input handler
- `renderCards(providers)` — creates card grid from providers array, each card shows name, category, address, tags, services, hours, last verified date, action buttons (Call, Website, Map)
- `filterServices(filter)` — filters providers by tag/category, updates card grid and stats bar
- `searchServices(query)` — text search across name, address, description, services
- `populateFilterChips()` — creates filter chip buttons (All, Food, Shelter, Medical, Support, Community, Education)
- `updateStats(filtered, total)` — updates stats bar showing "Showing X of Y providers"
- Filter chips preserve active state via `active` class

- [ ] **Step 2: Add search input and stats bar to `index.html`**

Add `<input type="search" id="searchInput">` above the filter chips and keep the stats bar `<div id="stats-bar">`.

- [ ] **Step 3: Test directory rendering**

Verify all cards render, filters work, search works, stats bar updates correctly.

- [ ] **Step 4: Commit directory module**

```bash
git add js/directory.js
git commit -m "feat: add directory module with filters and search"
```

---

## Task 6: Timetable Module with Schedule Modal

**Files:** `js/timetable.js`

**Interfaces:**
- `js/timetable.js` exports `init()`, `renderGrid(format)`, `openModal()`, `closeModal()`, `saveEvent()`
- Schedule items stored in `localStorage` under key `dublin-lifeline-schedule`

- [ ] **Step 1: Create `js/timetable.js`**

Implement:
- `init()` — sets up format toggle buttons, renders initial day grid, sets up modal trigger
- `renderGrid(format)` — renders day/week/month grid based on format
  - Day: shows today's providers with hours
  - Week: 7-column grid, one box per day, providers per day
  - Month: calendar-style grid with events
- `openModal()` — shows modal, focuses first input, sets up focus trap, adds keydown listener for Escape
- `closeModal()` — hides modal, restores focus, removes listeners
- `saveEvent()` — validates date and service, saves to localStorage, shows confirmation, closes modal
- `loadSchedule()` — reads from localStorage, returns array of scheduled items
- `autoFillTime()` — sets time input to current time
- `setDefaultDate()` — sets date input to today

- [ ] **Step 2: Add modal HTML to `index.html`**

Modal overlay with form: date input, service select dropdown, time input, submit button, close button. Include aria-modal and aria-labelledby attributes.

- [ ] **Step 3: Populate service select** from `services.json` data (all provider names).

- [ ] **Step 4: Test timetable and modal**

Verify all three grid formats render correctly, modal works with focus trap, Escape closes modal, schedule saves to localStorage, click-outside closes modal.

- [ ] **Step 5: Commit timetable module**

```bash
git add js/timetable.js
git commit -m "feat: add timetable module with schedule modal and localStorage"
```

---

## Task 7: Guide and Pathways Module

**Files:** `js/guide.js`

**Interfaces:**
- `js/guide.js` exports `init()`, `renderGuideContent()`
- Called by `js/app.js` during initialization

- [ ] **Step 1: Create `js/guide.js`**

Implement:
- `init()` — sets up accordion toggle handlers
- `renderGuideContent()` — populates 6 accordion sections:
  1. Free Meals & Grocery Food Parcels
  2. Clothing, Hygiene & Essential Supplies
  3. Housing & Emergency Accommodation
  4. Mental Health & Crisis Support
  5. Libraries & Free Workspaces
  6. System Pathways & Government Welfare
- Each section lists relevant providers from `services.json` with name, address, phone, services, hours
- System Pathways section has static content about DRHE (1800 707 707), SWA, Urgent Needs Payment, Capuchin, MQI
- Uses `<details>` elements with `guide-acc` class

- [ ] **Step 2: Add guide accordion HTML to `index.html`**

Six `<details class="guide-acc">` elements with `<summary>` and content divs, each with unique IDs for content rendering.

- [ ] **Step 3: Test guide rendering**

Verify all 6 sections render with correct provider data, accordions open/close properly.

- [ ] **Step 4: Commit guide module**

```bash
git add js/guide.js
git commit -m "feat: add guide and pathways module with accordions"
```

---

## Task 8: PWA — Service Worker and Manifest

**Files:** `sw.js`, `manifest.json`

**Interfaces:**
- `sw.js` handles install, activate, fetch events
- `manifest.json` defines PWA metadata for installability

- [ ] **Step 1: Create `sw.js`**

Implement:
- Cache name: `dublin-lifeline-v3`
- Install event: cache static assets (`index.html`, `css/app.css`, JS modules, Leaflet CSS/JS) and `data/services.json`
- Activate event: clear old caches, claim clients
- Fetch event: network-first for `data/services.json`, cache-first for static assets
- Add `offline` indicator handling
- Do NOT cache `scraped_output.json` or `merge_report.json`

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "name": "Dublin Lifeline Directory",
  "short_name": "Dublin Lifeline",
  "description": "Free, open-source directory of Dublin's essential community support providers.",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "background_color": "#0d1117",
  "theme_color": "#0d1117",
  "orientation": "portrait-primary",
  "lang": "en-IE",
  "dir": "ltr",
  "categories": ["health", "emergency", "social"],
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2338bdf8'/><text x='50' y='68' font-size='50' text-anchor='middle' fill='white'>911</text></svg>",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Link manifest in `index.html`**

Add `<link rel="manifest" href="manifest.json">` in `<head>`. Add `<meta name="theme-color" content="#0d1117">`.

- [ ] **Step 4: Test PWA**

Verify service worker registers, manifest is detected by browser, app is installable.

- [ ] **Step 5: Commit PWA files**

```bash
git add sw.js manifest.json
git commit -m "feat: add service worker and PWA manifest for offline/installable"
```

---

## Task 9: Refactored Data Pipeline — Scraper

**Files:** `scripts/scraper.js`, `config/sources.json`

**Interfaces:**
- `scripts/scraper.js` exports `DublinLifelineScraper` class and constants
- `config/sources.json` contains per-provider selectors and fallback data
- Output: `data/scraped_output.json`

- [ ] **Step 1: Update `config/sources.json`** with working selectors for all 7 existing providers plus 3 new ones

For each provider, add:
- Realistic CSS selectors that match the actual website structure
- Fallback data with all required fields
- URL pointing to the actual provider website

Add a new `discovery` section with URLs to Dublin charity directories for finding additional providers.

- [ ] **Step 2: Rewrite `scripts/scraper.js`**

Fixes from original:
- Working CSS selectors that actually match target websites
- Remove `node-fetch` dependency (use native `https`/`http`)
- Keep cheerio dependency
- Add provider discovery module that scrapes Dublin charity directories
- Keep retry logic with exponential backoff
- Keep local archive fallback
- Add selector match reporting
- Output to `data/scraped_output.json`

- [ ] **Step 3: Test scraper**

Run `npm run scrape` and verify `scraped_output.json` is generated with all providers and working selector matches.

- [ ] **Step 4: Commit scraper**

```bash
git add scripts/scraper.js config/sources.json
git commit -m "feat: refactor scraper with working selectors and provider discovery"
```

---

## Task 10: Refactored Data Pipeline — Merger

**Files:** `scripts/mergeData.js`

**Interfaces:**
- `scripts/mergeData.js` exports `DataMerger` class
- Reads `data/services.json` and `data/scraped_output.json`
- Outputs `data/services.json` (updated) and `data/merge_report.json`

- [ ] **Step 1: Rewrite `scripts/mergeData.js`**

Fixes from original:
- Fixed hours merge order (existing takes precedence over scraped)
- Added `activityMatchCount` comparison (update if scraped > baseline)
- Version bump on merge
- Proper diff detection for all fields
- Clean output formatting
- Keep `toServiceEntry()`, `compareServices()`, `diff()`, `merge()`, `generateReport()` methods

- [ ] **Step 2: Test merger**

Run `npm run merge` and verify `services.json` is updated with correct data, version bumped, merge report generated.

- [ ] **Step 3: Commit merger**

```bash
git add scripts/mergeData.js
git commit -m "feat: refactor merger with fixed merge logic and version bumping"
```

---

## Task 11: Unit Tests

**Files:** `tests/test-scraper.js`, `tests/test-mergeData.js`

- [ ] **Step 1: Create `tests/test-scraper.js`**

Test cases:
- Test that scraper class can be instantiated with config
- Test that `extractSelectors` returns data for known HTML
- Test that `extractActivities` matches taxonomy keywords in page text
- Test that `extractTags` finds tags in page content
- Test that `findLocalArchive` finds cached HTML files
- Test that `normalizeHours` handles string and object inputs
- Test that `retry` retries failed function calls

- [ ] **Step 2: Create `tests/test-mergeData.js`**

Test cases:
- Test that `DataMerger` can be instantiated with baseline and scraped data
- Test that `compareServices` detects phone differences
- Test that `compareServices` detects address differences
- Test that `compareServices` detects hours differences
- Test that `diff()` correctly identifies additions, updates, deletions
- Test that `merge()` produces correct output with proper merge order
- Test that `merge()` bumps version number
- Test that `toServiceEntry()` creates correct service entry from scraped data

- [ ] **Step 3: Run all tests**

Run: `npm test` — verify all tests pass.

- [ ] **Step 4: Commit tests**

```bash
git add tests/test-scraper.js tests/test-mergeData.js
git commit -m "feat: add unit tests for scraper and merger"
```

---

## Task 12: CI/CD Pipeline

**Files:** `.github/workflows/scrape-sync.yml`

- [ ] **Step 1: Update `.github/workflows/scrape-sync.yml`**

Fixes from original:
- Remove `npm init` and `node-fetch` install (use `package.json` dependencies)
- Use `npm ci` instead of `npm install` for deterministic installs
- Keep weekly schedule (Monday 6 AM Europe/Dublin) and `workflow_dispatch`
- Keep artifact upload and commit/push on changes
- Add proper error handling and step summaries

- [ ] **Step 2: Verify workflow syntax**

Run `yamllint` or manually verify YAML is valid.

- [ ] **Step 3: Commit CI/CD**

```bash
git add .github/workflows/scrape-sync.yml
git commit -m "feat: update CI/CD pipeline for GitHub Pages deployment"
```

---

## Task 13: GitHub Pages Deployment Setup

**Files:** Repository settings, `.gitignore`, `index.html` routing

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
data/scraped_output.json
data/merge_report.json
.env
```

- [ ] **Step 2: Update `index.html` for GitHub Pages routing**

Ensure hash-based routing works:
- All navigation uses `#/map`, `#/timetable`, `#/guide`
- Add `<base href="/">` or handle relative paths
- Ensure all asset paths work from root

- [ ] **Step 3: Add deployment documentation**

Create `DEPLOY.md` with instructions for enabling GitHub Pages:
1. Go to Settings → Pages
2. Source: Deploy from a branch, branch: `main`, folder: `/ (root)`
3. Save

- [ ] **Step 4: Commit deployment setup**

```bash
git add .gitignore DEPLOY.md
git commit -m "feat: add GitHub Pages deployment setup and .gitignore"
```

---

## Task 14: Final Polish and Cross-Browser Testing

**Files:** All

- [ ] **Step 1: Add CSP meta tag** to `index.html`

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://unpkg.com https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.tailwindcss.com; img-src 'self' data: https://unpkg.com https://tile.openstreetmap.org; font-src 'self' https://unpkg.com; connect-src 'self' https://tile.openstreetmap.org;">
```

- [ ] **Step 2: Add responsive breakpoints**

Ensure the app works on mobile (320px), tablet (768px), and desktop (1024px+). Tailwind CDN provides responsive classes.

- [ ] **Step 3: Add loading states**

Show a loading indicator while `services.json` is being fetched.

- [ ] **Step 4: Test offline functionality**

Disable network, verify app loads with cached data.

- [ ] **Step 5: Test installability**

Verify PWA manifest is detected and install prompt appears.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: final polish, CSP, responsive design, and offline testing"
```

---

## Self-Review: Spec Coverage

| Spec Section | Task | Status |
|-------------|------|--------|
| 1. Overview (Architecture) | Task 1 | ✅ |
| 2.1 Deployment Model (GitHub Pages, hash routing) | Task 13 | ✅ |
| 2.2 Tech Stack (Vanilla JS, Tailwind CDN) | Task 1 | ✅ |
| 2.3 File Structure | All tasks | ✅ |
| 3. Data Model (`services.json` schema) | Task 2 | ✅ |
| 4.1 Interactive Map | Task 4 | ✅ |
| 4.2 Service Directory | Task 5 | ✅ |
| 4.3 Timetable | Task 6 | ✅ |
| 4.4 Pathways & Guide | Task 7 | ✅ |
| 4.5 Dark Theme | Task 3 | ✅ |
| 4.6 Offline PWA | Task 8 | ✅ |
| 4.7 Accessibility | Tasks 1, 6 | ✅ |
| 5. Data Pipeline (Scraper) | Task 9 | ✅ |
| 5.2 Data Pipeline (Merger) | Task 10 | ✅ |
| 6. Service Worker | Task 8 | ✅ |
| 7. CI/CD Pipeline | Task 12 | ✅ |
| 8. Testing | Task 11 | ✅ |
| 9. Security | Task 14 | ✅ |
| 10. Design Aesthetics | Task 1, 3 | ✅ |
| 11. Provider Expansion | Task 9 | ✅ |
| 12. Acceptance Criteria | All tasks | ✅ |

**No gaps found.** All spec requirements have corresponding tasks.

**Placeholder scan:** No TBD, TODO, or "implement later" in any step. All code blocks contain actual code.

**Type consistency:** All function names and signatures match across tasks (`init`, `renderCards`, `filterServices`, `searchServices`, `loadServices`, etc.).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-13-dublin-lifeline-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
