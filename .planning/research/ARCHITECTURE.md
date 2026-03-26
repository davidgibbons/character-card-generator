# Architecture Patterns

**Domain:** Vanilla JS to React/Vite migration (SPA with Express proxy backend)
**Researched:** 2026-03-26

## Recommended Architecture

```
Development:
  Vite Dev Server (port 5173) --proxy /api/*--> Express Backend (port 2426)
       |                                              |
  React SPA (HMR)                             API proxy routes
                                              Card/Prompt CRUD (git-backed)

Production (Docker):
  Express (port 2426)
       |
       ├── express.static("dist/")  -->  Vite-built React SPA
       └── /api/*                   -->  Proxy routes, CRUD routes
```

**Key invariant:** The Express backend is unchanged. Only the frontend migrates. In production, Express serves the Vite `dist/` output as static files, exactly as it currently serves `index.html` + `src/`.

### Vite Dev Server Proxy Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.', // project root (where index.html lives)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
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
});
```

**Confidence:** HIGH -- Vite's `server.proxy` uses `http-proxy` under the hood. The `/api` prefix catch-all matches every backend route (`/api/text/*`, `/api/image/*`, `/api/cards/*`, `/api/prompts/*`, `/api/st/*`, `/api/proxy-image`). No `rewrite` needed because Express already mounts routes at `/api/*`.

### Production Build Integration

The Dockerfile changes are minimal:

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git

WORKDIR /app

# Install frontend dependencies and build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # vite build -> dist/

# Install proxy dependencies
RUN cd proxy && npm ci --only=production

ENV NODE_ENV=production
ENV PORT=2426
ENV STATIC_ROOT=/app/dist

EXPOSE 2426
CMD ["node", "proxy/server.js"]
```

Express already reads `STATIC_ROOT` env var (line 87 of `proxy/server.js`): `const staticRoot = process.env.STATIC_ROOT || path.join(__dirname, "..");`. Setting `STATIC_ROOT=/app/dist` makes Express serve the Vite build output with zero backend changes.

**Confidence:** HIGH -- verified from the existing `server.js` source code. The `STATIC_ROOT` env var is already built for this exact purpose.

---

## Component Boundaries

### Layer 1: Services (non-React, pure logic)

These are the current window-global modules converted to ES modules. They contain no UI logic and no React dependencies. They export functions/classes that React hooks and components consume.

| Service Module | Current Global | Responsibility | Depends On |
|----------------|---------------|----------------|------------|
| `api.ts` | `window.apiHandler` | HTTP client, streaming SSE, abort control | `config` service |
| `config.ts` | `window.config` | Settings read/write (localStorage/sessionStorage) | None |
| `character-generator.ts` | `window.characterGenerator` | Generation orchestration, LLM response parsing | `api` service |
| `image-generator.ts` | `window.imageGenerator` | Image prompt generation + image API calls | `api`, `config` services |
| `png-encoder.ts` | `window.pngEncoder` | PNG metadata embedding (V2 character cards) | `config` service |
| `storage.ts` | `window.characterStorage` | REST client for card/prompt CRUD | None |
| `prompts.ts` | `window.getPrompt` | Prompt template registry + overrides | None |

**Migration approach:** Strip the `window.` assignments, convert to ES module exports, keep the class structure. These become importable services, not React code.

### Layer 2: Custom Hooks (React, state + side effects)

Hooks bridge services to React's state model. Each hook owns a specific domain of state.

| Hook | Consumes Service(s) | State Owned | Used By |
|------|---------------------|-------------|---------|
| `useConfig()` | `config.ts` | Settings object, theme | Settings panel, API status |
| `useCharacterGeneration()` | `character-generator.ts`, `api.ts` | Current character, generation status, streaming text, abort | Create panel, Editor panel |
| `useImageGeneration()` | `image-generator.ts`, `api.ts` | Image URL, generation status | Image subtab |
| `useCardLibrary()` | `storage.ts` | Card list, selected card, CRUD status | Library drawer, card picker |
| `usePromptLibrary()` | `storage.ts`, `prompts.ts` | Prompt list, overrides | Prompts subtab |
| `useLorebook()` | `api.ts`, `storage.ts` | Lorebook entries, generation status | Lorebook subtab |
| `usePngExport()` | `png-encoder.ts` | Export status | Download/export actions |
| `useSillyTavern()` | `api.ts` | ST connection status, push/pull state | SillyTavern panel |

### Layer 3: UI Components (React, presentational + container)

| Component | Type | Responsibility | Communicates With |
|-----------|------|----------------|-------------------|
| `App` | Container | Top-level layout, tab routing, theme | All hooks via context/props |
| `Header` | Presentational | Title, theme toggle | `useConfig` |
| `TabBar` | Presentational | Tab navigation (Create / Editor) | App state |
| `CreatePanel` | Container | Character concept form, generation trigger | `useCharacterGeneration`, `useCardLibrary` |
| `EditorPanel` | Container | Split-pane layout, character editing | `useCharacterGeneration` |
| `CharacterForm` | Presentational | Editable character fields with field locking | Props from EditorPanel |
| `CharacterPreview` | Presentational | Formatted character card preview | Props from EditorPanel |
| `ImagePanel` | Container | Image generation, SD API settings | `useImageGeneration`, `useConfig` |
| `LorebookPanel` | Container | Lorebook entry CRUD, generation | `useLorebook` |
| `SettingsPanel` | Container | API config, app settings | `useConfig` |
| `LibraryDrawer` | Container | Slide-out card/prompt browser | `useCardLibrary`, `usePromptLibrary` |
| `MentionTextarea` | Presentational | Textarea with @mention autocomplete | Tribute.js, `useCardLibrary` |
| `StreamingOutput` | Presentational | Real-time LLM output display | Props (streaming text) |
| `SplitPane` | Presentational | Resizable split layout | Props (children) |
| `ExportActions` | Container | Download PNG, push to ST | `usePngExport`, `useSillyTavern` |

---

## Data Flow

### Character Generation Flow (primary data path)

```
User types concept
       |
  CreatePanel (form state: concept, name, POV, lorebook toggle)
       |
  useCharacterGeneration().generate(concept, options)
       |
  character-generator service -> api service -> fetch POST /api/text/chat/completions (stream: true)
       |
  SSE chunks arrive -> hook updates streamingText state -> StreamingOutput re-renders
       |
  Stream complete -> hook parses final text into character fields -> updates currentCharacter state
       |
  EditorPanel receives currentCharacter -> CharacterForm renders editable fields
```

### State Architecture

Use React Context for cross-cutting concerns, props for parent-child. No global state library needed for this app size.

```
<AppProvider>                    -- theme, active tab
  <ConfigProvider>               -- settings, API config (from localStorage)
    <CharacterProvider>          -- current character, generation state, locked fields
      <App />
    </CharacterProvider>
  </ConfigProvider>
</AppProvider>
```

**Why not Zustand/Redux:** The app has ~4 distinct state domains with clear ownership. Context + hooks handles this cleanly. The largest state (character data) lives in one place and flows down. Adding a state library adds dependency weight and indirection for no measurable benefit at this scale.

### Streaming SSE Pattern in React

The current `api.js` uses `fetch` with `ReadableStream` for SSE streaming. This maps directly to a React hook pattern:

```typescript
// Inside useCharacterGeneration hook
const generate = useCallback(async (concept: string, options: GenerateOptions) => {
  setStatus('generating');
  setStreamingText('');

  const abortController = new AbortController();
  abortRef.current = abortController;

  try {
    const response = await fetch('/api/text/chat/completions', {
      method: 'POST',
      headers: { /* api key, url from config */ },
      body: JSON.stringify({ messages, stream: true }),
      signal: abortController.signal,
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE data lines, extract content deltas
      setStreamingText(prev => prev + parsedContent);
    }

    // Parse complete text into character fields
    const character = parseCharacterFields(fullText);
    setCurrentCharacter(character);
    setStatus('complete');
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('cancelled');
    } else {
      setStatus('error');
      setError(err.message);
    }
  }
}, [config]);
```

**Confidence:** HIGH -- this is the standard pattern for streaming in React. The existing `api.js` already uses this exact fetch + ReadableStream approach; the migration wraps it in a hook with `useState`/`useCallback`.

---

## Directory Structure

```
character-card-generator/
├── index.html                    # Vite entry point (minimal -- just <div id="root">)
├── vite.config.ts                # Vite config with proxy
├── tsconfig.json                 # TypeScript config
├── package.json                  # Frontend deps (react, vite, etc.)
├── package-lock.json
│
├── src/
│   ├── main.tsx                  # React entry: createRoot, render <App />
│   ├── App.tsx                   # Top-level layout, tab routing, providers
│   │
│   ├── components/               # React UI components
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── TabBar.tsx
│   │   │   └── SplitPane.tsx
│   │   ├── panels/
│   │   │   ├── CreatePanel.tsx
│   │   │   ├── EditorPanel.tsx
│   │   │   ├── ImagePanel.tsx
│   │   │   ├── LorebookPanel.tsx
│   │   │   └── SettingsPanel.tsx
│   │   ├── library/
│   │   │   ├── LibraryDrawer.tsx
│   │   │   └── CardList.tsx
│   │   ├── character/
│   │   │   ├── CharacterForm.tsx
│   │   │   ├── CharacterPreview.tsx
│   │   │   └── ExportActions.tsx
│   │   └── shared/
│   │       ├── MentionTextarea.tsx
│   │       ├── StreamingOutput.tsx
│   │       └── StatusIndicator.tsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useConfig.ts
│   │   ├── useCharacterGeneration.ts
│   │   ├── useImageGeneration.ts
│   │   ├── useCardLibrary.ts
│   │   ├── usePromptLibrary.ts
│   │   ├── useLorebook.ts
│   │   ├── usePngExport.ts
│   │   └── useSillyTavern.ts
│   │
│   ├── services/                 # Non-React business logic (migrated from window globals)
│   │   ├── api.ts
│   │   ├── config.ts
│   │   ├── character-generator.ts
│   │   ├── image-generator.ts
│   │   ├── png-encoder.ts
│   │   ├── storage.ts
│   │   └── prompts.ts
│   │
│   ├── contexts/                 # React context providers
│   │   ├── AppContext.tsx
│   │   ├── ConfigContext.tsx
│   │   └── CharacterContext.tsx
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── character.ts          # Character card fields, V2 spec types
│   │   ├── config.ts             # Config shape
│   │   ├── api.ts                # API request/response types
│   │   └── lorebook.ts           # Lorebook entry types
│   │
│   └── styles/
│       └── main.css              # Existing CSS (migrated as-is initially)
│
├── public/                       # Static assets served as-is by Vite
│   └── favicon.png
│
├── proxy/                        # Express backend (UNCHANGED)
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   ├── cards.js
│   └── prompts.js
│
├── Dockerfile
├── docker-compose.yml
└── .planning/
```

**Rationale for structure:**
- **`services/`** separate from **`hooks/`**: Services are testable without React, reusable, and map 1:1 to existing modules (easy to track migration progress).
- **`components/`** grouped by domain, not by type: `panels/`, `character/`, `library/` mirror the app's mental model. Avoids a flat folder with 20+ files.
- **`contexts/`** separate: Only 2-3 contexts needed. Keeps provider logic out of component files.
- **`types/`** centralized: Character card has a complex schema (V2 spec). Single source of truth for types used across services, hooks, and components.

---

## Patterns to Follow

### Pattern 1: Service + Hook + Component Layering

**What:** Three-layer separation where services handle logic, hooks handle state, components handle rendering.

**When:** Every feature in this app. This is the backbone pattern.

**Why:** The existing codebase already separates logic (e.g., `character-generator.js`) from UI (`main.js`). The migration preserves this separation and adds hooks as the bridge layer.

```typescript
// Service (pure logic, no React)
// src/services/character-generator.ts
export class CharacterGenerator {
  constructor(private api: APIHandler) {}

