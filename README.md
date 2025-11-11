## Digit Plan Monorepo

TypeScript monorepo containing:
- Chrome Extension (MV3) built with Vite + React
- Backend (Express) serverless-friendly HTTP API
- Shared types and rules

### Workspaces

- `extension/` Chrome extension sources
- `backend/` Express API
- `shared/` Shared models and utilities

### Prerequisites

- Node.js 20+

### Install

```bash
npm ci
```

### Develop

Backend dev server:

```bash
npm run dev -w backend
```

Build extension for loading in Chrome:

```bash
npm run build -w extension
```

### Tests

Unit tests:

```bash
npm test
```

E2E (Playwright, simple smoke):

```bash
npm run test:e2e -w extension
```

First time:

```bash
npx playwright install --with-deps
```

### Load the extension (Developer Mode)

1. Build: `npm run build -w extension`
2. Open Chrome → Settings → Extensions → enable Developer Mode
3. Load unpacked → select `extension/dist`

### Features

- Popup: ICP form (country, sectors, size min/max, roles, excludes, signals). Persists to `chrome.storage.local`.
- Content scripts: detect LinkedIn, Google Maps, and generic websites; extract minimal prospect info.
- Injected widget: shows prospect name and score with a “Score ICP” button.
- Backend API: `/score` (uses ICP + prospect), `/enrich`, `/summarize` (stubs).

### CI

GitHub Actions workflow builds, type-checks, tests, and uploads a zipped extension artifact.

np