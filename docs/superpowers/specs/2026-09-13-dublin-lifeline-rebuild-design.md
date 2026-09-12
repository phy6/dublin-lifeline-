# Dublin Lifeline Directory — Rebuild Design Spec

> **Date:** 2026-09-13
> **Status:** Approved
> **Author:** Dublin Lifeline Pipeline
> **Classification:** Architectural

---

## 1. Overview

Full rebuild of the Dublin Lifeline Directory — a Progressive Web App (PWA) serving as a directory of essential community support providers in Dublin, Ireland. The rebuild replaces the existing codebase (v2.0.0) with a clean architecture, working selectors, expanded provider list, and deployable-to-GitHub-Pages static assets.

**Problem statement:** The existing app has broken CSS selectors (all data comes from fallbacks), security vulnerabilities (`report@localhost`), monolithic JS, no tests, and a data pipeline that doesn't properly merge or version data.

**Goal:** A polished, accessible, offline-capable PWA that can be installed on any device and deployed as static files to GitHub Pages.

---

## 2. Architecture

### 2.1 Deployment Model
- **Static site** served from GitHub Pages
- **Hash-based routing** (`/#/map`, `/#/directory`, `/#/timetable`, `/#/guide`) for SPA navigation without server-side support
- **PWA manifest** + **Service Worker** for installability and offline support
- **No backend** — all data lives in `data/services.json`

### 2.2 Tech Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| HTML | Vanilla HTML5 | No framework overhead |
| CSS | Tailwind CDN + custom CSS variables | Utility-first styling, dark theme via CSS variables |
| JS | Vanilla ES Modules | No build step, clean module separation |
| Maps | Leaflet.js + OpenStreetMap | Lightweight, works offline with cached tiles |
| PWA | Service Worker + Web App Manifest | Offline-first, installable |
| Build | None (CDN-based) | Deploy directly from repo |
| CI/CD | GitHub Actions | Weekly scrape + merge pipeline |

### 2.3 File Structure
```
dublin-lifeline/
├── index.html              # Single page app, hash routing
├── css/app.css             # Tailwind CDN link + custom styles
├── js/
│   ├── app.js              # Orchestrator, router, theme manager
│   ├── map.js              # Leaflet map, markers, GPS, map fallback
│   ├── directory.js        # Filter chips, cards, search, stats
│   ├── timetable.js        # Day/week/month grids, modal, schedule
│   ├── guide.js            # Accordions, pathways content
│   └── services.js         # Data layer: fetch, normalize, cache
├── data/
│   └── services.json       # Single source of truth
├── sw.js                   # Service worker (offline PWA)
├── manifest.json           # PWA install manifest
├── scripts/
│   ├── scraper.js          # Fixed selectors + provider discovery
│   └── mergeData.js        # Merges scraped + fallback → services.json
├── tests/
│   ├── test-scraper.js     # Scraper unit tests
│   └── test-mergeData.js   # Merger unit tests
├── .github/
│   └── workflows/
│       └── scrape-sync.yml # CI/CD pipeline
└── package.json            # Dependencies + scripts
```

---

## 3. Data Model

### 3.1 `services.json` Schema
```json
{
  "version": "3.0.0",
  "lastUpdated": "2026-09-13T00:00:00.000Z",
  "generatedBy": "Dublin Lifeline Pipeline",
  "services": [
    {
      "id": "unique-slug",
      "name": "Provider Name",
      "address": "Street, Dublin X",
      "phone": "+353-1-xxxx-xxx",
      "email": "info@provider.ie",
      "website": "https://provider.ie",
      "hours": { "mon-fri": "09:00-17:00", "sat": "09:00-13:00", "sun": "closed" },
      "tags": ["homeless", "food", "emergency"],
      "services": ["food", "shelter", "medical"],
      "category": "Emergency Shelter",
      "latitude": 53.3481,
      "longitude": -6.2758,
      "description": "Short description",
      "lastVerified": "2026-09-01T00:00:00.000Z"
    }
  ]
}
```