  async generate(concept: string, options: GenerateOptions): Promise<AsyncGenerator<string>> {
    // streaming generation logic
  }

  parseFields(rawText: string): CharacterFields {
    // regex parsing logic (migrated from existing)
  }
}

// Hook (React state bridge)
// src/hooks/useCharacterGeneration.ts
export function useCharacterGeneration() {
  const [character, setCharacter] = useState<CharacterFields | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const generator = useMemo(() => new CharacterGenerator(apiService), []);
  // ... streaming logic with state updates
  return { character, status, generate, cancel, revise };
}

// Component (rendering)
// src/components/panels/CreatePanel.tsx
export function CreatePanel() {
  const { character, status, generate } = useCharacterGeneration();
  return <form onSubmit={() => generate(concept, options)}>...</form>;
}
```

### Pattern 2: Controlled Forms with Field Locking

**What:** Character editor fields are controlled React inputs with a "lock" toggle that prevents regeneration from overwriting user edits.

**When:** The Editor panel's character form.

**Why:** The existing app has a `lockedFields` Set. In React, this becomes straightforward controlled component state.

```typescript
// In CharacterForm component
const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());

function toggleLock(field: string) {
  setLockedFields(prev => {
    const next = new Set(prev);
    next.has(field) ? next.delete(field) : next.add(field);
    return next;
  });
}
```

### Pattern 3: Abort-Aware Streaming Hook

**What:** Streaming hooks hold an `AbortController` ref and expose a `cancel()` function. Cleanup on unmount prevents memory leaks and orphaned connections.

**When:** Character generation, image generation, any LLM streaming call.

```typescript
const abortRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => { abortRef.current?.abort(); }; // cleanup on unmount
}, []);

