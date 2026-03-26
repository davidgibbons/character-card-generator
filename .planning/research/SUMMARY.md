# Project Research Summary

**Project:** Character Card Generator -- Vanilla JS to React/Vite Migration
**Domain:** SPA framework migration (LLM-powered character card tool)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

This is a small-to-medium single-page application (~3500 lines of frontend JS, 10 modules) being rewritten from vanilla JS with window globals and direct DOM manipulation to React 19 with Vite 8. The Express backend is untouched -- only the frontend migrates. The research unanimously recommends a **phased big-bang rewrite** rather than incremental migration, because the window-global architecture cannot coexist with ES module imports, and the app is small enough that rewrite risk is low. The existing app is the behavior specification: feature parity is the hard requirement, with no new user-facing features.

The recommended stack is React 19.2, Vite 8 (Rolldown-powered), CSS Modules for scoped styles with global CSS custom properties for theming, and React Context + useReducer for state management. The app has only ~4 state domains (config, character, generation status, library) which do not justify a state library. Key library additions include `react-resizable-panels` (replacing hand-rolled split pane), `react-mentions` (replacing Tribute.js contenteditable hack), and the `png-chunks` trio (replacing 660 lines of hand-rolled PNG encoding). TypeScript adoption during the rewrite provides type safety for the complex V2 character card spec.

The highest-risk areas are: (1) SSE streaming state management in React's closure model -- stale closures will silently eat tokens if not handled with refs and functional updaters; (2) silent feature parity loss during decomposition of the 1500-line monolithic `main.js` into components; and (3) the Vite dev proxy being development-only, requiring Express to serve `dist/` in production from day one. All three are solvable with known patterns, but each requires deliberate attention in the right phase.

## Key Findings

### Recommended Stack

The stack is well-established with high confidence across the board. Every major choice has a clear rationale and the project avoids unnecessary dependencies.

**Core technologies:**
- **Vite 8 + @vitejs/plugin-react v6:** Build tool with ESM-native Rolldown bundler, dev proxy to Express, HMR. Requires Node.js 20.19+ (recommend bumping Docker to `node:22-alpine`).
- **React 19.2 + React DOM:** Component model replaces the monolithic `main.js`. No React Router needed -- tabs are local state, not routes.
- **CSS Modules (built into Vite):** Scoped component styles with zero config. Global `:root` CSS custom properties preserved for theming. Avoids Tailwind migration overhead and CSS-in-JS runtime cost.
- **React Context + useReducer:** State management for ~4 domains (config, character, generation, library). Context is sufficient at this scale -- Zustand/Redux adds dependency weight with no measurable benefit.
- **react-resizable-panels:** Replaces hand-rolled split pane with a mature library (2.7M+ weekly npm downloads) that includes accessibility and built-in localStorage persistence.
- **react-mentions:** Replaces Tribute.js contenteditable approach with a textarea-overlay solution. Eliminates the entire class of contenteditable + React reconciliation bugs.
- **png-chunk-text + png-chunks-extract + png-chunks-encode:** Replaces 660-line hand-rolled PNG encoder. Small, focused, browser-compatible.

**Critical version requirement:** Vite 8 requires Node.js 20.19+ or 22.12+. Docker base image must be `node:22-alpine`.

**State management note:** STACK.md recommended Zustand while ARCHITECTURE.md and FEATURES.md recommended Context + useReducer. The recommendation here is **Context + useReducer** -- this app has ~4 state domains with clear ownership boundaries and no cross-cutting subscription patterns that would benefit from Zustand's selector model. If streaming re-renders become a performance issue, upgrade to Zustand for the generation store only. Start simple.

### Expected Features

**Must have (table stakes -- missing = regression):**
- SSE streaming with real-time token display, abort/cancel, content refusal detection
- Split-pane resizable layout with persisted ratio
- Tab-based navigation (Create / Editor / Library) with keyboard support
- @mention autocomplete with pill display and card context expansion
- PNG metadata read/write (V2 character card format, SillyTavern-compatible)
- Config panels with localStorage/sessionStorage persistence, content policy toggle
- Dark/light theme switching
- Character editor with field locking, changed-field highlighting, reset to AI version
- Library drawer with card/prompt CRUD, card history/diff, SillyTavern push/pull sync
- Image generation flow (LLM prompt generation + image API)
- Lorebook management (CRUD, auto-generate, embed in export)

