# Domain Pitfalls

**Domain:** Vanilla JS SPA to React/Vite migration (character card generator)
**Researched:** 2026-03-26

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or extended timelines.

### Pitfall 1: SSE Streaming State Updates Hit Stale Closures

**What goes wrong:** The current codebase streams SSE tokens via a simple callback `(token, fullContent) => this.handleCharacterStream(token, fullContent)` that directly mutates the DOM. In React, the equivalent pattern uses `useState` or `useReducer`, but the streaming callback created at mount time captures a stale snapshot of state. Each token update triggers a re-render, but the next `reader.read()` callback still holds the old state reference. Result: tokens get lost, the display flickers, or the accumulated content resets to a partial state mid-stream.

**Why it happens:** React's closure model means event handlers and callbacks capture state values at render time. A streaming loop that calls `setState(prev + token)` hundreds of times in rapid succession creates a cascade of re-renders where each callback may reference an outdated `prev` value unless the functional updater form `setState(prev => prev + token)` is used consistently.

**Consequences:** Garbled streaming output visible to the user. Lost tokens that silently break the regex/structured parser downstream. Difficult to reproduce because it depends on timing and chunk sizes.

**Prevention:**
1. Use `useRef` to hold the accumulating content string -- update `.current` on each token, only `setState` on a throttled interval (e.g., every 50ms or every N tokens) for display.
2. Always use the functional updater form: `setContent(prev => prev + token)` -- never `setContent(content + token)`.
3. Store the `ReadableStreamDefaultReader` in a `useRef` so cleanup/abort works across re-renders.
4. Keep the streaming logic in a custom hook (`useSSEStream`) that encapsulates the reader, abort controller, and ref-based accumulation. This isolates the complexity.

**Detection:** During development, compare the final accumulated content in the stream display against the raw API response stored in `lastRawResponse`. If they diverge, stale closure is eating tokens.

**Phase relevance:** Must be solved in the first phase that implements streaming. Cannot be deferred.

---

### Pitfall 2: Vite Proxy Is Development-Only -- Production Requests 404

**What goes wrong:** Vite's `server.proxy` configuration (used to forward `/api/*` to Express during development) does not exist in production builds. Developers configure the proxy in `vite.config.ts`, test in dev, then deploy and every API call returns 404 because the built static files have no proxy layer.

**Why it happens:** Vite is a dev server + build tool, not a production server. After `vite build`, the output is static files in `dist/`. The proxy config is purely a dev server feature. This project's architecture already has Express serving static files, so the fix is straightforward -- but only if planned from the start.

**Consequences:** Application appears to work in dev but completely fails in production Docker container. All API calls fail silently or with network errors.

**Prevention:**
1. In production: Express serves both the Vite-built `dist/` folder AND the API routes (exactly as it does today with raw static files). No nginx needed.
2. In development: Vite dev server proxies `/api/*` to Express running on a separate port.
3. Document the dual-mode serving clearly: `vite dev` with proxy for development, `express.static('dist')` for production.
4. The Dockerfile only needs `vite build` in a build stage; the final image runs Express which serves `dist/` and API routes.

**Detection:** Test the production Docker build early (Phase 1). Do not wait until the migration is "done" to verify the Docker build works.

**Phase relevance:** Must be solved in the build system setup phase (Phase 1). This is foundational.

---

### Pitfall 3: Feature Parity Lost Silently During Incremental Migration

**What goes wrong:** The current `main.js` is 1500+ lines with tightly coupled behaviors: tab switching enables/disables buttons, generation flow auto-saves to library, lorebook generation chains after character generation, @mention expansion happens before API calls. When decomposing into React components, these implicit couplings break. Features stop working but no error is thrown because the broken behavior was a side effect, not an explicit call.

**Why it happens:** Vanilla JS with DOM manipulation has side effects everywhere. The `init()` method in `CharacterGeneratorApp` binds 20+ event listeners, initializes storage, attaches mention autocomplete, checks API status, and refreshes library views -- all sequentially. In React, these become effects, context providers, and callbacks spread across components. It is easy to miss one.

**Consequences:** Users discover missing features in production. Examples of silently breakable features:
- Split pane drag ratio not persisting to localStorage
- Tab badge notifications not appearing when generation completes on a background tab
- Keyboard arrow navigation between tabs
- Field locking (the `lockedFields` Set that persists which fields not to overwrite on revision)
- Auto-save after generation
- Content refusal detection (checking if description + firstMessage are both empty)

**Prevention:**
1. Create a feature checklist extracted from the current `init()` and `bindEvents()` methods before writing any React code. Every `addEventListener` and every `document.getElementById` is a feature to preserve.
2. Migrate one tab/panel at a time, not one "layer" at a time. Keep features vertically complete.
3. Run the old and new versions side-by-side during development. Manually test each feature after each component migration.
4. Mark deferred features explicitly in the roadmap -- do not let them silently fall off.