const cancel = useCallback(() => {
  abortRef.current?.abort();
  setStatus('cancelled');
}, []);
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Prop Drilling Through 5+ Levels

**What:** Passing character data, config, and callbacks through CreatePanel -> EditorPanel -> SplitPane -> CharacterForm -> individual fields.

**Why bad:** The current `main.js` manages everything in one place, which avoids this problem but creates a 1500-line monolith. Naive componentization recreates the problem differently.

**Instead:** Use Context for data that crosses 2+ component boundaries. Character state and config are the two clear candidates. Tab state and theme are minor enough for App-level context.

### Anti-Pattern 2: Putting Service Logic in Components

**What:** Making API calls, parsing responses, or managing localStorage directly inside React components.

**Why bad:** Untestable, duplicated, couples UI to implementation details.

**Instead:** Services handle logic. Hooks handle state. Components handle rendering. The existing module separation already enforces this -- preserve it.

### Anti-Pattern 3: Converting Everything to Controlled Components at Once

**What:** Trying to make every input (concept textarea, settings fields, lorebook entries) a controlled React component simultaneously.

**Why bad:** The existing app has ~40+ form inputs. Converting all of them while also migrating services and building components creates an enormous blast radius per phase.

**Instead:** Use `defaultValue` + `ref` for non-critical inputs initially. Convert to controlled components per-panel as each panel is built.

---

## Migration Strategy: Big-Bang Rewrite

**Recommendation: Big-bang rewrite, NOT incremental migration.**

**Rationale specific to this project:**

1. **Small app (10 JS files, ~3500 lines frontend):** This is not a large enterprise app. The entire frontend is roughly the size of a medium React component tree. The risk profile of a rewrite is low.

2. **No shared rendering possible:** The current app uses direct DOM manipulation (`document.getElementById`, `innerHTML`, event listener binding). You cannot render React components inside this system or vice versa without an integration layer that would be thrown away. Incremental migration (Strangler Fig) requires a bridge -- that bridge costs more than rewriting at this scale.

3. **Window globals are all-or-nothing:** Every module reads from `window.*`. You cannot import half the modules as ES modules and leave half as globals. The module system has to flip in one step.

4. **Feature parity is the goal, not new features:** Since no new features are being added, the rewrite is a 1:1 translation. The behavior specification is the existing app. This eliminates the biggest risk of rewrites (scope creep).

5. **Single developer, no parallel feature work:** No risk of merge conflicts between "old app fixes" and "new app development" that makes incremental migration valuable in team settings.

**The rewrite should be phased by component/panel, not by running two systems in parallel.** Each phase delivers a working subset of the app.

---

## Suggested Build Order (dependency chain)

The build order follows the dependency graph: foundational services first, then hooks, then components from simple to complex.

