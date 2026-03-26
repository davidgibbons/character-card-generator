# Technology Stack

**Project:** Character Card Generator -- Vanilla JS to React/Vite Migration
**Researched:** 2026-03-26

## Recommended Stack

### Build System

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vite | ^8.0.3 | Build tool + dev server | ESM-native, Rolldown-powered builds (10-30x faster than Webpack), first-class React support, built-in dev proxy for Express backend. The project already decided on Vite. | HIGH |
| @vitejs/plugin-react | ^6.0.1 | React JSX transform | v6 uses Oxc instead of Babel -- smaller install, faster transforms. Babel no longer required as a dependency. | HIGH |

**Vite 8 requires Node.js 20.19+ or 22.12+.** The project already uses `node:20-alpine` in Docker, which satisfies this. Verify the exact Alpine Node 20 patch version includes 20.19+; if not, bump to `node:22-alpine`.

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | ^19.2.1 | UI framework | Latest stable. React 19.2 is production-ready. Hooks + component model replaces the 1500-line monolithic `main.js`. | HIGH |
| React DOM | ^19.2.1 | DOM rendering | Paired with React 19.2.1. | HIGH |

This is a single-page app with tabs, not a multi-page router-driven app. **Do NOT add React Router.** The existing tab-switching UI maps to conditional rendering with state, not URL routing.

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | ^5.0.8 | Client state management | ~1.2KB, no Provider wrapper, no boilerplate. The app has 3 clear state domains (config/settings, current character, generation status) that map directly to Zustand stores. ~20M weekly downloads, the default choice for React in 2026. | HIGH |

**Store structure for this app:**

```
useConfigStore     -- API settings, theme, content policy toggle (mirrors current Config class)
useCharacterStore  -- Current character data, parsed fields, edit state
useGenerationStore -- Generation status, streaming state, progress
useLibraryStore    -- Card/prompt library browsing, selection state
```

**Why NOT other options:**

| Alternative | Why Not |
|-------------|---------|
| Redux Toolkit | Overkill for this app's complexity. Zustand provides the same patterns with less ceremony. |
| React Context | Fine for theme/config, but causes unnecessary re-renders for frequently-changing state (streaming, generation progress). Zustand's selector-based subscriptions avoid this. |
| Jotai | Atomic model is better for highly interconnected state. This app has clearly bounded domains that map better to Zustand stores. |
| Signals (Preact/Angular) | Not native React. Would require additional library and doesn't integrate with React DevTools. |

### CSS Approach

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| CSS Modules | (built into Vite) | Scoped component styles | Zero additional dependencies. The existing `main.css` already uses CSS custom properties for theming -- these stay in a global `:root` stylesheet. Component-specific styles get extracted into `.module.css` files. No new utility class system to learn; same CSS the project already uses, just scoped. | HIGH |

**Migration path:**

1. Keep `src/styles/globals.css` with `:root` custom properties, resets, and theme definitions (dark/light mode variables)
2. Each React component gets a co-located `.module.css` file
3. Import as `import styles from './Component.module.css'` and use `className={styles.sectionCard}`
4. Vite handles scoping automatically -- no config needed

**Why NOT Tailwind CSS:**
- The project has a mature, working CSS design system using custom properties. Rewriting ~1500 lines of CSS into utility classes adds migration scope with zero functional benefit.
- This milestone is explicitly a refactor, not a redesign. CSS Modules preserve the existing visual design with minimal changes.

**Why NOT styled-components / CSS-in-JS:**
- Runtime style generation adds overhead. CSS Modules are zero-runtime.
- styled-components is in maintenance decline (no major releases since 2023).

### PNG Metadata

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| png-chunk-text | ^1.0.0 | Create/parse tEXt chunks | Mature, browser-compatible, purpose-built for exactly what this app does (tEXt chunk read/write). Used in combination with png-chunks-extract and png-chunks-encode. | MEDIUM |
| png-chunks-extract | ^1.0.0 | Extract chunks from PNG buffer | Companion to png-chunk-text. Parses a PNG Uint8Array into its constituent chunks. | MEDIUM |
| png-chunks-encode | ^1.0.0 | Encode chunks back to PNG | Companion to png-chunk-text. Reassembles chunks into a valid PNG buffer. | MEDIUM |