**Should have (differentiators enabled by React):**
- Component-level error boundaries (errors in one panel do not crash the app)
- Independent loading states per component (not a single global spinner)
- TypeScript interfaces for V2 character card spec (catches field name errors at build time)
- Proper abort handling on navigation (cleanup in useEffect)
- Accessible ARIA tab roles

**Defer (v2+):**
- None. Feature parity is the hard requirement. Differentiators are woven into each phase, not separate work items.

**Anti-features (explicitly do NOT build):**
- React Router (no URL routing needed)
- CSS-in-JS / styled-components (runtime overhead, no benefit)
- Server-side rendering (client-only tool)
- Form library (React Hook Form, Formik -- ~25 inputs total, not worth it)
- Rich text editor (Slate, TipTap -- overkill for @mention pills)
- React Query / SWR (3-4 endpoints, plain fetch hooks suffice)
- Storybook (single-developer tool with ~15 components)

### Architecture Approach

Three-layer architecture: **Services** (pure logic, no React -- existing modules converted from window globals to ES module exports) -> **Hooks** (React state bridge -- each hook owns a state domain) -> **Components** (rendering). This preserves the existing separation between logic modules and UI while adding hooks as the bridge layer. The Express backend is completely unchanged; in production it serves Vite's `dist/` output via the existing `STATIC_ROOT` env var.

**Major components:**
1. **Services layer (7 modules):** `api.ts`, `config.ts`, `character-generator.ts`, `image-generator.ts`, `png-encoder.ts`, `storage.ts`, `prompts.ts` -- direct ports of existing window globals to ES modules
2. **Hooks layer (8 hooks):** `useConfig`, `useCharacterGeneration`, `useImageGeneration`, `useCardLibrary`, `usePromptLibrary`, `useLorebook`, `usePngExport`, `useSillyTavern`
3. **Components layer (~15 components):** Grouped by domain (`panels/`, `character/`, `library/`, `layout/`, `shared/`)
4. **Context providers (3):** `AppContext` (theme, active tab), `ConfigContext` (settings), `CharacterContext` (current character, generation state, locked fields)

**Key data flow:** User concept -> CreatePanel -> useCharacterGeneration hook -> character-generator service -> API fetch with SSE -> streaming state updates -> StreamingOutput re-renders -> parse complete -> EditorPanel receives character -> CharacterForm renders editable fields.

### Critical Pitfalls