### Phase 1: Scaffold + Services

Build order rationale: Nothing else works without the build system and service layer.

1. **Vite + React scaffold** -- `vite.config.ts`, `index.html`, `main.tsx`, empty `App.tsx`
2. **TypeScript types** -- `character.ts`, `config.ts`, `api.ts` (define the data shapes everything else uses)
3. **Service modules** -- Convert all 7 service files from window globals to ES module exports
4. **Verify proxy** -- Dev server can talk to Express backend through Vite proxy

**Deliverable:** `npm run dev` shows empty React app, services importable, proxy working.

### Phase 2: Config + Settings

Build order rationale: Everything depends on config. Settings panel validates that config service works correctly in React.

1. **`useConfig` hook** -- wraps config service in React state
2. **`ConfigContext`** -- provides config to component tree
3. **`SettingsPanel`** component -- API settings form, theme toggle
4. **`Header`** component -- title, theme toggle button

**Deliverable:** Settings panel renders, config persists to localStorage, theme switching works.

### Phase 3: Create Panel + Generation

Build order rationale: This is the primary user flow. Requires services + config from prior phases.

1. **`useCharacterGeneration` hook** -- streaming state, abort control
2. **`CharacterContext`** -- shares character state across panels
3. **`StreamingOutput`** component -- displays real-time LLM text
4. **`MentionTextarea`** component -- Tribute.js integration for @mention
5. **`CreatePanel`** component -- concept form, POV select, generate button
6. **`TabBar`** component -- Create / Editor tab switching

**Deliverable:** User can enter a concept, generate a character with streaming output, see raw result.

### Phase 4: Editor Panel + Card Editing

Build order rationale: Depends on character data from generation (Phase 3).

1. **`SplitPane`** component -- resizable split layout
2. **`CharacterForm`** component -- editable fields with field locking
3. **`CharacterPreview`** component -- formatted card preview
4. **`EditorPanel`** container -- assembles form + preview in split pane
5. **Evaluate/Revise flow** in `useCharacterGeneration` -- revision instructions, re-generation

**Deliverable:** Full generation -> editing -> revision workflow works.

### Phase 5: Image + Export

Build order rationale: Depends on character data (Phase 4). Image generation is independent of card editing but export combines both.

1. **`useImageGeneration` hook** -- image prompt + generation state
2. **`ImagePanel`** component -- image generation UI, SD API settings
3. **`usePngExport` hook** -- PNG metadata embedding
4. **`ExportActions`** component -- download PNG, copy JSON

**Deliverable:** Character + image generation + PNG export works.

### Phase 6: Library + SillyTavern

Build order rationale: Library and ST sync are secondary features that depend on card CRUD (needs complete character + image).

1. **`useCardLibrary` + `usePromptLibrary` hooks** -- CRUD state
2. **`LibraryDrawer`** component -- slide-out browser with card/prompt lists
3. **`useSillyTavern` hook** -- push/pull state
4. **SillyTavern sync UI** in settings or export actions
5. **Lorebook panel** -- `useLorebook` hook + `LorebookPanel` component

**Deliverable:** Full feature parity with existing app.

### Phase 7: Polish + Dockerfile

1. **CSS migration** -- existing `main.css` works as-is initially; refine component-scoped styles
2. **Dockerfile update** -- add `npm run build` step, set `STATIC_ROOT=/app/dist`
3. **Remove old files** -- delete `src/scripts/`, old `index.html` structure
4. **Smoke test** -- all features work in Docker container

**Deliverable:** Production-ready Docker image with React frontend.

---

## Scalability Considerations

| Concern | Current (10 users) | At 100 users | At 1000 users |
|---------|---------------------|--------------|---------------|
| Bundle size | Not relevant (served as separate files) | Vite tree-shakes + code-splits automatically | Lazy-load panels with `React.lazy()` |
| State management | Context sufficient | Context sufficient | Still sufficient -- state is per-session, not shared |
| Streaming connections | 1 per user (SSE) | Express handles fine | Express handles fine (no WebSocket upgrade needed) |
| Static asset caching | Vite adds content hashes to filenames | Long-lived cache headers safe | CDN-friendly if needed |

This app is inherently single-user (personal tool, self-hosted). Scalability concerns are minimal. The main benefit of React + Vite is developer experience and maintainability, not performance at scale.

---

## Sources