**How this replaces the hand-rolled encoder:**

The current `PNGEncoder` class (660 lines) manually implements:
- PNG signature verification
- Chunk parsing/iteration
- tEXt chunk creation with CRC32
- IHDR/IDAT/IEND chunk creation (fallback path)
- Deflate compression via CompressionStream

The png-chunks trio replaces the chunk parsing, creation, and encoding. The tEXt chunk with keyword `chara` and base64-encoded JSON is the SillyTavern V2 character card standard. The replacement looks like:

```javascript
import extractChunks from 'png-chunks-extract';
import encodeChunks from 'png-chunks-encode';
import text from 'png-chunk-text';

// Write metadata
const chunks = extractChunks(pngBuffer);
const filtered = chunks.filter(c => !(c.name === 'tEXt' && /* is chara */));
filtered.splice(-1, 0, text.encode('chara', base64Json)); // before IEND
const newPng = encodeChunks(filtered);

// Read metadata
const chunks = extractChunks(pngBuffer);
const textChunk = chunks.find(c => c.name === 'tEXt');
const { keyword, text: data } = text.decode(textChunk.data);
```

**Why NOT meta-png:**
- Last published 3 years ago (v1.0.6). Low download count. The png-chunks trio is more established and better documented.
- meta-png uses a higher-level API that obscures chunk-level control, which this app needs for the `chara` keyword convention.

**Why NOT a full PNG library (pngjs):**
- pngjs is Node.js-focused, not browser-native. The png-chunks packages work with raw Uint8Array in the browser.

**Confidence note:** MEDIUM because these packages are older (last npm publish ~2018-2019) but stable -- PNG spec doesn't change. Verify browser ESM import compatibility during implementation; may need a thin wrapper.

### LLM Response Parsing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom section parser (no library) | N/A | Parse markdown-sectioned LLM output | The parsing problem is domain-specific: extract named sections from markdown-formatted LLM responses. No general-purpose library solves this better than a clean utility function. | HIGH |

**Rationale for NOT using a library:**

The current parsing is not complex enough to warrant a library. The `parseScenarioData` method already demonstrates the clean pattern:

```javascript
const extractSection = (sectionName, text) => {
  const pattern = new RegExp(`##\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
};
```

The real problem is that `parseCharacterData` uses inconsistent, fragile regex patterns (e.g., `'s Profile` suffix matching, `The name's` heuristic). The fix is:

1. **Standardize the LLM prompt output format** to always use `## Section Name` headers (the scenario parser already expects this)
2. **Write one generic `parseSections(text, schema)` utility** that takes a section-name-to-field mapping and returns a typed object
3. **Add validation** -- warn when expected sections are missing instead of silently returning empty strings

**Why NOT llm-exe or LangChain parsers:**
- These are designed for structured output (JSON) extraction, not markdown section splitting. They add heavy dependencies (LangChain is ~50+ packages) for a problem solved by 20 lines of utility code.
- The app controls the prompt templates, so it controls the output format. A library adds indirection without value.

### CDN Dependencies to Bundle

| Current CDN Dep | Replacement | Version | Notes |
|-----------------|-------------|---------|-------|
| diff (jsDelivr) | diff | ^7.0.0 | Install via npm, import as ES module. Already used for card diffing. |
| tributejs (jsDelivr) | tributejs | ^5.1.3 | Install via npm, import as ES module. Used for @mention autocomplete. Will need a React wrapper hook (useEffect + ref) since Tribute attaches to DOM elements. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| concurrently | ^8.2.2 | Run Vite dev + Express in parallel | Dev only. Already in project. |
| nodemon | ^3.0.1 | Auto-restart Express on changes | Dev only. Already in project. |