1. **SSE streaming stale closures (#1, CRITICAL)** -- Streaming callbacks capture stale React state, causing lost tokens and garbled output. **Prevention:** Use `useRef` for accumulating content, functional updater `setState(prev => prev + token)`, throttled display updates. Encapsulate in a `useStreamingGeneration` hook.

2. **Vite proxy is dev-only (#2, CRITICAL)** -- `server.proxy` does not exist in production builds. API calls 404 in Docker. **Prevention:** Express serves `dist/` via `STATIC_ROOT=/app/dist` in production. Set this up in Phase 1 and test the Docker build immediately.

3. **Silent feature parity loss (#3, CRITICAL)** -- The monolithic `main.js` has ~40+ event listeners and implicit side-effect couplings that break silently when decomposed into components. **Prevention:** Extract a feature checklist from `init()` and `bindEvents()` before writing React code. Migrate vertically (one tab at a time), not horizontally (one layer at a time).

4. **Regex parser edge cases (#4, CRITICAL)** -- The LLM response parser uses fragile regex patterns tuned to observed variations. A new parser will have different failure modes. **Prevention:** Collect 20+ real LLM outputs as test fixtures. Keep existing regex parser during initial migration; replace parser in a separate phase.

5. **@Mention contenteditable vs React (#6, MODERATE)** -- Tribute.js mutates DOM directly, conflicting with React reconciliation. **Prevention:** Use `react-mentions` instead of Tribute.js. The `expandMentions()` function is pure and ports directly.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Build System + Service Layer
**Rationale:** Nothing else works without the Vite scaffold, proxy, TypeScript types, and service module conversions. The Dockerfile must be updated here to avoid the dev-only proxy pitfall (#2).
**Delivers:** Working Vite dev server with proxy to Express, all 7 service modules converted to ES imports, TypeScript type definitions for V2 character card spec, multi-stage Dockerfile with `STATIC_ROOT=/app/dist`.
**Addresses:** Build infrastructure, CDN-to-npm migration (diff, tributejs)
**Avoids:** Pitfall #2 (proxy dev-only), Pitfall #8 (Docker image bloat), Pitfall #11 (CDN deps)

### Phase 2: Config + Theme + Layout Shell
**Rationale:** Config is consumed by every other feature. Theme and layout shell (tabs, header, split pane) provide the visual frame for all subsequent phases.
**Delivers:** ConfigContext with localStorage/sessionStorage sync, settings panel, theme toggle, tab navigation, split-pane layout with react-resizable-panels.
**Addresses:** Config persistence, theme switching, tab navigation, split-pane layout
**Avoids:** Pitfall #7 (theme variable loss), Pitfall #12 (config persistence migration)

### Phase 3: Streaming Generation + Create Panel
**Rationale:** The primary user flow. Requires services and config from Phases 1-2. This is where the hardest React-specific pitfall (stale closures in SSE) must be solved.
**Delivers:** useCharacterGeneration hook with streaming, StreamingOutput component, MentionTextarea with react-mentions, CreatePanel with concept form.
**Addresses:** SSE streaming, @mention autocomplete, character generation
**Avoids:** Pitfall #1 (stale closures), Pitfall #6 (@mention contenteditable), Pitfall #10 (AbortController lifecycle)

### Phase 4: Editor Panel + Character Editing
**Rationale:** Depends on character data from generation. The editor is the most form-heavy component and requires careful state management.
**Delivers:** CharacterForm with controlled fields and field locking, CharacterPreview, EditorPanel with split pane, evaluate/revise flow.
**Addresses:** Character editing, field locking, changed-field highlighting, reset-to-AI
**Avoids:** Pitfall #9 (form state sync), Pitfall #13 (split pane imperative refs), Pitfall #3 (feature parity -- must preserve all editor behaviors)

### Phase 5: Image Generation + PNG Export
**Rationale:** Image generation is independent of card editing but export combines character data + image. PNG encoding is self-contained and should be one of the last features migrated.
**Delivers:** useImageGeneration hook, ImagePanel, usePngExport hook with png-chunks libraries, ExportActions (download PNG, copy JSON).
**Addresses:** Image generation, PNG metadata embedding, card export
**Avoids:** Pitfall #5 (PNG binary manipulation in React)

### Phase 6: Library + SillyTavern + Lorebook
**Rationale:** Library CRUD and external sync are secondary features that depend on complete character + image data. Lorebook is an editor sub-feature that can be built last.
**Delivers:** Library drawer with card/prompt CRUD, card history/diff with diff.js, SillyTavern push/pull sync, lorebook editor with auto-generation.
**Addresses:** All remaining table-stakes features, achieving full feature parity
**Avoids:** Pitfall #3 (feature parity -- final verification pass)

### Phase 7: CSS Migration + Polish + Cleanup
**Rationale:** CSS migration should come last after component structure is stable. Rearranging styles while components are being split causes double work.
**Delivers:** Component-scoped CSS Modules, cleaned-up global CSS custom properties, removal of old `src/scripts/` files, production Docker smoke test.
**Addresses:** CSS maintainability, production readiness
**Avoids:** Pitfall #7 (theme variables -- final cleanup)

### Phase Ordering Rationale

- **Dependency-driven:** Each phase builds on the prior. Services -> Config -> Generation -> Editing -> Export -> Library -> Polish follows the exact dependency graph from FEATURES.md.
- **Risk-front-loaded:** The hardest problems (SSE streaming, Vite proxy, service module conversion) are in Phases 1-3. If something goes fundamentally wrong, it surfaces early.
- **Vertically complete:** Each phase delivers a working subset of the app that can be tested end-to-end, rather than building all services first, then all hooks, then all components.
- **Parser deferred:** The LLM response parser (Pitfall #4) is migrated as-is inside the service layer (Phase 1). Replacing the fragile regex parser with a structured approach is a separate effort after the React migration is complete, to isolate regressions.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Streaming + Create):** SSE streaming in React has subtle closure and performance issues. The `useStreamingGeneration` hook design needs careful planning. Research the ref-based accumulation + throttled display pattern in detail.
- **Phase 5 (PNG Export):** The png-chunks libraries are older (last published ~2018-2019). Verify ESM browser compatibility during implementation. May need a thin wrapper or alternative if imports fail in Vite.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Build System):** Vite + React scaffold is thoroughly documented. The proxy config and Dockerfile patterns are verified from official docs and existing source code.
- **Phase 2 (Config + Theme):** Standard React Context + localStorage patterns. No novel problems.
- **Phase 4 (Editor):** Standard controlled form patterns. react-resizable-panels has excellent documentation.
- **Phase 6 (Library):** CRUD + list rendering is React's core competency. diff.js integration is straightforward.
- **Phase 7 (CSS + Polish):** CSS Modules are built into Vite with zero config.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are current stable releases with official documentation verified. Vite 8, React 19.2, CSS Modules are production-proven. |
| Features | HIGH | Feature list derived directly from existing codebase analysis. Every feature maps to a known React pattern. |
| Architecture | HIGH | Three-layer service/hook/component architecture is standard React. Migration strategy (big-bang rewrite) is justified by app size and architecture constraints. |
| Pitfalls | HIGH | Pitfalls sourced from real migration case studies and React-specific known issues. Prevention strategies are concrete and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **png-chunks ESM compatibility:** These packages were last published in 2018-2019. They may need a wrapper for Vite's ESM bundling. Validate during Phase 1 by attempting an import. Fallback: keep the hand-rolled PNG encoder as a service module and refactor later.
- **react-mentions visual parity:** The switch from Tribute.js contenteditable pills to react-mentions textarea overlay changes the visual appearance of mentions. Validate that the overlay styling is acceptable. Fallback: use `react-rich-mentions` for true contenteditable pills, accepting the added complexity.
- **State management escalation path:** Starting with Context + useReducer. If streaming re-renders cause performance issues in Phase 3, the `useCharacterGeneration` hook may need to move to Zustand for selector-based subscriptions. This is a low-risk upgrade path -- Zustand can be adopted per-store without changing the rest of the app.
- **Node.js version in Docker:** Current `node:20-alpine` may not satisfy Vite 8's requirement of Node.js 20.19+. Verify the exact patch version or bump to `node:22-alpine` in Phase 1.

## Sources

### Primary (HIGH confidence)
- [Vite 8.0 Announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown bundler, Node.js requirements
- [Vite Server Options](https://vite.dev/config/server-options) -- Dev proxy configuration
- [Vite Build Options](https://vite.dev/config/build-options) -- Build output configuration
- [Vite Backend Integration Guide](https://vite.dev/guide/backend-integration) -- Express integration pattern
- [React 19.2 Versions](https://react.dev/versions) -- React 19.2.1 stable
- [@vitejs/plugin-react npm](https://www.npmjs.com/package/@vitejs/plugin-react) -- v6.0.1, Oxc-based transforms
- Existing source code: `proxy/server.js` line 87 (`STATIC_ROOT` env var) -- verified directly

### Secondary (MEDIUM confidence)
- [Zustand GitHub](https://github.com/pmndrs/zustand) -- v5.0.8, API documentation
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) -- 2.7M+ weekly npm downloads
- [react-mentions npm](https://www.npmjs.com/package/react-mentions) -- 460K weekly npm downloads
- [React State Management 2026](https://www.pkgpulse.com/blog/state-of-react-state-management-2026) -- ecosystem landscape
- [Robin Wieruch: React Folder Structure](https://www.robinwieruch.de/react-folder-structure/) -- project structure patterns
- [Brainhub: Migrating to React](https://brainhub.eu/library/migrating-to-react) -- migration strategy
- [SSE in React (OneUptime, 2026)](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) -- streaming patterns

### Tertiary (LOW confidence)
- [png-chunk-text GitHub](https://github.com/hughsk/png-chunk-text) -- last updated ~2018, functional but aging
- [png-chunks-extract npm](https://www.npmjs.com/package/png-chunks-extract) -- last updated ~2019
- [SillyTavern Character Management](https://deepwiki.com/SillyTavern/SillyTavern/5.1-character-management) -- V2 card format reference

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