- [Vite Server Options (proxy config)](https://vite.dev/config/server-options) -- HIGH confidence, official docs
- [Vite Build Options](https://vite.dev/config/build-options) -- HIGH confidence, official docs
- [Vite Backend Integration Guide](https://vite.dev/guide/backend-integration) -- HIGH confidence, official docs
- [vite-express integration library](https://github.com/szymmis/vite-express) -- reviewed but NOT recommended (adds unnecessary abstraction for this simple setup)
- [React Folder Structure in 5 Steps (Robin Wieruch, 2025)](https://www.robinwieruch.de/react-folder-structure/) -- MEDIUM confidence, community best practice
- [Brainhub: Strategy and Tips for Migrating to React](https://brainhub.eu/library/migrating-to-react) -- MEDIUM confidence, migration strategy reference
- [SSE in React (OneUptime, 2026)](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) -- MEDIUM confidence, streaming pattern reference
- Existing source code: `proxy/server.js` line 87 (`STATIC_ROOT` env var) -- HIGH confidence, verified directly

---

*Architecture analysis: 2026-03-26*

# Architecture Patterns

**Domain:** Vanilla JS to React/Vite migration (SPA with Express proxy backend)
**Researched:** 2026-03-26

## Recommended Architecture

```
Development:
  Vite Dev Server (port 5173) --proxy /api/*--> Express Backend (port 2426)
       |                                              |
  React SPA (HMR)                             API proxy routes
                                              Card/Prompt CRUD (git-backed)

Production (Docker):
  Express (port 2426)
       |
       +-- express.static("dist/")  -->  Vite-built React SPA
       +-- /api/*                   -->  Proxy routes, CRUD routes
```

**Key invariant:** The Express backend is unchanged. Only the frontend migrates. In production, Express serves the Vite `dist/` output as static files, exactly as it currently serves `index.html` + `src/`.

### Vite Dev Server Proxy Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.', // project root (where index.html lives)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
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
});
```

**Confidence:** HIGH -- Vite's `server.proxy` uses `http-proxy` under the hood. The `/api` prefix catch-all matches every backend route (`/api/text/*`, `/api/image/*`, `/api/cards/*`, `/api/prompts/*`, `/api/st/*`, `/api/proxy-image`). No `rewrite` needed because Express already mounts routes at `/api/*`.

### Production Build Integration

The Dockerfile changes are minimal:

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git

WORKDIR /app

# Install frontend dependencies and build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # vite build -> dist/

# Install proxy dependencies
RUN cd proxy && npm ci --only=production

ENV NODE_ENV=production
ENV PORT=2426
ENV STATIC_ROOT=/app/dist

EXPOSE 2426
CMD ["node", "proxy/server.js"]
```

Express already reads `STATIC_ROOT` env var (line 87 of `proxy/server.js`): `const staticRoot = process.env.STATIC_ROOT || path.join(__dirname, "..");`. Setting `STATIC_ROOT=/app/dist` makes Express serve the Vite build output with zero backend changes.

**Confidence:** HIGH -- verified from the existing `server.js` source code. The `STATIC_ROOT` env var is already built for this exact purpose.

---

## Component Boundaries

### Layer 1: Services (non-React, pure logic)

These are the current window-global modules converted to ES modules. They contain no UI logic and no React dependencies. They export functions/classes that React hooks and components consume.

| Service Module | Current Global | Responsibility | Depends On |
|----------------|---------------|----------------|------------|
| `api.ts` | `window.apiHandler` | HTTP client, streaming SSE, abort control | `config` service |
| `config.ts` | `window.config` | Settings read/write (localStorage/sessionStorage) | None |
| `character-generator.ts` | `window.characterGenerator` | Generation orchestration, LLM response parsing | `api` service |
| `image-generator.ts` | `window.imageGenerator` | Image prompt generation + image API calls | `api`, `config` services |
| `png-encoder.ts` | `window.pngEncoder` | PNG metadata embedding (V2 character cards) | `config` service |
| `storage.ts` | `window.characterStorage` | REST client for card/prompt CRUD | None |
| `prompts.ts` | `window.getPrompt` | Prompt template registry + overrides | None |

**Migration approach:** Strip the `window.` assignments, convert to ES module exports, keep the class structure. These become importable services, not React code.

### Layer 2: Custom Hooks (React, state + side effects)

Hooks bridge services to React's state model. Each hook owns a specific domain of state.

| Hook | Consumes Service(s) | State Owned | Used By |
|------|---------------------|-------------|---------|
| `useConfig()` | `config.ts` | Settings object, theme | Settings panel, API status |
| `useCharacterGeneration()` | `character-generator.ts`, `api.ts` | Current character, generation status, streaming text, abort | Create panel, Editor panel |
| `useImageGeneration()` | `image-generator.ts`, `api.ts` | Image URL, generation status | Image subtab |
| `useCardLibrary()` | `storage.ts` | Card list, selected card, CRUD status | Library drawer, card picker |
| `usePromptLibrary()` | `storage.ts`, `prompts.ts` | Prompt list, overrides | Prompts subtab |
| `useLorebook()` | `api.ts`, `storage.ts` | Lorebook entries, generation status | Lorebook subtab |
| `usePngExport()` | `png-encoder.ts` | Export status | Download/export actions |
| `useSillyTavern()` | `api.ts` | ST connection status, push/pull state | SillyTavern panel |

### Layer 3: UI Components (React, presentational + container)

| Component | Type | Responsibility | Communicates With |
|-----------|------|----------------|-------------------|
| `App` | Container | Top-level layout, tab routing, theme | All hooks via context/props |
| `Header` | Presentational | Title, theme toggle | `useConfig` |
| `TabBar` | Presentational | Tab navigation (Create / Editor) | App state |
| `CreatePanel` | Container | Character concept form, generation trigger | `useCharacterGeneration`, `useCardLibrary` |
| `EditorPanel` | Container | Split-pane layout, character editing | `useCharacterGeneration` |
| `CharacterForm` | Presentational | Editable character fields with field locking | Props from EditorPanel |
| `CharacterPreview` | Presentational | Formatted character card preview | Props from EditorPanel |
| `ImagePanel` | Container | Image generation, SD API settings | `useImageGeneration`, `useConfig` |
| `LorebookPanel` | Container | Lorebook entry CRUD, generation | `useLorebook` |
| `SettingsPanel` | Container | API config, app settings | `useConfig` |
| `LibraryDrawer` | Container | Slide-out card/prompt browser | `useCardLibrary`, `usePromptLibrary` |
| `MentionTextarea` | Presentational | Textarea with @mention autocomplete | Tribute.js, `useCardLibrary` |
| `StreamingOutput` | Presentational | Real-time LLM output display | Props (streaming text) |
| `SplitPane` | Presentational | Resizable split layout | Props (children) |
| `ExportActions` | Container | Download PNG, push to ST | `usePngExport`, `useSillyTavern` |

---

## Data Flow

### Character Generation Flow (primary data path)

```
User types concept
       |
  CreatePanel (form state: concept, name, POV, lorebook toggle)
       |
  useCharacterGeneration().generate(concept, options)
       |
  character-generator service -> api service -> fetch POST /api/text/chat/completions (stream: true)
       |
  SSE chunks arrive -> hook updates streamingText state -> StreamingOutput re-renders
       |
  Stream complete -> hook parses final text into character fields -> updates currentCharacter state
       |
  EditorPanel receives currentCharacter -> CharacterForm renders editable fields
```

### State Architecture

Use React Context for cross-cutting concerns, props for parent-child. No global state library needed for this app size.

```
<AppProvider>                    -- theme, active tab
  <ConfigProvider>               -- settings, API config (from localStorage)
    <CharacterProvider>          -- current character, generation state, locked fields
      <App />
    </CharacterProvider>
  </ConfigProvider>
</AppProvider>
```

**Why not Zustand/Redux:** The app has ~4 distinct state domains with clear ownership. Context + hooks handles this cleanly. The largest state (character data) lives in one place and flows down. Adding a state library adds dependency weight and indirection for no measurable benefit at this scale.

### Streaming SSE Pattern in React

The current `api.js` uses `fetch` with `ReadableStream` for SSE streaming. This maps directly to a React hook pattern:

```typescript
// Inside useCharacterGeneration hook
const generate = useCallback(async (concept: string, options: GenerateOptions) => {
  setStatus('generating');
  setStreamingText('');

  const abortController = new AbortController();
  abortRef.current = abortController;

  try {
    const response = await fetch('/api/text/chat/completions', {
      method: 'POST',
      headers: { /* api key, url from config */ },
      body: JSON.stringify({ messages, stream: true }),
      signal: abortController.signal,
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE data lines, extract content deltas
      setStreamingText(prev => prev + parsedContent);
    }

    // Parse complete text into character fields
    const character = parseCharacterFields(fullText);
    setCurrentCharacter(character);
    setStatus('complete');
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('cancelled');
    } else {
      setStatus('error');
      setError(err.message);
    }
  }
}, [config]);
```

**Confidence:** HIGH -- this is the standard pattern for streaming in React. The existing `api.js` already uses this exact fetch + ReadableStream approach; the migration wraps it in a hook with `useState`/`useCallback`.

---

## Directory Structure

```
character-card-generator/
|-- index.html                    # Vite entry point (minimal -- just <div id="root">)
|-- vite.config.ts                # Vite config with proxy
|-- tsconfig.json                 # TypeScript config
|-- package.json                  # Frontend deps (react, vite, etc.)
|-- package-lock.json
|
|-- src/
|   |-- main.tsx                  # React entry: createRoot, render <App />
|   |-- App.tsx                   # Top-level layout, tab routing, providers
|   |
|   |-- components/               # React UI components
|   |   |-- layout/
|   |   |   |-- Header.tsx
|   |   |   |-- TabBar.tsx
|   |   |   +-- SplitPane.tsx
|   |   |-- panels/
|   |   |   |-- CreatePanel.tsx
|   |   |   |-- EditorPanel.tsx
|   |   |   |-- ImagePanel.tsx
|   |   |   |-- LorebookPanel.tsx
|   |   |   +-- SettingsPanel.tsx
|   |   |-- library/
|   |   |   |-- LibraryDrawer.tsx
|   |   |   +-- CardList.tsx
|   |   |-- character/
|   |   |   |-- CharacterForm.tsx
|   |   |   |-- CharacterPreview.tsx
|   |   |   +-- ExportActions.tsx
|   |   +-- shared/
|   |       |-- MentionTextarea.tsx
|   |       |-- StreamingOutput.tsx
|   |       +-- StatusIndicator.tsx
|   |
|   |-- hooks/                    # Custom React hooks
|   |   |-- useConfig.ts
|   |   |-- useCharacterGeneration.ts
|   |   |-- useImageGeneration.ts
|   |   |-- useCardLibrary.ts
|   |   |-- usePromptLibrary.ts
|   |   |-- useLorebook.ts
|   |   |-- usePngExport.ts
|   |   +-- useSillyTavern.ts
|   |
|   |-- services/                 # Non-React business logic (migrated from window globals)
|   |   |-- api.ts
|   |   |-- config.ts
|   |   |-- character-generator.ts
|   |   |-- image-generator.ts
|   |   |-- png-encoder.ts
|   |   |-- storage.ts
|   |   +-- prompts.ts
|   |
|   |-- contexts/                 # React context providers
|   |   |-- AppContext.tsx
|   |   |-- ConfigContext.tsx
|   |   +-- CharacterContext.tsx
|   |
|   |-- types/                    # TypeScript type definitions
|   |   |-- character.ts          # Character card fields, V2 spec types
|   |   |-- config.ts             # Config shape
|   |   |-- api.ts                # API request/response types
|   |   +-- lorebook.ts           # Lorebook entry types
|   |
|   +-- styles/
|       +-- main.css              # Existing CSS (migrated as-is initially)
|
|-- public/                       # Static assets served as-is by Vite
|   +-- favicon.png
|
|-- proxy/                        # Express backend (UNCHANGED)
|   |-- package.json
|   |-- package-lock.json
|   |-- server.js
|   |-- cards.js
|   +-- prompts.js
|
|-- Dockerfile
|-- docker-compose.yml
+-- .planning/
```

**Rationale for structure:**
- **`services/`** separate from **`hooks/`**: Services are testable without React, reusable, and map 1:1 to existing modules (easy to track migration progress).
- **`components/`** grouped by domain, not by type: `panels/`, `character/`, `library/` mirror the app's mental model. Avoids a flat folder with 20+ files.
- **`contexts/`** separate: Only 2-3 contexts needed. Keeps provider logic out of component files.
- **`types/`** centralized: Character card has a complex schema (V2 spec). Single source of truth for types used across services, hooks, and components.

---

## Patterns to Follow

### Pattern 1: Service + Hook + Component Layering

**What:** Three-layer separation where services handle logic, hooks handle state, components handle rendering.

**When:** Every feature in this app. This is the backbone pattern.

**Why:** The existing codebase already separates logic (e.g., `character-generator.js`) from UI (`main.js`). The migration preserves this separation and adds hooks as the bridge layer.

```typescript
// Service (pure logic, no React)
// src/services/character-generator.ts
export class CharacterGenerator {
  constructor(private api: APIHandler) {}

