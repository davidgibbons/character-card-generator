# Phase 1: Build System + Service Layer - Research

**Researched:** 2026-03-26
**Domain:** Vite 8 + React 19 build system, ES module migration, Docker multi-stage build
**Confidence:** HIGH

## Summary

Phase 1 replaces the vanilla JS static-file architecture with a Vite 8 + React 19 build system, converts all window-global modules into ES module services (React hooks + Zustand stores), bundles CDN dependencies via npm, and updates the Dockerfile for multi-stage builds with Node 22-alpine. The Express backend is unchanged.

The existing codebase has no build step -- `index.html` loads 9 JS files via `<script>` tags and 2 CDN dependencies (diff, tributejs) from jsDelivr. The migration is a clean break: scaffold Vite + React, convert each module, remove the old files. The Express server already supports a `STATIC_ROOT` env var (line 87 of `proxy/server.js`) that can point to `dist/` with zero backend changes.

**Primary recommendation:** Scaffold Vite first with a minimal React entry point, verify Docker build works end-to-end, then convert modules one at a time into the new structure. The Docker build should be validated before any module conversion starts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Convert all existing JS modules directly into React hooks and Zustand stores -- skip the intermediate "pure ES module" step. Logic gets coupled to React from day 1.
- **D-02:** All module conversions happen in Phase 1 (not deferred to Phase 2). Phase 1 delivers both the Vite scaffold AND the full service layer conversion.
- **D-03:** Remove old vanilla JS files (src/scripts/*.js, original index.html with script tags) in Phase 1 after the Vite + React entry point is working. Clean break.
- **D-04:** Vite 8 + @vitejs/plugin-react for build tooling. Dev server on port 2427 proxying /api to Express on port 2426.
- **D-05:** Docker multi-stage build: npm run build -> Express serves dist/ in production. Node 22-alpine base image.
- **D-06:** npm scripts: `dev` (concurrent Vite + Express), `build` (Vite production build), `start` (Express only for production).

### Claude's Discretion
- Dev workflow port numbers (keep current 2427/2426 layout unless there's a reason to change)
- Exact Vite config details (proxy setup, build output dir)
- Migration order of individual modules (which to convert first)
- Whether to use Zustand or React Context for specific stores (Zustand recommended for streaming state; Context acceptable for static config)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-01 | Project builds with Vite and serves a React application entry point | Vite 8.0.3 + @vitejs/plugin-react 6.0.1 scaffold; new `index.html` with `<div id="root">` + `<script type="module" src="/src/main.jsx">` |
| BUILD-02 | Vite dev server proxies `/api` requests to Express backend on port 2426 | Vite `server.proxy` config for `/api` and `/health` routes; port 2427 for Vite dev server |
| BUILD-03 | `npm run dev` starts both Vite dev server and Express proxy concurrently | `concurrently` already in project; scripts: `dev:proxy` + `dev:frontend` |
| BUILD-04 | `npm run build` produces production-ready static assets in `dist/` | `vite build` with `outDir: 'dist'`; verified Vite 8.0.3 current |
| BUILD-05 | Dockerfile updated with multi-stage build | Stage 1: build with full deps; Stage 2: copy dist/ + proxy only |
| BUILD-06 | Docker image uses Node 22-alpine for Vite 8 compatibility | Vite 8 requires Node 20.19+; Node 22-alpine avoids patch ambiguity |
| BUILD-07 | Single-container deployment preserved -- Express serves both API and built static files | `STATIC_ROOT=/app/dist` env var already supported in server.js line 87; needs SPA fallback route added |
| LIB-03 | diff and tributejs loaded from npm imports instead of jsDelivr CDN | `npm install diff tributejs`; import as ES modules; remove CDN script tags |
| LIB-04 | No CDN script dependencies remain -- all JS dependencies managed via npm | Google Fonts stays as CSS `<link>` (not a JS dependency); diff + tributejs moved to npm; no other CDN JS deps |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.0.3 | Build tool + dev server | ESM-native, Rolldown-powered, first-class React support, built-in dev proxy |
| @vitejs/plugin-react | 6.0.1 | React JSX transform via Oxc | v6 drops Babel dependency, faster transforms |
| react | 19.2.4 | UI framework | Latest stable; hooks + component model |
| react-dom | 19.2.4 | DOM rendering | Paired with React 19.2.4 |
| zustand | 5.0.12 | Client state management | ~1.2KB, no Provider wrapper, selector-based subscriptions avoid re-render issues with streaming state |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| diff | 8.0.4 | Text diffing | Card history/diff view (replaces CDN) |
| tributejs | 5.1.3 | @mention autocomplete | Concept textarea mentions (replaces CDN); temporary until react-mentions in Phase 3 |
| concurrently | 9.2.1 | Run Vite + Express in parallel | Dev only; already in project (upgrade from 8.2.2) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | React Context + useReducer | Context causes re-renders on streaming state updates; Zustand's selectors avoid this. User decision locks Zustand. |
| CSS Modules | Tailwind CSS | Existing CSS design system works; CSS Modules preserve it with zero rewrite. Out of scope per project constraints. |

**Installation:**
```bash
# Core (root package.json)
npm install react react-dom zustand diff tributejs

# Dev dependencies
npm install -D vite @vitejs/plugin-react
```

**Version verification:** All versions confirmed via `npm view` on 2026-03-26. React 19.2.4 (newer than research doc's 19.2.1), Zustand 5.0.12, diff 8.0.4 (newer than current CDN 7.0.0 -- check API compatibility).

**diff version note:** The CDN currently loads diff@7.0.0. The latest npm version is 8.0.4. The `Diff` global API may have changed between v7 and v8. The existing code references `Diff.diffWords`, `Diff.diffSentences`, `Diff.diffLines` -- verify these still exist in v8. If breaking changes, pin to `diff@7.0.0` for this phase.

## Architecture Patterns

### Recommended Project Structure (Phase 1 end state)

```
/
├── index.html                  # NEW: Vite entry HTML (minimal: div#root + module script)
├── vite.config.js              # NEW: Vite config with proxy + build settings
├── package.json                # UPDATED: new deps, new scripts
├── package-lock.json           # UPDATED
├── .dockerignore               # NEW: node_modules, dist, .git
├── Dockerfile                  # UPDATED: multi-stage build
├── docker-compose.yml          # UPDATED: if needed
├── favicon.png
├── src/
│   ├── main.jsx                # NEW: React entry point (createRoot, App mount)
│   ├── App.jsx                 # NEW: Minimal shell (placeholder for Phase 2 components)
│   ├── styles/
│   │   ├── globals.css         # RENAMED from main.css: global CSS vars, resets, theme
│   │   └── tribute.css         # NEW: local copy of tributejs CSS (or import from node_modules)
│   ├── stores/                 # NEW: Zustand stores
│   │   ├── configStore.js      # Config/settings state (from config.js)
│   │   └── generationStore.js  # Generation status state (placeholder for Phase 3)
│   ├── services/               # NEW: Non-React business logic (ES modules)
│   │   ├── api.js              # HTTP client, streaming (from window.apiHandler)
│   │   ├── characterGenerator.js  # Generation orchestration (from window.characterGenerator)
│   │   ├── imageGenerator.js   # Image generation (from window.imageGenerator)
│   │   ├── pngEncoder.js       # PNG metadata (from window.pngEncoder) -- pure utility
│   │   ├── storage.js          # Card/prompt REST client (from window.characterStorage)
│   │   └── prompts.js          # Prompt registry (from window.getPrompt)
│   ├── hooks/                  # NEW: React hooks wrapping services
│   │   ├── useApi.js           # Hook for API calls with abort/streaming
│   │   ├── useConfig.js        # Hook for config store access
│   │   └── useCharacterGenerator.js  # Hook for generation flow
│   └── scripts/                # DELETED: old vanilla JS files removed
├── proxy/                      # UNCHANGED
│   ├── server.js
│   ├── cards.js
│   ├── prompts.js
│   ├── package.json
│   └── package-lock.json
└── dist/                       # BUILD OUTPUT (gitignored)
```

### Pattern 1: Service Module (non-React ES module)

**What:** Convert window-global classes to ES module exports. Strip `window.x = new X()`. Export the class or a singleton instance.
**When to use:** For all business logic modules (api, character-generator, image-generator, png-encoder, storage, prompts).

```javascript
// src/services/api.js
// Was: class APIHandler { ... } window.apiHandler = new APIHandler();
// Now:
class APIHandler {
  // Same class body, but reads config from Zustand store import
  // instead of window.config
}

export const apiHandler = new APIHandler();
export default apiHandler;
```

### Pattern 2: Zustand Store (replaces Config class)

**What:** Convert the Config class's state management into a Zustand store with localStorage/sessionStorage persistence.
**When to use:** For config.js (the only module that manages persistent UI state in Phase 1).

```javascript
// src/stores/configStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useConfigStore = create(
  persist(
    (set, get) => ({
      api: {
        text: { baseUrl: '', apiKey: '', model: '', timeout: 180000 },
        image: { baseUrl: '', apiKey: '', model: '', size: '' },
      },
      theme: 'dark',
      contentPolicy: false,
      // ... other settings

      updateSetting: (path, value) => {
        // Supports nested dot-notation paths like 'api.text.baseUrl'
        set((state) => {
          const keys = path.split('.');
          const newState = { ...state };
          let obj = newState;
          for (let i = 0; i < keys.length - 1; i++) {
            obj[keys[i]] = { ...obj[keys[i]] };
            obj = obj[keys[i]];
          }
          obj[keys[keys.length - 1]] = value;
          return newState;
        });
      },
    }),
    {
      name: 'charGeneratorConfig', // localStorage key
      // API keys go to sessionStorage, handled separately
    }
  )
);

export default useConfigStore;
```

### Pattern 3: Minimal React Shell (Phase 1 placeholder)

**What:** A bare-minimum React app that proves the build works. Components come in Phase 2+.
**When to use:** Phase 1 only -- this is a scaffold, not the final UI.

```jsx
// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// src/App.jsx
export default function App() {
  return (
    <div className="container">
      <h1>Character Generator</h1>
      <p>React + Vite build working. UI components coming in Phase 2.</p>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Importing window globals in services:** Services must import each other via ES imports, never access `window.config` or `window.apiHandler`. This is the whole point of the migration.
- **Putting business logic in React components:** Services contain the logic. Hooks call services. Components call hooks. Do not move fetch/streaming/parsing logic into component bodies.
- **Coupling services to React:** Service modules (`src/services/`) must NOT import from React. They are plain JS. Only hooks (`src/hooks/`) bridge between services and React.
- **Keeping both old and new entry points:** Phase 1 ends with the old `index.html` (with script tags) deleted and replaced by the Vite-powered `index.html`. No parallel running.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dev server proxy | Custom middleware to forward /api calls | Vite `server.proxy` config | Battle-tested, handles WebSocket upgrades, SSE streaming, error forwarding |
| Concurrent dev processes | Shell scripts with `&` and PID management | `concurrently` npm package | Already in project; handles exit codes, color-coded output, kill-on-exit |
| CSS scoping | BEM naming conventions or runtime CSS-in-JS | CSS Modules (built into Vite) | Zero config, zero runtime, automatic scoping |
| localStorage state persistence | Manual load/save in useEffect | Zustand `persist` middleware | Handles serialization, versioning, storage selection |
| Hot module replacement | File watcher + page reload | Vite HMR (built-in) | Sub-50ms updates, preserves React state across edits |

## Common Pitfalls

### Pitfall 1: Vite Proxy Is Dev-Only -- Production 404s

**What goes wrong:** Vite's `server.proxy` does not exist after `vite build`. API calls return 404 in Docker.
**Why it happens:** Vite is a dev tool, not a production server. The built `dist/` is static files.
**How to avoid:** Express already serves static files via `STATIC_ROOT`. Set `STATIC_ROOT=/app/dist` in Docker. Must also add a SPA fallback catch-all route to Express for client-side routing (even though this app has none yet, it prevents 404 on page refresh at non-root paths).
**Warning signs:** Works in `npm run dev`, fails in Docker.

### Pitfall 2: Missing SPA Fallback in Express

**What goes wrong:** Express serves `dist/` as static files but has no catch-all for `index.html`. Since the app is a SPA, any direct browser navigation to a non-file path returns 404.
**Why it happens:** The current server has no `sendFile` fallback because the old architecture is a single `index.html` at root. With Vite's build output, the HTML file is in `dist/` and may not be at the path the browser expects.
**How to avoid:** Add a catch-all AFTER all API routes in Express:
```javascript
// After all /api routes, before error handler
app.get('*', (req, res) => {
  res.sendFile(path.join(staticRoot, 'index.html'));
});
```
**Warning signs:** Page loads on `/` but 404 on browser refresh.

### Pitfall 3: Docker Image Bloated With Dev Dependencies

**What goes wrong:** Single-stage Dockerfile includes React, Vite, and all dev `node_modules` in the final image (~200MB+ extra).
**Why it happens:** `npm ci` installs everything. Without multi-stage, dev deps persist.
**How to avoid:** Two-stage Dockerfile: Stage 1 builds; Stage 2 copies only `dist/` and `proxy/` with production deps.
**Warning signs:** Final image >300MB (current is ~150MB).

### Pitfall 4: diff@8 API Breaking Changes vs diff@7

**What goes wrong:** Current CDN loads `diff@7.0.0`. Latest npm is `diff@8.0.4`. The existing code uses `Diff.diffWords()`, `Diff.diffSentences()`, `Diff.diffLines()` via the global `Diff` object. Major version bump may have breaking API changes.
**Why it happens:** CDN pins exact version; npm install gets latest.
**How to avoid:** Either pin `diff@7.0.0` in package.json, or verify the v8 API is backward-compatible for the methods used. The import syntax also changes from global `Diff` to named imports: `import { diffWords, diffSentences, diffLines } from 'diff'`.
**Warning signs:** Card diff view throws "X is not a function" errors.

### Pitfall 5: Config Server-Merge Race Condition

**What goes wrong:** The current `Config` class has a `loadConfig()` that calls `waitForConfig()` which fetches server-side defaults. If the Zustand store initializes from localStorage before the server fetch completes, server defaults are ignored. If the server fetch overwrites localStorage values, user settings are lost.
**How to avoid:** Initialize the Zustand store with localStorage values immediately (fast), then merge server config as a secondary step. Server config provides defaults only for keys not already set by the user. This matches the current behavior in the Config class.
**Warning signs:** Settings reset to defaults on page load, or server-provided defaults never appear.

### Pitfall 6: Tributary CSS Must Be Imported Explicitly

**What goes wrong:** Tribute.js requires its CSS file for the dropdown menu styling. Currently loaded from CDN as a `<link>` tag. When bundled via npm, the CSS must be explicitly imported.
**How to avoid:** Import tribute CSS in the component or entry point: `import 'tributejs/dist/tribute.css'`. Vite handles CSS imports natively.
**Warning signs:** @mention dropdown appears but is invisible or unstyled.

## Code Examples

### Vite Config

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 2427,
    proxy: {
      '/api': {
        target: 'http://localhost:2426',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:2426',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

### Multi-Stage Dockerfile

```dockerfile
# ── Stage 1: Build ─────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────
FROM node:22-alpine

RUN apk add --no-cache git
WORKDIR /app

# Install proxy deps only
COPY proxy/package*.json ./proxy/
RUN cd proxy && npm ci --only=production

# Copy proxy source
COPY proxy/ ./proxy/

# Copy built frontend from stage 1
COPY --from=build /app/dist ./dist

# Copy static assets needed at root
COPY favicon.png ./dist/

ENV NODE_ENV=production
ENV PORT=2426
ENV STATIC_ROOT=/app/dist
ENV DATA_DIR=/data

EXPOSE 2426

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:2426/health || exit 1

CMD ["node", "proxy/server.js"]
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:proxy\" \"npm run dev:frontend\"",
    "dev:proxy": "cd proxy && npx nodemon server.js",
    "dev:frontend": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "cd proxy && node server.js"
  }
}
```

### New Vite Entry index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SillyTavern Character Generator</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### Service Module Conversion Pattern

```javascript
// src/services/storage.js
// Converted from: src/scripts/storage-server.js (window.characterStorage)

class StorageClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async listCards() {
    const response = await fetch(`${this.baseUrl}/cards`);
    if (!response.ok) throw new Error(`Failed to list cards: ${response.statusText}`);
    return response.json();
  }

  async getCard(name) {
    const response = await fetch(`${this.baseUrl}/cards/${encodeURIComponent(name)}`);
    if (!response.ok) throw new Error(`Failed to get card: ${response.statusText}`);
    return response.json();
  }

  // ... remaining CRUD methods
}

export const storageClient = new StorageClient();
export default storageClient;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| http-server for dev | Vite dev server | Phase 1 | HMR, proxy, no manual cache-busting |
| CDN script tags | npm + ES imports | Phase 1 | Bundled, tree-shaken, version-locked |
| window globals | ES module imports | Phase 1 | Explicit dependency graph, no load-order bugs |
| No build step | Vite build | Phase 1 | Production-optimized bundles, code splitting |
| node:20-alpine | node:22-alpine | Phase 1 | Required for Vite 8 compatibility |
| Single-stage Docker | Multi-stage Docker | Phase 1 | Smaller production image, no dev deps in prod |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite 8, React build | Yes | 20.20.1 | Dev machine OK; Docker uses node:22-alpine |
| Docker | Production build | Yes | 28.5.2 | -- |
| npm | Package management | Yes | (bundled with Node) | -- |
| Git | Card storage (proxy) | Yes | (system) | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Open Questions

1. **diff v7 vs v8 API compatibility**
   - What we know: CDN loads diff@7.0.0, npm latest is 8.0.4. Code uses `Diff.diffWords`, `Diff.diffSentences`, `Diff.diffLines`.
   - What's unclear: Whether v8 has breaking changes to these specific methods.
   - Recommendation: Pin `diff@7.0.0` initially for safe migration; upgrade to v8 separately after verifying.

2. **SPA fallback in Express**
   - What we know: Express has no catch-all `sendFile` route. The current static-file-only approach works because everything is at root.
   - What's unclear: Whether any future phase needs client-side routing (currently none).
   - Recommendation: Add a minimal catch-all after API routes as a defensive measure. Low cost, prevents future surprises.

3. **Config server-merge timing**
   - What we know: The current Config class has `loadConfig()` -> `waitForConfig()` that merges server defaults. Zustand `persist` middleware initializes synchronously from localStorage.
   - What's unclear: The exact merge semantics for the async server config fetch.
   - Recommendation: Initialize store from localStorage immediately; fetch server config and merge defaults for unset keys only. This preserves user settings while still applying server defaults on first use.

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement:** Do not make direct repo edits outside a GSD workflow unless user explicitly asks to bypass.
- **Backend unchanged:** Express proxy server (`proxy/`) stays CommonJS Node.js -- only frontend migrates.
- **No new features:** This is a refactor milestone, not a feature milestone.
- **Feature parity:** Every existing capability must work after migration.
- **Single Docker container:** Serving both API and static assets.
- **Commit approval:** Always ask for user approval before committing/pushing (from memory).

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`) -- verified versions for vite 8.0.3, @vitejs/plugin-react 6.0.1, react 19.2.4, zustand 5.0.12, diff 8.0.4, tributejs 5.1.3, concurrently 9.2.1
- `proxy/server.js` line 87 -- `STATIC_ROOT` env var confirmed
- Existing `Dockerfile` -- current single-stage structure understood
- Existing `package.json` -- current scripts and dependencies documented

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` -- prior research on Vite 8, React 19, Zustand 5 (versions slightly stale, corrected above)
- `.planning/research/ARCHITECTURE.md` -- component boundary and service layer patterns
- `.planning/research/PITFALLS.md` -- comprehensive pitfall catalog

### Tertiary (LOW confidence)
- diff v7 -> v8 migration: API compatibility not verified; pinning v7 recommended

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all versions verified via npm registry on 2026-03-26
- Architecture: HIGH - patterns derived from existing codebase analysis + prior research
- Pitfalls: HIGH - well-documented in prior research, cross-verified with codebase

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack, no fast-moving dependencies)