### 3.2 Provider Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique URL-friendly slug |
| `name` | string | Yes | Full provider name |
| `address` | string | Yes | Street address |
| `phone` | string | Yes | International format (+353-...) |
| `email` | string | No | Contact email |
| `website` | string | No | Full URL |
| `hours` | object | No | Day-to-hours mapping |
| `tags` | string[] | No | Classification tags for filtering |
| `services` | string[] | No | Service types offered |
| `category` | string | Yes | Primary category |
| `latitude` | number | Yes | Geo coordinate |
| `longitude` | number | Yes | Geo coordinate |
| `description` | string | No | Short description |
| `lastVerified` | string | Yes | ISO-8601 date of last verification |

---

## 4. Frontend Features

### 4.1 Interactive Map
- **Leaflet.js** with OpenStreetMap tiles
- Custom emoji markers (🍲 food, 🏠 shelter, 🩺 medical, 📚 education)
- Click marker → popup with provider name, address, phone, website
- GPS button → browser Geolocation API, sets view to user location
- Map fallback → message shown if tiles fail to load
- Card click → `centerOnMap()` with smooth scroll on mobile
- Map invalidation on tab switch and theme toggle

### 4.2 Service Directory
- **Filter chips** — All, Food, Shelter, Medical, Support, Community, Education
- **Search bar** — text search across provider names and descriptions
- **Card grid** — responsive grid (1 col mobile, 2 col desktop)
- Card shows: name, category, address, phone, website, hours, tags, services, last verified date
- Card actions: Call (tel:), Website (target=_blank), Map (center on provider)
- Report incorrect info link → mailto to verified contact
- Stats bar showing "Showing X of Y providers"

### 4.3 Timetable
- **Day view** — Today's schedule with provider names and hours
- **Week view** — 7-column grid, providers per day
- **Month view** — Calendar-style grid with events
- **Add schedule item** — Modal with date picker, service select, time picker
- Modal features: focus trap, Escape key close, click-outside close, aria-modal
- Schedule stored in **localStorage** (device-only, never sent to server)
- Auto-fill current time when service is selected

### 4.4 Pathways & Guide
- **Accordion sections**: Free Meals, Clothing/Hygiene, Housing, Mental Health, Libraries, System Pathways
- Each section lists relevant providers with name, address, phone, services, hours
- System Pathways section: DRHE, SWA, Urgent Needs Payment, Capuchin, MQI
- Smooth accordion animation with open/close state

### 4.5 Dark Theme
- CSS variables in `:root` and `[data-theme="dark"]`
- System preference detection via `prefers-color-scheme`
- Manual toggle via header button
- Preference persisted in `localStorage`
- Theme change triggers `map.invalidateSize()`

### 4.6 Offline PWA
- **Service Worker**: Cache-first strategy for static assets, network-first for `services.json`
- **Manifest**: `display: standalone`, proper icons (SVG), categories, lang, direction
- **Offline fallback**: If `services.json` fails to fetch, show cached data or message
- **Install prompt**: Standard PWA install banner

### 4.7 Accessibility
- Semantic HTML5 elements (`<main>`, `<nav>`, `<section>`, `<details>`)
- ARIA roles: `tablist`, `tab`, `tabpanel`, `dialog`, `aria-selected`, `aria-expanded`
- Keyboard navigation: Tab between tabs, Escape to close modal, Enter/Space for buttons
- Focus management in modal (trap focus, return focus on close)
- `noscript` fallback showing core services without JavaScript
- Color contrast meets WCAG AA standards

---

## 5. Data Pipeline

### 5.1 Scraper (`scripts/scraper.js`)
- **Fixed selectors** that actually match the target websites
- **Config-driven** via `config/sources.json` with per-provider selectors and fallbacks
- **Retry logic** with exponential backoff
- **Local archive fallback** — uses cached HTML files if live fetch fails
- **Activity extraction** — taxonomy-based keyword matching on page text
- **Provider discovery** — scrapes Dublin charity directories (e.g., Dublin Simon Community directory, Crosscare directory) to find additional providers
- **Output** — `data/scraped_output.json` with all extracted data and selector match status

### 5.2 Merger (`scripts/mergeData.js`)
- Reads `services.json` (baseline) and `scraped_output.json` (scraped)
- **Diff detection** — compares all fields (phone, address, hours, tags, services, category, coordinates)
- **Merge strategy** — existing data takes precedence, scraped data fills gaps
- **Version bump** — increments `services.json` version on merge
- **Output** — `data/services.json` (final), `data/merge_report.json` (diff report)