  async generate(concept: string, options: GenerateOptions): Promise<AsyncGenerator<string>> {
    // streaming generation logic
  }

  parseFields(rawText: string): CharacterFields {
    // regex parsing logic (migrated from existing)
  }
}

// Hook (React state bridge)
// src/hooks/useCharacterGeneration.ts
export function useCharacterGeneration() {
  const [character, setCharacter] = useState<CharacterFields | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const generator = useMemo(() => new CharacterGenerator(apiService), []);
  // ... streaming logic with state updates
  return { character, status, generate, cancel, revise };
}

// Component (rendering)
// src/components/panels/CreatePanel.tsx
export function CreatePanel() {
  const { character, status, generate } = useCharacterGeneration();
  return <form onSubmit={() => generate(concept, options)}>...</form>;
}
```

### Pattern 2: Controlled Forms with Field Locking

**What:** Character editor fields are controlled React inputs with a "lock" toggle that prevents regeneration from overwriting user edits.

**When:** The Editor panel's character form.

**Why:** The existing app has a `lockedFields` Set. In React, this becomes straightforward controlled component state.

```typescript
// In CharacterForm component
const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());

function toggleLock(field: string) {
  setLockedFields(prev => {
    const next = new Set(prev);
    next.has(field) ? next.delete(field) : next.add(field);
    return next;
  });
}
```

### Pattern 3: Abort-Aware Streaming Hook

**What:** Streaming hooks hold an `AbortController` ref and expose a `cancel()` function. Cleanup on unmount prevents memory leaks and orphaned connections.

**When:** Character generation, image generation, any LLM streaming call.

```typescript
const abortRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => { abortRef.current?.abort(); }; // cleanup on unmount
}, []);