**Detection:** Diff the event listener count. The vanilla app binds ~40+ event listeners in `init()` and `bindEvents()`. If the React version has fewer interactive behaviors, something was dropped.

**Phase relevance:** Every phase. This is an ongoing risk throughout the migration.

---

### Pitfall 4: Regex Parsing Migration Breaks on Edge Cases

**What goes wrong:** The current `parseCharacterData()` and `parseScenarioData()` methods use fragile regex patterns like `/^#\s*([^'\\]*(?:\\.[^'\\]*)*)'s Profile/i` and `/(?:#\s*[^#]+?'s Profile[\s\S]*?)?([\s\S]*?)(?=##\s*(?:My\s+)?Personality)/i`. These have known edge cases (noted in CONCERNS.md). When migrating to a structured parsing approach, the new parser must handle all the same edge cases the regex handles today AND the ones it fails on. If the new parser is stricter, previously-working characters break. If it is looser, it may extract wrong sections.

**Why it happens:** LLM output is inherently variable. The regex parsers have been tuned to handle observed variations (missing headers, alternate name formats, first-person vs third-person). A new structured parser that hasn't been tested against the same corpus of real outputs will have different failure modes.

**Consequences:** Characters that generated fine before the migration now parse incorrectly. Fields end up in wrong slots (personality text in description, scenario in first_message). Users see regressions on their established workflows.

**Prevention:**
1. Before touching the parser, collect 20+ real raw LLM outputs from actual generation runs. Save them as test fixtures.
2. Run both old regex parser and new structured parser against the same inputs. Compare outputs field-by-field.
3. Consider a phased approach: first migrate to React with the existing regex parser (wrapped in a utility function), then replace the parser in a separate phase.
4. If switching to structured output (JSON mode / function calling), ensure the prompt changes are tested against multiple LLM providers (OpenRouter, local LLMs) since not all support structured output equally.

**Detection:** Add a temporary comparison mode that runs both parsers and logs mismatches.

**Phase relevance:** Should be its own dedicated phase, not mixed with the React component migration. Separate the parser change from the UI change to isolate regressions.

---

## Moderate Pitfalls

### Pitfall 5: PNG Binary Manipulation Breaks Under React Re-render Cycles

**What goes wrong:** The `PNGEncoder` class does low-level binary manipulation: reading PNG signatures, finding IEND chunks, injecting tEXt chunks with base64-encoded character JSON. This code uses `Uint8Array`, `ArrayBuffer`, `Blob`, and `btoa()`. In React, if the PNG encoding is triggered inside a component that re-renders (e.g., during a "Download" button handler), stale references to blobs or array buffers from a previous render can cause corrupt PNGs. Additionally, converting the PNGEncoder from a window global to an imported module may break if `this` binding changes.

**Prevention:**
1. Keep `PNGEncoder` as a pure utility module with no React dependencies. It should take inputs (blob, character data) and return a blob. No state, no effects, no hooks.
2. Never store blobs or ArrayBuffers in React state -- they are not serializable and comparing them causes issues. Store a URL string; convert to blob only at download time (the current code already does this: "we now convert fresh from URL on download").
3. Test PNG output with a hex editor or by re-importing into SillyTavern. Corrupt metadata is invisible without validation.

**Detection:** After migration, download a card and import it into SillyTavern. If the metadata is missing or corrupt, the PNG encoding broke.

**Phase relevance:** Phase where card export is migrated. Should be one of the last features migrated since it is self-contained.

---

### Pitfall 6: @Mention Autocomplete Requires Contenteditable in React

**What goes wrong:** The current `MentionAutocomplete` class replaces a `<textarea>` with a `contentEditable` div, attaches Tribute.js, and injects styled pill spans. React's controlled component model and contentEditable are fundamentally at odds. React warns against using `contentEditable` with `children` because React cannot reconcile DOM changes made by external libraries. Tribute.js modifies the DOM directly, which React then perceives as an external mutation and may overwrite.

**Prevention:**
1. Use `react-mentions` or `@mentions/react` instead of Tribute.js. These are React-native solutions that handle the controlled input model correctly.
2. If keeping Tribute.js, wrap it in a component with `suppressContentEditableWarning` and use `useRef` to give Tribute a DOM node React does not manage. Never set `innerHTML` from React state on this element.
3. The `expandMentions()` function is pure (text in, text out) and can be extracted as-is into a utility module. Only the UI widget needs a React-specific solution.

**Detection:** Type `@` in the concept field. If the autocomplete menu does not appear, or if selecting a mention causes the text to reset/duplicate, the integration is broken.

**Phase relevance:** Phase where the Create tab form is migrated.

---