### Dev Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| eslint | ^9.x | Linting | Vite projects conventionally include ESLint. Use flat config format (eslint.config.js). |
| eslint-plugin-react-hooks | ^5.x | React hooks linting | Catches invalid hook usage (stale closures, conditional hooks). Essential for a migration from non-React code. |

## Vite Configuration

### Dev Proxy Setup

The existing architecture has the Express backend on port 2426 and a frontend dev server on port 2427. With Vite, the dev proxy replaces the separate `http-server`:

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
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

### Production Deployment

In production (Docker), Vite builds static assets to `dist/`. Express serves them:

```javascript
// In proxy/server.js (existing, add static serving of built assets)
app.use(express.static(path.join(__dirname, '../dist')));
// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
```

The Dockerfile adds a build step:

```dockerfile
# Build stage
RUN npm install && npm run build
# Runtime serves from dist/
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:proxy\" \"npm run dev:frontend\"",
    "dev:proxy": "cd proxy && nodemon server.js",
    "dev:frontend": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "cd proxy && node server.js"
  }
}
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | Vite 8 | Webpack 5 | Slower, more config, no advantage for this project |
| Build tool | Vite 8 | Turbopack | Next.js-coupled, not standalone |
| UI framework | React 19 | Svelte 5 | Smaller ecosystem, project already decided on React |
| UI framework | React 19 | Vue 3 | Either works; React chosen for largest ecosystem + hiring pool |
| State mgmt | Zustand 5 | Redux Toolkit | More boilerplate for same result at this scale |
| State mgmt | Zustand 5 | React Context | Re-render issues with streaming/generation state |
| CSS | CSS Modules | Tailwind CSS | Adds migration scope; existing CSS works, just needs scoping |
| CSS | CSS Modules | styled-components | Runtime overhead, declining maintenance |
| PNG metadata | png-chunks trio | Hand-rolled (current) | 660 lines of PNG spec reimplementation; fragile, hard to maintain |
| PNG metadata | png-chunks trio | meta-png | Stale (3yr), less control over chunk-level operations |
| LLM parsing | Custom utility | LangChain parsers | Massive dependency for 20 lines of utility code |
| Router | None | React Router 7 | App is a single-page tabbed UI, not a multi-route SPA |

## Installation

```bash
# Core
npm install react react-dom zustand

# PNG metadata
npm install png-chunks-extract png-chunks-encode png-chunk-text

# Bundle former CDN deps
npm install diff tributejs

# Dev dependencies
npm install -D vite @vitejs/plugin-react eslint eslint-plugin-react-hooks
```

## Node.js Version Requirement

Vite 8 requires Node.js 20.19+ or 22.12+. The Dockerfile should be updated:

```dockerfile
FROM node:22-alpine
```

Using Node 22 (current LTS) avoids any patch-version ambiguity with Node 20.

## Sources

- [Vite 8.0 Announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown bundler, Node.js requirements
- [Vite Server Options (proxy)](https://vite.dev/config/server-options) -- Dev proxy configuration
- [@vitejs/plugin-react npm](https://www.npmjs.com/package/@vitejs/plugin-react) -- v6.0.1, Oxc-based transforms
- [React Versions](https://react.dev/versions) -- React 19.2.1 stable
- [Zustand GitHub](https://github.com/pmndrs/zustand) -- v5.0.8, API documentation
- [png-chunk-text GitHub](https://github.com/hughsk/png-chunk-text) -- tEXt chunk read/write API
- [png-chunks-extract npm](https://www.npmjs.com/package/png-chunks-extract) -- chunk extraction
- [png-chunks-encode npm](https://www.npmjs.com/package/png-chunks-encode) -- chunk encoding
- [SillyTavern Character Management](https://deepwiki.com/SillyTavern/SillyTavern/5.1-character-management) -- tEXt chara chunk format
- [React State Management 2026](https://www.pkgpulse.com/blog/state-of-react-state-management-2026) -- Zustand as default choice
- [CSS Modules vs Tailwind 2026](https://frontend-hero.com/tailwind-vs-css-modules) -- CSS approach comparison

---

*Stack research: 2026-03-26*