const cancel = useCallback(() => {
  abortRef.current?.abort();
  setStatus('cancelled');
}, []);
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Prop Drilling Through 5+ Levels

**What:** Passing character data, config, and callbacks through CreatePanel -> EditorPanel -> SplitPane -> CharacterForm -> individual fields.

**Why bad:** The current `main.js` manages everything in one place, which avoids this problem but creates a 1500-line monolith. Naive componentization recreates the problem differently.

**Instead:** Use Context for data that crosses 2+ component boundaries. Character state and config are the two clear candidates. Tab state and theme are minor enough for App-level context.

### Anti-Pattern 2: Putting Service Logic in Components

**What:** Making API calls, parsing responses, or managing localStorage directly inside React components.

**Why bad:** Untestable, duplicated, couples UI to implementation details.

**Instead:** Services handle logic. Hooks handle state. Components handle rendering. The existing module separation already enforces this -- preserve it.

### Anti-Pattern 3: Converting Everything to Controlled Components at Once

**What:** Trying to make every input (concept textarea, settings fields, lorebook entries) a controlled React component simultaneously.

**Why bad:** The existing app has ~40+ form inputs. Converting all of them while also migrating services and building components creates an enormous blast radius per phase.

**Instead:** Use `defaultValue` + `ref` for non-critical inputs initially. Convert to controlled components per-panel as each panel is built.

---

## Migration Strategy: Big-Bang Rewrite

**Recommendation: Big-bang rewrite, NOT incremental migration.**

**Rationale specific to this project:**

1. **Small app (10 JS files, ~3500 lines frontend):** This is not a large enterprise app. The entire frontend is roughly the size of a medium React component tree. The risk profile of a rewrite is low.

2. **No shared rendering possible:** The current app uses direct DOM manipulation (`document.getElementById`, `innerHTML`, event listener binding). You cannot render React components inside this system or vice versa without an integration layer that would be thrown away. Incremental migration (Strangler Fig) requires a bridge -- that bridge costs more than rewriting at this scale.

3. **Window globals are all-or-nothing:** Every module reads from `window.*`. You cannot import half the modules as ES modules and leave half as globals. The module system has to flip in one step.

4. **Feature parity is the goal, not new features:** Since no new features are being added, the rewrite is a 1:1 translation. The behavior specification is the existing app. This eliminates the biggest risk of rewrites (scope creep).

5. **Single developer, no parallel feature work:** No risk of merge conflicts between "old app fixes" and "new app development" that makes incremental migration valuable in team settings.

**The rewrite should be phased by component/panel, not by running two systems in parallel.** Each phase delivers a working subset of the app.