### Pitfall 7: CSS Variable Theme System Lost in Module Migration

**What goes wrong:** The current CSS uses `:root` CSS custom properties for theming (light/dark) with `[data-theme="dark"]` overrides. The entire `main.css` (~1800+ lines) is a single global stylesheet. If migrated to CSS Modules, the CSS custom properties (used across all components) become inaccessible unless explicitly imported or kept global. Component-scoped styles cannot reference variables defined in another module without a shared global stylesheet.

**Prevention:**
1. Keep the CSS custom property definitions (`:root` and `[data-theme="dark"]`) in a global stylesheet that is imported at the app root. This is NOT a CSS Module -- it is a plain `.css` file imported in `main.tsx`.
2. Migrate component-specific styles to CSS Modules incrementally. Each component gets a `.module.css` file that references the global CSS variables via `var(--accent)` etc. This works because CSS variables are inherited through the DOM, not through the module system.
3. Do NOT use styled-components or CSS-in-JS. The existing CSS is well-structured with variables and the migration cost to CSS-in-JS is high for zero benefit in this app.
4. Migrate CSS last, after component structure is stable. Rearranging styles while components are still being split causes double work.

**Detection:** Switch themes after migration. If colors do not change, or only some components change, the variable inheritance is broken.

**Phase relevance:** Should be addressed in the build system phase (global CSS import) and then incrementally as components are created.

---

### Pitfall 8: Docker Build Doubles in Size Without Multi-Stage

**What goes wrong:** The current Dockerfile is simple: copy files, install proxy deps, run Express. With Vite, the build stage needs `node_modules` for both the frontend (React, Vite, etc.) AND the proxy. If done naively in a single stage, the final image includes all dev dependencies (~200MB+ of node_modules) that are only needed at build time.

**Prevention:**
1. Use a multi-stage Dockerfile:
   - Stage 1 (build): `node:20-alpine`, install frontend deps, run `vite build`, output `dist/`
   - Stage 2 (production): `node:20-alpine`, install proxy deps only, copy `dist/` from stage 1, copy `proxy/`, run Express
2. Copy `package.json` and `package-lock.json` before source code in each stage so dependency layers cache independently from code changes.
3. Add `.dockerignore` for `node_modules/`, `dist/`, `.git/` to prevent sending gigabytes of context to the Docker daemon.
4. Use `--mount=type=cache,target=/root/.npm` in the build stage for faster rebuilds.

**Detection:** Compare final image size. Current image is ~150MB (alpine + git + proxy deps). Post-migration should be similar. If it exceeds 300MB, dev dependencies leaked into the production stage.

**Phase relevance:** Phase 1 (build system setup). The Dockerfile must be updated before anything else ships.

---

### Pitfall 9: Complex Form State Loses Sync Between Components

**What goes wrong:** The editor tab has ~15 editable fields (name, description, personality, scenario, firstMessage, systemPrompt, postHistoryInstructions, tags, plus lorebook entries). Currently, `main.js` reads/writes these directly via `document.getElementById().value`. In React, this state needs to live somewhere. If split across multiple components without a shared state container, editing a field in one component does not propagate to the card export, or saving reads stale values from a sibling component.

**Why it happens:** The `lockedFields` Set, the `originalCharacter` snapshot (for field-level reset), and the current character data are all interrelated state. Without a single source of truth (context, zustand, or lifted state), components diverge.

**Prevention:**
1. Use a single `useReducer` or a lightweight store (zustand) to hold the entire character object, locked fields set, and original character snapshot.
2. Each form field component receives its value from the store and dispatches changes back. No local state for field values.
3. The "Reset to AI version" feature requires comparing current vs original -- both must come from the same store.
4. Debounce store updates for text fields to avoid re-rendering 15 fields on every keystroke.

**Detection:** Edit a field, then immediately click "Download PNG." If the downloaded card does not reflect the edit, state is not synchronized.

**Phase relevance:** Phase where the Editor tab is built. Architectural decision needed before individual field components are created.

---

## Minor Pitfalls

### Pitfall 10: AbortController Lifecycle Mismatch

**What goes wrong:** The current code stores `currentAbortController` and `currentReader` as class properties and uses them to cancel in-flight requests when the user clicks "Stop." In React, if these are stored in state, aborting triggers a re-render; if stored in a ref but the component unmounts, the abort is never called and the stream continues in the background, leaking memory.

**Prevention:** Store AbortController in a `useRef`. In the cleanup function of the streaming `useEffect`, call `controller.abort()`. Test that navigating away from the Create tab during generation stops the stream.

**Phase relevance:** Streaming implementation phase.

---

### Pitfall 11: CDN Dependencies Must Move to npm