### 5.3 Config (`config/sources.json`)
- Per-provider config: `id`, `name`, `url`, `selectors`, `fallback`
- Global selectors for common fields
- Rate limiting and retry configuration
- Schedule configuration for CI/CD

---

## 6. Service Worker

### 6.1 Cache Strategy
- **Install event**: Cache all static assets + `services.json`
- **Activate event**: Clear old caches, claim clients
- **Fetch event**: Network-first for `services.json`, cache-first for static assets
- Stale-while-revalidate for `services.json` to balance freshness and offline capability

### 6.2 Offline Behavior
- If online: fetch `services.json`, update cache, show latest data
- If offline: serve cached `services.json`, show cached tiles from Leaflet
- Offline indicator shown in UI when no network connection

---

## 7. CI/CD Pipeline

### 7.1 GitHub Actions (`scrape-sync.yml`)
- **Schedule**: Weekly on Monday at 6:00 AM (Europe/Dublin)
- **Manual trigger**: `workflow_dispatch`
- **Steps**:
  1. Checkout repo
  2. Install dependencies (from `package.json`)
  3. Run scraper → `scraped_output.json`
  4. Run merger → `services.json` + `merge_report.json`
  5. If changes detected: commit and push
  6. Upload artifacts

### 7.2 Deployment
- GitHub Pages serves `index.html`, CSS, JS, and data files
- `index.html` at root serves as the SPA
- Hash routing ensures deep links work without server configuration

---

## 8. Testing

### 8.1 Unit Tests
- **Scraper tests**: Verify selector matching, activity extraction, fallback behavior
- **Merger tests**: Verify diff detection, merge logic, version bumping
- **Frontend tests**: Basic DOM manipulation and data rendering

### 8.2 Test Framework
- **Node.js built-in** assert module (no external dependencies)
- Test files in `tests/` directory
- Run via `npm test`

---

## 9. Security

### 9.1 Fixes from Original
- Replace `report@localhost` with verified contact email
- Add `Content-Security-Policy` meta tag in `index.html`
- Proper input sanitization in modal form
- Service worker does not cache sensitive data files
- HTTPS enforcement for all external resources

### 9.2 Data Privacy
- GPS location stays on device only (browser Geolocation API)
- Scheduled appointments stored in localStorage only
- No telemetry or analytics

---

## 10. Design Aesthetics

### 10.1 Dark Theme (Default)
- Background: `#0d1117`
- Panel: `#151b23`
- Text: `#f4f7fa`
- Accent: `#62a8ff`
- Danger: `#ff6d7a`
- Cards with subtle borders and shadows

### 10.2 Typography
- System font stack (system-ui, -apple-system, Segoe UI, Roboto)
- 16px base, 1.4 line height
- Bold headings, muted secondary text

### 10.3 Components
- Rounded cards (14px border-radius)
- Pill-shaped filter chips
- Sticky emergency banner at top
- Smooth transitions on tab switches

---

## 11. Provider Expansion Strategy

### 11.1 Discovery Pipeline
- Scrape Dublin charity directories (Dublin Simon, Crosscare, Focus Ireland directories)
- Parse "services we provide" sections to find new providers
- Cross-reference with existing providers to avoid duplicates
- Output discovered providers to a separate `data/candidates.json` for manual review

### 11.2 Manual Curation
- New providers added to `config/sources.json` with fallback data
- Verified via web scraping and manual review
- Quality gates before adding to `services.json`

---

## 12. Acceptance Criteria

- [ ] App deploys to GitHub Pages as static site
- [ ] PWA installable on mobile and desktop
- [ ] Works offline with cached data
- [ ] Map displays all providers with interactive markers
- [ ] Directory filters and searches providers correctly
- [ ] Timetable shows day/week/month views with addable schedule items
- [ ] Guide sections contain accurate pathway information
- [ ] Dark theme works correctly with system preference detection
- [ ] All CSS selectors in scraper match live websites
- [ ] Unit tests pass for scraper and merger
- [ ] CI/CD pipeline runs successfully
- [ ] No console errors on load
- [ ] Keyboard navigable throughout the app
- [ ] `noscript` fallback shows core services

---

## 13. Out of Scope

- Real-time notifications
- User accounts / authentication
- Multi-language support
- Advanced analytics / usage tracking
- Integration with government APIs
- Mobile app stores (App Store / Play Store) — PWA install covers this