---

## Suggested Build Order (dependency chain)

The build order follows the dependency graph: foundational services first, then hooks, then components from simple to complex.

### Phase 1: Scaffold + Services

Build order rationale: Nothing else works without the build system and service layer.

1. **Vite + React scaffold** -- `vite.config.ts`, `index.html`, `main.tsx`, empty `App.tsx`
2. **TypeScript types** -- `character.ts`, `config.ts`, `api.ts` (define the data shapes everything else uses)
3. **Service modules** -- Convert all 7 service files from window globals to ES module exports
4. **Verify proxy** -- Dev server can talk to Express backend through Vite proxy

**Deliverable:** `npm run dev` shows empty React app, services importable, proxy working.

### Phase 2: Config + Settings

Build order rationale: Everything depends on config. Settings panel validates that config service works correctly in React.

1. **`useConfig` hook** -- wraps config service in React state
2. **`ConfigContext`** -- provides config to component tree
3. **`SettingsPanel`** component -- API settings form, theme toggle
4. **`Header`** component -- title, theme toggle button

**Deliverable:** Settings panel renders, config persists to localStorage, theme switching works.

### Phase 3: Create Panel + Generation

Build order rationale: This is the primary user flow. Requires services + config from prior phases.

1. **`useCharacterGeneration` hook** -- streaming state, abort control
2. **`CharacterContext`** -- shares character state across panels
3. **`StreamingOutput`** component -- displays real-time LLM text
4. **`MentionTextarea`** component -- Tribute.js integration for @mention
5. **`CreatePanel`** component -- concept form, POV select, generate button
6. **`TabBar`** component -- Create / Editor tab switching

**Deliverable:** User can enter a concept, generate a character with streaming output, see raw result.

### Phase 4: Editor Panel + Card Editing

Build order rationale: Depends on character data from generation (Phase 3).

1. **`SplitPane`** component -- resizable split layout
2. **`CharacterForm`** component -- editable fields with field locking
3. **`CharacterPreview`** component -- formatted card preview
4. **`EditorPanel`** container -- assembles form + preview in split pane
5. **Evaluate/Revise flow** in `useCharacterGeneration` -- revision instructions, re-generation

**Deliverable:** Full generation -> editing -> revision workflow works.

### Phase 5: Image + Export

Build order rationale: Depends on character data (Phase 4). Image generation is independent of card editing but export combines both.

1. **`useImageGeneration` hook** -- image prompt + generation state
2. **`ImagePanel`** component -- image generation UI, SD API settings
3. **`usePngExport` hook** -- PNG metadata embedding
4. **`ExportActions`** component -- download PNG, copy JSON

**Deliverable:** Character + image generation + PNG export works.

### Phase 6: Library + SillyTavern

Build order rationale: Library and ST sync are secondary features that depend on card CRUD (needs complete character + image).

1. **`useCardLibrary` + `usePromptLibrary` hooks** -- CRUD state
2. **`LibraryDrawer`** component -- slide-out browser with card/prompt lists
3. **`useSillyTavern` hook** -- push/pull state
4. **SillyTavern sync UI** in settings or export actions
5. **Lorebook panel** -- `useLorebook` hook + `LorebookPanel` component

**Deliverable:** Full feature parity with existing app.

### Phase 7: Polish + Dockerfile

1. **CSS migration** -- existing `main.css` works as-is initially; refine component-scoped styles
2. **Dockerfile update** -- add `npm run build` step, set `STATIC_ROOT=/app/dist`
3. **Remove old files** -- delete `src/scripts/`, old `index.html` structure
4. **Smoke test** -- all features work in Docker container

**Deliverable:** Production-ready Docker image with React frontend.

---

## Scalability Considerations

| Concern | Current (10 users) | At 100 users | At 1000 users |
|---------|---------------------|--------------|---------------|
| Bundle size | Not relevant (served as separate files) | Vite tree-shakes + code-splits automatically | Lazy-load panels with `React.lazy()` |
| State management | Context sufficient | Context sufficient | Still sufficient -- state is per-session, not shared |
| Streaming connections | 1 per user (SSE) | Express handles fine | Express handles fine (no WebSocket upgrade needed) |
| Static asset caching | Vite adds content hashes to filenames | Long-lived cache headers safe | CDN-friendly if needed |

This app is inherently single-user (personal tool, self-hosted). Scalability concerns are minimal. The main benefit of React + Vite is developer experience and maintainability, not performance at scale.

---

## Sources

- [Vite Server Options (proxy config)](https://vite.dev/config/server-options) -- HIGH confidence, official docs
- [Vite Build Options](https://vite.dev/config/build-options) -- HIGH confidence, official docs
- [Vite Backend Integration Guide](https://vite.dev/guide/backend-integration) -- HIGH confidence, official docs
- [vite-express integration library](https://github.com/szymmis/vite-express) -- reviewed but NOT recommended (adds unnecessary abstraction)
- [React Folder Structure in 5 Steps (Robin Wieruch, 2025)](https://www.robinwieruch.de/react-folder-structure/) -- MEDIUM confidence, community best practice
- [Brainhub: Strategy and Tips for Migrating to React](https://brainhub.eu/library/migrating-to-react) -- MEDIUM confidence, migration strategy reference
- [SSE in React (OneUptime, 2026)](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) -- MEDIUM confidence, streaming pattern reference
- Existing source code: `proxy/server.js` line 87 (`STATIC_ROOT` env var) -- HIGH confidence, verified directly

---

*Architecture analysis: 2026-03-26*