**What goes wrong:** `diff` and `tributejs` are currently loaded from jsDelivr CDN via `<script>` tags. In a Vite build, external CDN scripts are not bundled. They either need to be installed as npm packages or configured as Vite externals. If forgotten, the features that depend on them (card diffing, @mention autocomplete) silently break because the global variables (`Diff`, `Tribute`) are undefined.

**Prevention:** Install `diff` and `tributejs` (or their React alternatives) via npm during the build system setup phase. Import them as ES modules.

**Detection:** Check for `typeof Tribute === "undefined"` or `typeof Diff === "undefined"` guards in the current code -- these indicate CDN-loaded dependencies.

**Phase relevance:** Phase 1 (build system setup).

---

### Pitfall 12: Config Persistence Layer Needs Careful Migration

**What goes wrong:** The `Config` class uses a mix of `localStorage` (settings) and `sessionStorage` (API keys) with a complex `get`/`set` API using dot-notation paths (`api.text.apiKey`). It also has a `waitForConfig()` async method and server-side config merging. If this is naively converted to a React context, the server-side config fetch may not complete before components try to read values, causing undefined errors or flash-of-default-settings.

**Prevention:**
1. Keep the Config class as a non-React utility initially. Wrap it in a context provider that suspends or shows a loading state until `waitForConfig()` resolves.
2. Migrate settings UI to controlled React form components that read/write through the config utility.
3. Do not store API keys in React state -- keep them in sessionStorage/localStorage as today, accessed through the config utility.

**Phase relevance:** Phase 1 or 2. Config is needed by every other component, so it must be stable early.

---

### Pitfall 13: Split Pane and Drag Interactions Need Imperative Refs

**What goes wrong:** The split pane divider uses pointer capture (`setPointerCapture`), direct style manipulation (`left.style.flex`), and localStorage persistence. These are inherently imperative DOM interactions. Trying to make them "React-ish" with state-driven flex values causes janky dragging because each pixel of mouse movement triggers a re-render.

**Prevention:** Use `useRef` for the pane elements and handle drag events imperatively, same as the vanilla version. Only update React state (or localStorage) on `pointerup`. This is a valid pattern -- not everything needs to be declarative.

**Phase relevance:** Editor tab migration phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Build system (Vite + Express) | Proxy only works in dev (#2), Docker size (#8), CDN deps (#11) | Set up dual-mode serving from day 1; multi-stage Dockerfile; npm install CDN deps |
| Streaming/API layer | Stale closures in SSE (#1), AbortController lifecycle (#10) | Custom `useSSEStream` hook with refs; test abort on unmount |
| Create tab | @Mention contenteditable (#6), feature parity (#3) | Use `react-mentions` instead of Tribute; feature checklist before migrating |
| Editor tab | Form state sync (#9), split pane (#13), field locking (#3) | Central state store (useReducer/zustand); imperative refs for drag |
| Card export | PNG binary manipulation (#5) | Keep PNGEncoder as pure utility; validate output in SillyTavern |
| Parser replacement | Regex edge cases (#4) | Collect test fixtures first; separate parser change from UI change |
| CSS/theming | Theme variables (#7) | Global CSS for variables; CSS Modules for components; migrate CSS last |
| Config/settings | Persistence layer (#12) | Wrapper context with loading state; keep localStorage/sessionStorage access patterns |

## Sources

- [React useEffectEvent: stale closure solutions - LogRocket](https://blog.logrocket.com/react-useeffectevent/)
- [SSE in React implementation patterns](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)
- [Common Stale Closure Bugs in React - DEV Community](https://dev.to/cathylai/common-stale-closure-bugs-in-react-57l6)
- [React 18 Streaming Chat UI Stale State Fix](https://www.technetexperts.com/react-stream-state/)
- [Vite proxy only works in dev - Discussion #8043](https://github.com/vitejs/vite/discussions/8043)
- [Why Vite's Proxy Only Works in Dev](https://www.thatsoftwaredude.com/content/14128/working-with-vite-proxy)
- [Strategy and Tips for Migrating to React - Brainhub](https://brainhub.eu/library/migrating-to-react)
- [Migrating to React Step by Step - Xebia](https://xebia.com/blog/migrating-to-react-step-by-step/)
- [Optimizing Docker Builds with Multi-Stage Builds - React and Vite](https://medium.com/@ryanmambou/optimizing-docker-builds-a-practical-guide-to-multi-stage-builds-with-react-and-vite-c9692414961c)
- [How to Dockerize Vite](https://sliplane.io/blog/how-to-dockerize-vite)
- [HTMLCanvasElement.toBlob() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
- [Tribute.js - GitHub](https://github.com/zurb/tribute)
- [CSS Modules in React - OpenReplay](https://blog.openreplay.com/using-css-modules-in-react/)
- [vite-css-modules plugin](https://github.com/privatenumber/vite-css-modules)

---

*Pitfalls analysis: 2026-03-26*

