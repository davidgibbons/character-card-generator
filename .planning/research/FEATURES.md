# Feature Landscape

**Domain:** Vanilla JS to React/Vite migration of a character card generator
**Researched:** 2026-03-26

## Table Stakes

Features users expect. Missing = regression from the current app.

### Streaming LLM Responses (SSE to React State)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SSE stream parsing with real-time token display | Core UX -- users see character being written token-by-token | Medium | Current: `handleStreamResponse()` in `api.js` reads `ReadableStream`, calls `onStream(token, fullContent)` callback. React: custom hook `useStreamingResponse()` that manages `useState` for accumulated text + `useRef` for the reader. Pattern is well-established -- `fetch` + `ReadableStream` + `TextDecoder` piped into React state. No library needed; plain `fetch` with `getReader()` is the standard. Avoid `EventSource` API (doesn't support POST). |
| Abort/cancel mid-stream | Users can stop generation | Low | Current: `AbortController` + stored `currentReader`. React: pass `AbortController` signal via context or return abort fn from the hook. |
| Stream display in a scrolling container | Visual feedback during generation | Low | Current: `.stream-box` pre element with auto-scroll. React: `<StreamOutput>` component with `useEffect` scroll-to-bottom on content change. |
| Content refusal detection | Detects when LLM declines content | Low | Post-stream validation. Same logic, just runs after the hook resolves. |

**Implementation approach:** A single `useStreamingGeneration` custom hook encapsulating fetch, stream parsing, abort, and accumulated text state. The hook returns `{ content, isStreaming, error, abort }`. Components subscribe to this hook's state -- React re-renders handle the display automatically. This replaces the callback-driven pattern in the current `api.js`.

**Confidence:** HIGH -- this is a well-documented pattern used by ChatGPT, Vercel AI SDK, and every LLM frontend.

### Split-Pane Resizable Layout

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Horizontal split between input and output panes | Core layout -- users resize to preference | Low | Current: hand-rolled pointer events on a divider, stores ratio in `localStorage`. React: use **react-resizable-panels** (2.7M+ weekly npm downloads, by Brian Vaughn of React core team). API: `<PanelGroup>` / `<Panel>` / `<PanelResizeHandle>`. Supports persistence via `autoSaveId` prop (localStorage built-in). |
| Mobile collapse to stacked layout | Responsive design | Low | Current: CSS media query at 700px disables split. React: same approach -- CSS media query or conditionally render single-column layout based on a `useMediaQuery` hook. |
| Persisted split ratio | User preference remembered | Low | Built into `react-resizable-panels` via `autoSaveId`. |

**Implementation approach:** Replace hand-rolled split pane with `react-resizable-panels`. Direct feature parity with less code. The library handles accessibility (keyboard resizing) that the current implementation lacks.

**Confidence:** HIGH -- `react-resizable-panels` is the clear ecosystem winner.

### Tab-Based Navigation (No Router)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create / Editor / Library tabs | Core navigation between app sections | Low | Current: manual DOM class toggling on `.tab-btn` and `.tab-content` elements with `activeTab` state. React: simple `useState<'create' \| 'editor' \| 'library'>` with conditional rendering. No router needed -- these are in-page view switches, not URL-addressable routes. |
| Sub-tabs within Editor (Character/Image, Lorebook) | Nested navigation | Low | Same pattern, nested state. |
| Keyboard navigation (arrow keys between tabs) | Accessibility | Low | Use `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA pattern. Can use Radix `Tabs` primitive or build with 20 lines of code. |
| Programmatic tab switching | Generation flow auto-switches to editor | Low | Lift tab state to a shared context or parent component. Call `setActiveTab('editor')` from generation logic. |

**Implementation approach:** A lightweight `<Tabs>` component (or Radix UI `Tabs` primitive if adopting a headless UI library). No React Router -- this is local view state, not routing. The current app has no URL-based navigation and adding it is out of scope for a parity migration.

**Confidence:** HIGH -- trivial React pattern.

### @Mention Autocomplete with Pills

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `@` trigger opens suggestion dropdown | Users reference library cards in concept textarea | High | Current: Tribute.js on a contenteditable div that replaces the textarea. Inserts `<span class="mention-pill">` elements. React options: **react-mentions** (460K weekly downloads, mature, textarea-based with overlay rendering) or custom contenteditable. |
| Styled pill display for mentions | Visual distinction of referenced cards | Medium | `react-mentions` supports custom `displayTransform` and CSS styling for mention highlights. It renders mentions as styled spans within a textarea overlay -- visually similar to pills without contenteditable complexity. |
| Async card list lookup with caching | Fetches card names from storage API | Low | `react-mentions` accepts async `data` callback. Cache with `useMemo` or a simple TTL cache. |
| Mention expansion to card context | `@CardName` expanded to full card data before sending to LLM | Low | Pure function `expandMentions()` -- already framework-agnostic logic. Port directly. |

**Implementation approach:** Use **react-mentions** instead of Tribute.js. Key difference: `react-mentions` works with a regular textarea (using a transparent overlay for styling) rather than contenteditable. This avoids the entire class of contenteditable bugs (cursor positioning, paste handling, mobile keyboard issues). The current Tribute.js approach replaces textareas with contenteditable divs and bridges `.value` -- `react-mentions` eliminates this hack entirely. Trade-off: mentions won't be true DOM pills (non-editable spans), but will be visually styled regions in the textarea overlay. This is the same approach Facebook, Slack, and GitHub use. If true contenteditable pills are required, `react-rich-mentions` is the alternative, but the added complexity is not justified for this use case.

**Confidence:** HIGH -- `react-mentions` is the established React solution for this exact problem.

### PNG Metadata Manipulation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Write V2 character card JSON into PNG tEXt chunk | Export cards as SillyTavern-compatible PNGs | Medium | Current: hand-rolled `PNGEncoder` class that parses PNG binary format, creates tEXt chunks with `chara` keyword containing base64-encoded character JSON. React: the PNG logic is framework-agnostic (operates on `ArrayBuffer`/`Blob`). Can port directly as a utility module. For replacing hand-rolled code, use **png-chunk-text** + **png-chunks-extract** + **png-chunks-encode** (established, browser-compatible). Or use **meta-png** (zero-dependency, simpler API). |
| Read metadata from existing PNGs | Import cards | Low | Same libraries support reading. `png-chunks-extract` + `png-chunk-text` for decode. |
| Image blob to PNG conversion pipeline | Character image + metadata = downloadable card | Medium | Current: fetches image URL, converts to blob, injects metadata, triggers download. React: same pipeline in a utility function, triggered by a button click handler. No React-specific concerns. |

**Implementation approach:** Extract PNG encoding into a standalone utility module (`lib/png-metadata.ts`). Replace the hand-rolled chunk parser with **png-chunk-text** + **png-chunks-extract** + **png-chunks-encode** for reliability. These are small, focused libraries (~2KB each) that handle CRC calculation and chunk formatting correctly. The current hand-rolled encoder works but is a maintenance liability and has edge cases around malformed PNGs.

**Confidence:** HIGH -- PNG chunk manipulation is a solved problem with established libraries.

### Form State Management for Config Panels

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| API settings modal (text API, image API, SillyTavern) | Users configure multiple API endpoints, keys, models | Medium | Current: `Config` class reads/writes localStorage/sessionStorage, `saveToForm()`/`saveFromForm()` syncs DOM inputs. React: controlled components with a config context. Use a `useConfig` hook backed by `useReducer` + localStorage sync. |
| Session vs persistent key storage toggle | Security-conscious API key handling | Low | `sessionStorage` for keys by default, `localStorage` opt-in via toggle. Same browser APIs, just wire the toggle to the storage target. |
| Nested config structure (api.text.baseUrl, api.image.model, etc.) | Deep config object with dot-path access | Low | Current: `config.get('api.text.baseUrl')` with dot-path resolver. React: same pattern, or flatten into a reducer. Could use `immer` for ergonomic nested updates if desired, but `useReducer` is sufficient. |
| Content policy prefix toggle | Global toggle affecting all LLM requests | Low | Boolean in config context, consumed by API layer. |
| Prompt overrides (per-prompt customization) | Power users customize LLM prompts | Medium | Current: modal with textarea per prompt, stored in config. React: modal component with controlled textarea, saves to config context. |

**Implementation approach:** A `ConfigProvider` context with `useReducer` for the nested config object. A `useConfig()` hook for reading/writing. localStorage/sessionStorage sync in a `useEffect`. No form library needed -- the config panel is a small number of inputs, not a complex dynamic form. Controlled components with the config context are sufficient.

**Confidence:** HIGH -- standard React state management patterns.

### Dark/Light Theme Switching

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Toggle between dark and light themes | User preference | Low | Current: sets `data-theme="dark"` on `<html>`, CSS uses `[data-theme="dark"]` selectors with overrides. React: same approach works perfectly. Use a `useTheme` hook that reads/writes `localStorage` and sets the `data-theme` attribute. No CSS-in-JS needed. |
| Persisted theme preference | Remember across sessions | Low | `localStorage.getItem('theme')` -- identical to current. |
| Icon swap (moon/sun) | Visual indicator | Low | Conditional rendering based on theme state. |

**Implementation approach:** A `useTheme()` hook that manages the `data-theme` attribute on `document.documentElement` and persists to localStorage. The CSS custom properties approach used currently is the correct pattern -- it works with any CSS methodology and doesn't require React-specific theming libraries. Migrate the `[data-theme="dark"]` CSS overrides to use CSS custom properties more consistently (the current CSS duplicates many selectors that could use `--var` swaps instead).

**Confidence:** HIGH -- `data-theme` attribute + CSS custom properties is the standard approach.

### Character Editor with Field Locking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Editable form with all character fields | Users review and edit generated characters | Medium | Current: `displayCharacter()` populates DOM inputs from `currentCharacter` object. React: controlled form components bound to character state. |
| Field lock/unlock toggles | Lock fields during re-generation to preserve edits | Medium | Current: `lockedFields` Set, checked during generation to preserve values. React: `useState<Set<string>>` for locked fields, generation logic checks before overwriting. |
| Changed field highlighting after regeneration | Visual diff of what changed | Low | Current: compares previous field values, adds CSS class. React: compute diff in a `useMemo`, apply conditional className. |
| Reset to AI-generated version | Undo all manual edits | Low | Store original in state, reset handler copies it back. |

**Implementation approach:** A `CharacterEditor` component with `useReducer` for character state (many interdependent fields). Field lock state as a sibling `useState`. The editor is the natural home for character data -- lift it to context if other components need access (e.g., the export flow).

**Confidence:** HIGH -- standard controlled form pattern.

### Library Drawer and CRUD

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slide-out library drawer with card/prompt lists | Browse and manage saved cards | Medium | Current: drawer with backdrop, card list, click-to-load. React: `<LibraryDrawer>` component with open/close state, fetches card list from API. |
| Card and prompt CRUD (save, load, delete) | Persistence | Medium | Current: REST calls to `/api/cards` and `/api/prompts`. React: custom hooks `useCards()` and `usePrompts()` wrapping fetch calls with loading/error state. |
| Card history and diff viewing | Version control for cards | Medium | Current: fetches git history, renders diff with `diff.js` library. React: same `diff.js` library, render diff output in a modal component. |
| SillyTavern push/pull sync | Sync cards with external SillyTavern instance | Medium | Current: REST calls to proxy which forwards to SillyTavern API. React: same API calls, wrapped in hooks. |

**Implementation approach:** Data-fetching hooks (`useCards`, `usePrompts`, `useCardHistory`) that encapsulate the REST API calls and manage loading/error states. The library drawer is a presentational component consuming these hooks. Consider `useSWR` or `@tanstack/react-query` for caching and revalidation if the library grows large, but plain `useEffect` + `useState` is sufficient for the current scale.

**Confidence:** HIGH -- CRUD + list rendering is React's bread and butter.

### Image Generation Flow

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Generate image from character description | LLM creates prompt, sends to image API | Medium | Current: two-step flow (LLM generates image prompt, then image API generates image). React: same flow in a custom hook or action. |
| Image preview and prompt editing | Users see and can re-roll images | Low | Controlled state for image URL and prompt text. |
| Reference image upload with vision model description | Upload an image, get description via vision model | Medium | File input + `FileReader` + vision API call. Framework-agnostic logic. |
| Dual image API support (OpenAI-compatible + SD API) | Works with multiple image backends | Low | Proxy handles API detection -- frontend just sends to one endpoint. |

**Implementation approach:** `useImageGeneration` hook wrapping the two-step generation flow. Image state (URL, prompt, loading) managed in the hook. The proxy abstraction means the frontend doesn't need to know which image API is in use.

**Confidence:** HIGH.

### Lorebook Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Lorebook entry CRUD (add, edit, delete) | Manage world-building entries | Medium | Current: accordion UI in editor tab with per-entry forms. React: `<LorebookEditor>` component with dynamic form list. |
| Auto-generate lorebook during character creation | Checkbox to generate entries alongside character | Low | Existing API call, just wire the checkbox state to the generation flow. |
| Lorebook entries embedded in card export | Entries included in V2 PNG metadata | Low | Already part of character data structure, flows through PNG export. |

**Implementation approach:** `<LorebookEditor>` component with `useReducer` for the entries array. Each entry rendered as an expandable section with controlled inputs.

**Confidence:** HIGH.

## Differentiators

Features that the React migration enables or improves. Not in the current app or significantly better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Component-level error boundaries** | Errors in one panel don't crash the whole app. Currently, a JS error in image generation can break the entire UI. | Low | React `ErrorBoundary` components around each major section (editor, library, image preview). Huge reliability improvement for free. |
| **Proper loading states per component** | Each section has independent loading indicators instead of a single global spinner. | Low | Each hook manages its own `isLoading` state. The current app has a single `isGenerating` flag that blocks the whole UI. |
| **Hot module replacement during development** | Vite HMR means instant feedback when editing components. Currently, every change requires a full page reload and re-entering config. | Low | Vite provides this out of the box. Major DX improvement. |
| **TypeScript for character data structures** | Type-safe character card V2 spec. Current code has no types, leading to runtime errors from misspelled field names. | Medium | Define `CharacterCardV2` interface matching the spec. Catches errors at build time. |
| **Optimistic UI updates for library operations** | Save/delete feel instant, roll back on error. Current implementation waits for server response before updating UI. | Low | Pattern: update local state immediately, revert on API error. |
| **Proper abort handling across components** | Navigate away from generation tab cleanly aborts in-progress streams. Currently, orphaned streams continue in background. | Low | Cleanup in `useEffect` return function. React's lifecycle model handles this naturally. |
| **CSS custom property theming (cleanup)** | Current CSS duplicates ~50 selectors for dark mode. Migrate to CSS custom property swaps for cleaner, more maintainable theming. | Medium | Define `--color-bg`, `--color-text`, etc. on `:root` and `[data-theme="dark"]`. Replace all hardcoded color values. Not a new feature but a significant improvement in CSS maintainability. |
| **Accessible tab navigation** | Current tabs lack proper ARIA roles. React makes it easy to add `role="tablist"`, `aria-selected`, `aria-controls`. | Low | Use Radix Tabs or add ARIA attributes to custom tab component. |

## Anti-Features

Features to explicitly NOT build during the refactor.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **React Router / URL-based navigation** | The app is a single-view tool, not a multi-page app. Adding routing adds complexity with no user benefit. Tab state is ephemeral and shouldn't be in the URL. | Keep `useState` for tab switching. Add routing only if a future milestone needs deep-linking. |
| **Global state management library (Redux, Zustand, Jotai)** | The app has ~5 pieces of shared state (config, current character, theme, library data, generation status). Context + useReducer is sufficient. Adding a state library for this scale adds dependency weight and learning curve for no benefit. | Use React Context for shared state. Evaluate state libraries only if prop drilling becomes painful across 3+ levels. |
| **CSS-in-JS (styled-components, Emotion)** | The current CSS is well-structured in a single file with BEM-ish naming. CSS-in-JS adds bundle size, runtime overhead, and migration effort with no clear benefit for this app's scale. | Keep CSS files. Use CSS Modules if class name collisions become an issue. Vite supports CSS Modules out of the box. |
| **Server-side rendering (Next.js, Remix)** | This is a client-side tool. There's no SEO requirement, no public pages, no need for server rendering. SSR adds massive complexity. | Keep it as a Vite SPA with static asset output served by the existing Express server. |
| **Form library (React Hook Form, Formik)** | The config panel has ~15 inputs. The character editor has ~10 fields. These are small enough for controlled components. A form library adds abstraction for no benefit at this scale. | Controlled components with `useState` / `useReducer`. Re-evaluate if validation rules become complex. |
| **Rich text editor (Slate, TipTap, Draft.js)** | The only "rich" element is the @mention pills. Bringing in a full rich text editor for one feature is massive overkill. | Use `react-mentions` which handles @mention UI within a regular textarea. No contenteditable needed. |
| **Storybook** | Useful for design systems, overkill for a single-developer tool with ~15 components. | Build and test components in the running app. Add Storybook only if the component count exceeds 30+. |
| **React Query / SWR for data fetching** | Only 3-4 endpoints are called (cards list, prompts list, card detail, history). The caching and revalidation features of these libraries aren't needed at this scale. | Plain `useEffect` + `useState` fetch hooks. Introduce data fetching library only if cache invalidation becomes painful. |

## Feature Dependencies

```
Config System (context + persistence)
  |
  +---> API Layer (needs config for endpoints, keys, timeouts)
  |       |
  |       +---> Streaming Generation (needs API layer)
  |       |       |
  |       |       +---> Character Editor (displays generation results)
  |       |       |       |
  |       |       |       +---> Field Locking (editor feature)
  |       |       |       +---> Lorebook Editor (editor sub-feature)
  |       |       |
  |       |       +---> @Mention Expansion (runs before generation)
  |       |
  |       +---> Image Generation (needs API layer)
  |       |
  |       +---> Library CRUD (needs API layer for storage endpoints)
  |               |
  |               +---> @Mention Autocomplete (needs card list from library)
  |               +---> Card History/Diff (needs library)
  |               +---> SillyTavern Sync (needs library + API layer)
  |
  +---> Theme System (reads from config/localStorage)

PNG Export (needs character data + image blob, standalone utility)

Split Pane Layout (standalone, no dependencies)
Tab Navigation (standalone, no dependencies)
```

## MVP Recommendation

### Phase 1 - Foundation (must be first)
1. **Config system** (context, persistence, useConfig hook)
2. **Theme switching** (useTheme hook, CSS custom properties)
3. **Tab navigation** (simple state-based tabs)
4. **Split-pane layout** (react-resizable-panels)

### Phase 2 - Core Generation Loop
5. **API layer** (fetch wrapper, streaming hook)
6. **Streaming LLM display** (useStreamingGeneration hook + StreamOutput component)
7. **Character editor** (controlled form, field locking)
8. **@Mention autocomplete** (react-mentions on concept textarea)

### Phase 3 - Persistence and Export
9. **Library CRUD** (cards and prompts hooks)
10. **Library drawer** (UI component)
11. **PNG metadata export** (utility module with png-chunk-text)
12. **Image generation flow** (useImageGeneration hook)

### Phase 4 - Advanced Features
13. **Lorebook editor** (CRUD within character editor)
14. **Card history and diff** (diff.js integration)
15. **SillyTavern sync** (push/pull via API)
16. **Prompt override editor** (modal with per-prompt customization)

**Defer:** None of the table stakes features can be deferred -- feature parity is a hard requirement. The differentiators (error boundaries, TypeScript interfaces, CSS cleanup) should be woven into each phase as they're encountered, not treated as separate work items.

## Sources

- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) -- 2.7M+ weekly npm downloads, by React core team member Brian Vaughn
- [react-mentions](https://www.npmjs.com/package/react-mentions) -- 460K weekly npm downloads, mature @mention solution
- [png-chunk-text](https://github.com/hughsk/png-chunk-text) -- PNG tEXt chunk read/write, browser-compatible
- [meta-png](https://www.npmjs.com/package/meta-png) -- zero-dependency PNG metadata library
- [Streaming LLM Responses Guide](https://dev.to/pockit_tools/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534) -- comprehensive SSE + React pattern guide (2025)
- [react-rich-mentions](https://github.com/koala-interactive/react-rich-mentions) -- contenteditable alternative to react-mentions (if true pills needed)
- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) -- accessible headless tab primitive

# Feature Landscape

**Domain:** Vanilla JS to React/Vite migration of a character card generator
**Researched:** 2026-03-26

## Table Stakes

Features users expect. Missing = regression from the current app.

### Streaming LLM Responses (SSE to React State)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SSE stream parsing with real-time token display | Core UX -- users see character being written token-by-token | Medium | Current: `handleStreamResponse()` in `api.js` reads `ReadableStream`, calls `onStream(token, fullContent)` callback. React: custom hook `useStreamingResponse()` that manages `useState` for accumulated text + `useRef` for the reader. Pattern is well-established -- `fetch` + `ReadableStream` + `TextDecoder` piped into React state. No library needed; plain `fetch` with `getReader()` is the standard. Avoid `EventSource` API (doesn't support POST). |
| Abort/cancel mid-stream | Users can stop generation | Low | Current: `AbortController` + stored `currentReader`. React: pass `AbortController` signal via context or return abort fn from the hook. |
| Stream display in a scrolling container | Visual feedback during generation | Low | Current: `.stream-box` pre element with auto-scroll. React: `<StreamOutput>` component with `useEffect` scroll-to-bottom on content change. |
| Content refusal detection | Detects when LLM declines content | Low | Post-stream validation. Same logic, just runs after the hook resolves. |

**Implementation approach:** A single `useStreamingGeneration` custom hook encapsulating fetch, stream parsing, abort, and accumulated text state. The hook returns `{ content, isStreaming, error, abort }`. Components subscribe to this hook's state -- React re-renders handle the display automatically. This replaces the callback-driven pattern in the current `api.js`.

**Confidence:** HIGH -- this is a well-documented pattern used by ChatGPT, Vercel AI SDK, and every LLM frontend.

### Split-Pane Resizable Layout

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Horizontal split between input and output panes | Core layout -- users resize to preference | Low | Current: hand-rolled pointer events on a divider, stores ratio in `localStorage`. React: use **react-resizable-panels** (2.7M+ weekly npm downloads, by Brian Vaughn of React core team). API: `<PanelGroup>` / `<Panel>` / `<PanelResizeHandle>`. Supports persistence via `autoSaveId` prop (localStorage built-in). |
| Mobile collapse to stacked layout | Responsive design | Low | Current: CSS media query at 700px disables split. React: same approach -- CSS media query or conditionally render single-column layout based on a `useMediaQuery` hook. |
| Persisted split ratio | User preference remembered | Low | Built into `react-resizable-panels` via `autoSaveId`. |

**Implementation approach:** Replace hand-rolled split pane with `react-resizable-panels`. Direct feature parity with less code. The library handles accessibility (keyboard resizing) that the current implementation lacks.

**Confidence:** HIGH -- `react-resizable-panels` is the clear ecosystem winner.

### Tab-Based Navigation (No Router)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create / Editor / Library tabs | Core navigation between app sections | Low | Current: manual DOM class toggling on `.tab-btn` and `.tab-content` elements with `activeTab` state. React: simple `useState` with conditional rendering. No router needed -- these are in-page view switches, not URL-addressable routes. |
| Sub-tabs within Editor (Character/Image, Lorebook) | Nested navigation | Low | Same pattern, nested state. |
| Keyboard navigation (arrow keys between tabs) | Accessibility | Low | Use `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA pattern. Can use Radix `Tabs` primitive or build with 20 lines of code. |
| Programmatic tab switching | Generation flow auto-switches to editor | Low | Lift tab state to a shared context or parent component. Call `setActiveTab('editor')` from generation logic. |

**Implementation approach:** A lightweight `<Tabs>` component (or Radix UI `Tabs` primitive if adopting a headless UI library). No React Router -- this is local view state, not routing. The current app has no URL-based navigation and adding it is out of scope for a parity migration.

**Confidence:** HIGH -- trivial React pattern.

### @Mention Autocomplete with Pills

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `@` trigger opens suggestion dropdown | Users reference library cards in concept textarea | High | Current: Tribute.js on a contenteditable div that replaces the textarea. Inserts `<span class="mention-pill">` elements. React options: **react-mentions** (460K weekly downloads, mature, textarea-based with overlay rendering) or custom contenteditable. |
| Styled pill display for mentions | Visual distinction of referenced cards | Medium | `react-mentions` supports custom `displayTransform` and CSS styling for mention highlights. It renders mentions as styled spans within a textarea overlay -- visually similar to pills without contenteditable complexity. |
| Async card list lookup with caching | Fetches card names from storage API | Low | `react-mentions` accepts async `data` callback. Cache with `useMemo` or a simple TTL cache. |
| Mention expansion to card context | `@CardName` expanded to full card data before sending to LLM | Low | Pure function `expandMentions()` -- already framework-agnostic logic. Port directly. |

**Implementation approach:** Use **react-mentions** instead of Tribute.js. Key difference: `react-mentions` works with a regular textarea (using a transparent overlay for styling) rather than contenteditable. This avoids the entire class of contenteditable bugs (cursor positioning, paste handling, mobile keyboard issues). The current Tribute.js approach replaces textareas with contenteditable divs and bridges `.value` -- `react-mentions` eliminates this hack entirely. Trade-off: mentions won't be true DOM pills (non-editable spans), but will be visually styled regions in the textarea overlay. This is the same approach Facebook, Slack, and GitHub use. If true contenteditable pills are required, `react-rich-mentions` is the alternative, but the added complexity is not justified for this use case.

**Confidence:** HIGH -- `react-mentions` is the established React solution for this exact problem.

### PNG Metadata Manipulation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Write V2 character card JSON into PNG tEXt chunk | Export cards as SillyTavern-compatible PNGs | Medium | Current: hand-rolled `PNGEncoder` class that parses PNG binary format, creates tEXt chunks with `chara` keyword containing base64-encoded character JSON. React: the PNG logic is framework-agnostic (operates on `ArrayBuffer`/`Blob`). Can port directly as a utility module. For replacing hand-rolled code, use **png-chunk-text** + **png-chunks-extract** + **png-chunks-encode** (established, browser-compatible). Or use **meta-png** (zero-dependency, simpler API). |
| Read metadata from existing PNGs | Import cards | Low | Same libraries support reading. `png-chunks-extract` + `png-chunk-text` for decode. |
| Image blob to PNG conversion pipeline | Character image + metadata = downloadable card | Medium | Current: fetches image URL, converts to blob, injects metadata, triggers download. React: same pipeline in a utility function, triggered by a button click handler. No React-specific concerns. |

**Implementation approach:** Extract PNG encoding into a standalone utility module (`lib/png-metadata.ts`). Replace the hand-rolled chunk parser with **png-chunk-text** + **png-chunks-extract** + **png-chunks-encode** for reliability. These are small, focused libraries (~2KB each) that handle CRC calculation and chunk formatting correctly. The current hand-rolled encoder works but is a maintenance liability and has edge cases around malformed PNGs.

**Confidence:** HIGH -- PNG chunk manipulation is a solved problem with established libraries.

### Form State Management for Config Panels

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| API settings modal (text API, image API, SillyTavern) | Users configure multiple API endpoints, keys, models | Medium | Current: `Config` class reads/writes localStorage/sessionStorage, `saveToForm()`/`saveFromForm()` syncs DOM inputs. React: controlled components with a config context. Use a `useConfig` hook backed by `useReducer` + localStorage sync. |
| Session vs persistent key storage toggle | Security-conscious API key handling | Low | `sessionStorage` for keys by default, `localStorage` opt-in via toggle. Same browser APIs, just wire the toggle to the storage target. |
| Nested config structure (api.text.baseUrl, api.image.model, etc.) | Deep config object with dot-path access | Low | Current: `config.get('api.text.baseUrl')` with dot-path resolver. React: same pattern, or flatten into a reducer. Could use `immer` for ergonomic nested updates if desired, but `useReducer` is sufficient. |
| Content policy prefix toggle | Global toggle affecting all LLM requests | Low | Boolean in config context, consumed by API layer. |
| Prompt overrides (per-prompt customization) | Power users customize LLM prompts | Medium | Current: modal with textarea per prompt, stored in config. React: modal component with controlled textarea, saves to config context. |

**Implementation approach:** A `ConfigProvider` context with `useReducer` for the nested config object. A `useConfig()` hook for reading/writing. localStorage/sessionStorage sync in a `useEffect`. No form library needed -- the config panel is a small number of inputs, not a complex dynamic form. Controlled components with the config context are sufficient.

**Confidence:** HIGH -- standard React state management patterns.

### Dark/Light Theme Switching

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Toggle between dark and light themes | User preference | Low | Current: sets `data-theme="dark"` on `<html>`, CSS uses `[data-theme="dark"]` selectors with overrides. React: same approach works perfectly. Use a `useTheme` hook that reads/writes `localStorage` and sets the `data-theme` attribute. No CSS-in-JS needed. |
| Persisted theme preference | Remember across sessions | Low | `localStorage.getItem('theme')` -- identical to current. |
| Icon swap (moon/sun) | Visual indicator | Low | Conditional rendering based on theme state. |

**Implementation approach:** A `useTheme()` hook that manages the `data-theme` attribute on `document.documentElement` and persists to localStorage. The CSS custom properties approach used currently is the correct pattern -- it works with any CSS methodology and doesn't require React-specific theming libraries. Migrate the `[data-theme="dark"]` CSS overrides to use CSS custom properties more consistently (the current CSS duplicates many selectors that could use `--var` swaps instead).

**Confidence:** HIGH -- `data-theme` attribute + CSS custom properties is the standard approach.

### Character Editor with Field Locking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Editable form with all character fields | Users review and edit generated characters | Medium | Current: `displayCharacter()` populates DOM inputs from `currentCharacter` object. React: controlled form components bound to character state. |
| Field lock/unlock toggles | Lock fields during re-generation to preserve edits | Medium | Current: `lockedFields` Set, checked during generation to preserve values. React: `useState<Set<string>>` for locked fields, generation logic checks before overwriting. |
| Changed field highlighting after regeneration | Visual diff of what changed | Low | Current: compares previous field values, adds CSS class. React: compute diff in a `useMemo`, apply conditional className. |
| Reset to AI-generated version | Undo all manual edits | Low | Store original in state, reset handler copies it back. |

**Implementation approach:** A `CharacterEditor` component with `useReducer` for character state (many interdependent fields). Field lock state as a sibling `useState`. The editor is the natural home for character data -- lift it to context if other components need access (e.g., the export flow).

**Confidence:** HIGH -- standard controlled form pattern.

### Library Drawer and CRUD

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slide-out library drawer with card/prompt lists | Browse and manage saved cards | Medium | Current: drawer with backdrop, card list, click-to-load. React: `<LibraryDrawer>` component with open/close state, fetches card list from API. |
| Card and prompt CRUD (save, load, delete) | Persistence | Medium | Current: REST calls to `/api/cards` and `/api/prompts`. React: custom hooks `useCards()` and `usePrompts()` wrapping fetch calls with loading/error state. |
| Card history and diff viewing | Version control for cards | Medium | Current: fetches git history, renders diff with `diff.js` library. React: same `diff.js` library, render diff output in a modal component. |
| SillyTavern push/pull sync | Sync cards with external SillyTavern instance | Medium | Current: REST calls to proxy which forwards to SillyTavern API. React: same API calls, wrapped in hooks. |

**Implementation approach:** Data-fetching hooks (`useCards`, `usePrompts`, `useCardHistory`) that encapsulate the REST API calls and manage loading/error states. The library drawer is a presentational component consuming these hooks. Plain `useEffect` + `useState` fetch hooks are sufficient for the current scale (3-4 endpoints, no complex caching needs).

**Confidence:** HIGH -- CRUD + list rendering is React's bread and butter.

### Image Generation Flow

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Generate image from character description | LLM creates prompt, sends to image API | Medium | Current: two-step flow (LLM generates image prompt, then image API generates image). React: same flow in a custom hook or action. |
| Image preview and prompt editing | Users see and can re-roll images | Low | Controlled state for image URL and prompt text. |
| Reference image upload with vision model description | Upload an image, get description via vision model | Medium | File input + `FileReader` + vision API call. Framework-agnostic logic. |
| Dual image API support (OpenAI-compatible + SD API) | Works with multiple image backends | Low | Proxy handles API detection -- frontend just sends to one endpoint. |

**Implementation approach:** `useImageGeneration` hook wrapping the two-step generation flow. Image state (URL, prompt, loading) managed in the hook. The proxy abstraction means the frontend doesn't need to know which image API is in use.

**Confidence:** HIGH.

### Lorebook Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Lorebook entry CRUD (add, edit, delete) | Manage world-building entries | Medium | Current: accordion UI in editor tab with per-entry forms. React: `<LorebookEditor>` component with dynamic form list. |
| Auto-generate lorebook during character creation | Checkbox to generate entries alongside character | Low | Existing API call, just wire the checkbox state to the generation flow. |
| Lorebook entries embedded in card export | Entries included in V2 PNG metadata | Low | Already part of character data structure, flows through PNG export. |

**Implementation approach:** `<LorebookEditor>` component with `useReducer` for the entries array. Each entry rendered as an expandable section with controlled inputs.

**Confidence:** HIGH.

## Differentiators

Features that the React migration enables or improves. Not in the current app or significantly better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Component-level error boundaries** | Errors in one panel don't crash the whole app. Currently, a JS error in image generation can break the entire UI. | Low | React `ErrorBoundary` components around each major section (editor, library, image preview). Huge reliability improvement for free. |
| **Proper loading states per component** | Each section has independent loading indicators instead of a single global spinner. | Low | Each hook manages its own `isLoading` state. The current app has a single `isGenerating` flag that blocks the whole UI. |
| **Hot module replacement during development** | Vite HMR means instant feedback when editing components. Currently, every change requires a full page reload and re-entering config. | Low | Vite provides this out of the box. Major DX improvement. |
| **TypeScript for character data structures** | Type-safe character card V2 spec. Current code has no types, leading to runtime errors from misspelled field names. | Medium | Define `CharacterCardV2` interface matching the spec. Catches errors at build time. |
| **Optimistic UI updates for library operations** | Save/delete feel instant, roll back on error. Current implementation waits for server response before updating UI. | Low | Pattern: update local state immediately, revert on API error. |
| **Proper abort handling across components** | Navigate away from generation tab cleanly aborts in-progress streams. Currently, orphaned streams continue in background. | Low | Cleanup in `useEffect` return function. React's lifecycle model handles this naturally. |
| **CSS custom property theming (cleanup)** | Current CSS duplicates ~50 selectors for dark mode. Migrate to CSS custom property swaps for cleaner, more maintainable theming. | Medium | Define `--color-bg`, `--color-text`, etc. on `:root` and `[data-theme="dark"]`. Replace all hardcoded color values. Not a new feature but a significant improvement in CSS maintainability. |
| **Accessible tab navigation** | Current tabs lack proper ARIA roles. React makes it easy to add `role="tablist"`, `aria-selected`, `aria-controls`. | Low | Use Radix Tabs or add ARIA attributes to custom tab component. |

## Anti-Features

Features to explicitly NOT build during the refactor.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **React Router / URL-based navigation** | The app is a single-view tool, not a multi-page app. Adding routing adds complexity with no user benefit. Tab state is ephemeral and shouldn't be in the URL. | Keep `useState` for tab switching. Add routing only if a future milestone needs deep-linking. |
| **Global state management library (Redux, Zustand, Jotai)** | The app has ~5 pieces of shared state (config, current character, theme, library data, generation status). Context + useReducer is sufficient. Adding a state library for this scale adds dependency weight and learning curve for no benefit. | Use React Context for shared state. Evaluate state libraries only if prop drilling becomes painful across 3+ levels. |
| **CSS-in-JS (styled-components, Emotion)** | The current CSS is well-structured in a single file with BEM-ish naming. CSS-in-JS adds bundle size, runtime overhead, and migration effort with no clear benefit for this app's scale. | Keep CSS files. Use CSS Modules if class name collisions become an issue. Vite supports CSS Modules out of the box. |
| **Server-side rendering (Next.js, Remix)** | This is a client-side tool. There's no SEO requirement, no public pages, no need for server rendering. SSR adds massive complexity. | Keep it as a Vite SPA with static asset output served by the existing Express server. |
| **Form library (React Hook Form, Formik)** | The config panel has ~15 inputs. The character editor has ~10 fields. These are small enough for controlled components. A form library adds abstraction for no benefit at this scale. | Controlled components with `useState` / `useReducer`. Re-evaluate if validation rules become complex. |
| **Rich text editor (Slate, TipTap, Draft.js)** | The only "rich" element is the @mention pills. Bringing in a full rich text editor for one feature is massive overkill. | Use `react-mentions` which handles @mention UI within a regular textarea. No contenteditable needed. |
| **Storybook** | Useful for design systems, overkill for a single-developer tool with ~15 components. | Build and test components in the running app. Add Storybook only if the component count exceeds 30+. |
| **React Query / SWR for data fetching** | Only 3-4 endpoints are called (cards list, prompts list, card detail, history). The caching and revalidation features of these libraries aren't needed at this scale. | Plain `useEffect` + `useState` fetch hooks. Introduce data fetching library only if cache invalidation becomes painful. |

## Feature Dependencies

```
Config System (context + persistence)
  |
  +---> API Layer (needs config for endpoints, keys, timeouts)
  |       |
  |       +---> Streaming Generation (needs API layer)
  |       |       |
  |       |       +---> Character Editor (displays generation results)
  |       |       |       |
  |       |       |       +---> Field Locking (editor feature)
  |       |       |       +---> Lorebook Editor (editor sub-feature)
  |       |       |
  |       |       +---> @Mention Expansion (runs before generation)
  |       |
  |       +---> Image Generation (needs API layer)
  |       |
  |       +---> Library CRUD (needs API layer for storage endpoints)
  |               |
  |               +---> @Mention Autocomplete (needs card list from library)
  |               +---> Card History/Diff (needs library)
  |               +---> SillyTavern Sync (needs library + API layer)
  |
  +---> Theme System (reads from config/localStorage)

PNG Export (needs character data + image blob, standalone utility)

Split Pane Layout (standalone, no dependencies)
Tab Navigation (standalone, no dependencies)
```

## MVP Recommendation

### Phase 1 - Foundation (must be first)
1. **Config system** (context, persistence, useConfig hook)
2. **Theme switching** (useTheme hook, CSS custom properties)
3. **Tab navigation** (simple state-based tabs)
4. **Split-pane layout** (react-resizable-panels)

### Phase 2 - Core Generation Loop
5. **API layer** (fetch wrapper, streaming hook)
6. **Streaming LLM display** (useStreamingGeneration hook + StreamOutput component)
7. **Character editor** (controlled form, field locking)
8. **@Mention autocomplete** (react-mentions on concept textarea)

### Phase 3 - Persistence and Export
9. **Library CRUD** (cards and prompts hooks)
10. **Library drawer** (UI component)
11. **PNG metadata export** (utility module with png-chunk-text)
12. **Image generation flow** (useImageGeneration hook)

### Phase 4 - Advanced Features
13. **Lorebook editor** (CRUD within character editor)
14. **Card history and diff** (diff.js integration)
15. **SillyTavern sync** (push/pull via API)
16. **Prompt override editor** (modal with per-prompt customization)

**Defer:** None of the table stakes features can be deferred -- feature parity is a hard requirement. The differentiators (error boundaries, TypeScript interfaces, CSS cleanup) should be woven into each phase as they're encountered, not treated as separate work items.

## Sources

- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) -- 2.7M+ weekly npm downloads, by React core team member Brian Vaughn
- [react-mentions](https://www.npmjs.com/package/react-mentions) -- 460K weekly npm downloads, mature @mention solution
- [png-chunk-text](https://github.com/hughsk/png-chunk-text) -- PNG tEXt chunk read/write, browser-compatible
- [meta-png](https://www.npmjs.com/package/meta-png) -- zero-dependency PNG metadata library
- [Streaming LLM Responses Guide](https://dev.to/pockit_tools/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534) -- comprehensive SSE + React pattern guide (2025)
- [react-rich-mentions](https://github.com/koala-interactive/react-rich-mentions) -- contenteditable alternative to react-mentions (if true pills needed)
- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) -- accessible headless tab primitive

# Feature Landscape

**Domain:** Vanilla JS to React/Vite migration of a character card generator
**Researched:** 2026-03-26

## Table Stakes

Features users expect. Missing = regression from the current app.

### Streaming LLM Responses (SSE to React State)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SSE stream parsing with real-time token display | Core UX -- users see character being written token-by-token | Medium | Current: `handleStreamResponse()` in `api.js` reads `ReadableStream`, calls `onStream(token, fullContent)` callback. React: custom hook `useStreamingResponse()` that manages `useState` for accumulated text + `useRef` for the reader. Pattern is well-established -- `fetch` + `ReadableStream` + `TextDecoder` piped into React state. No library needed; plain `fetch` with `getReader()` is the standard. Avoid `EventSource` API (doesn't support POST). |
| Abort/cancel mid-stream | Users can stop generation | Low | Current: `AbortController` + stored `currentReader`. React: pass `AbortController` signal via context or return abort fn from the hook. |
| Stream display in a scrolling container | Visual feedback during generation | Low | Current: `.stream-box` pre element with auto-scroll. React: `<StreamOutput>` component with `useEffect` scroll-to-bottom on content change. |
| Content refusal detection | Detects when LLM declines content | Low | Post-stream validation. Same logic, just runs after the hook resolves. |

**Implementation approach:** A single `useStreamingGeneration` custom hook encapsulating fetch, stream parsing, abort, and accumulated text state. The hook returns `{ content, isStreaming, error, abort }`. Components subscribe to this hook's state -- React re-renders handle the display automatically. This replaces the callback-driven pattern in the current `api.js`.

**Confidence:** HIGH -- this is a well-documented pattern used by ChatGPT, Vercel AI SDK, and every LLM frontend.

### Split-Pane Resizable Layout

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Horizontal split between input and output panes | Core layout -- users resize to preference | Low | Current: hand-rolled pointer events on a divider, stores ratio in `localStorage`. React: use **react-resizable-panels** (2.7M+ weekly npm downloads, by Brian Vaughn of React core team). API: `<PanelGroup>` / `<Panel>` / `<PanelResizeHandle>`. Supports persistence via `autoSaveId` prop (localStorage built-in). |
| Mobile collapse to stacked layout | Responsive design | Low | Current: CSS media query at 700px disables split. React: same approach -- CSS media query or conditionally render single-column layout based on a `useMediaQuery` hook. |
| Persisted split ratio | User preference remembered | Low | Built into `react-resizable-panels` via `autoSaveId`. |

**Implementation approach:** Replace hand-rolled split pane with `react-resizable-panels`. Direct feature parity with less code. The library handles accessibility (keyboard resizing) that the current implementation lacks.

**Confidence:** HIGH -- `react-resizable-panels` is the clear ecosystem winner.

### Tab-Based Navigation (No Router)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create / Editor / Library tabs | Core navigation between app sections | Low | Current: manual DOM class toggling on `.tab-btn` and `.tab-content` elements with `activeTab` state. React: simple `useState` with conditional rendering. No router needed -- these are in-page view switches, not URL-addressable routes. |
| Sub-tabs within Editor (Character/Image, Lorebook) | Nested navigation | Low | Same pattern, nested state. |
| Keyboard navigation (arrow keys between tabs) | Accessibility | Low | Use `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA pattern. Can use Radix `Tabs` primitive or build with 20 lines of code. |
| Programmatic tab switching | Generation flow auto-switches to editor | Low | Lift tab state to a shared context or parent component. Call `setActiveTab('editor')` from generation logic. |

**Implementation approach:** A lightweight `<Tabs>` component (or Radix UI `Tabs` primitive if adopting a headless UI library). No React Router -- this is local view state, not routing. The current app has no URL-based navigation and adding it is out of scope for a parity migration.

**Confidence:** HIGH -- trivial React pattern.

### @Mention Autocomplete with Pills

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `@` trigger opens suggestion dropdown | Users reference library cards in concept textarea | High | Current: Tribute.js on a contenteditable div that replaces the textarea. Inserts `<span class="mention-pill">` elements. React options: **react-mentions** (460K weekly downloads, mature, textarea-based with overlay rendering) or custom contenteditable. |
| Styled pill display for mentions | Visual distinction of referenced cards | Medium | `react-mentions` supports custom `displayTransform` and CSS styling for mention highlights. It renders mentions as styled spans within a textarea overlay -- visually similar to pills without contenteditable complexity. |
| Async card list lookup with caching | Fetches card names from storage API | Low | `react-mentions` accepts async `data` callback. Cache with `useMemo` or a simple TTL cache. |
| Mention expansion to card context | `@CardName` expanded to full card data before sending to LLM | Low | Pure function `expandMentions()` -- already framework-agnostic logic. Port directly. |

**Implementation approach:** Use **react-mentions** instead of Tribute.js. Key difference: `react-mentions` works with a regular textarea (using a transparent overlay for styling) rather than contenteditable. This avoids the entire class of contenteditable bugs (cursor positioning, paste handling, mobile keyboard issues). The current Tribute.js approach replaces textareas with contenteditable divs and bridges `.value` -- `react-mentions` eliminates this hack entirely. Trade-off: mentions won't be true DOM pills (non-editable spans), but will be visually styled regions in the textarea overlay. This is the same approach Facebook, Slack, and GitHub use. If true contenteditable pills are required, `react-rich-mentions` is the alternative, but the added complexity is not justified for this use case.

**Confidence:** HIGH -- `react-mentions` is the established React solution for this exact problem.

### PNG Metadata Manipulation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Write V2 character card JSON into PNG tEXt chunk | Export cards as SillyTavern-compatible PNGs | Medium | Current: hand-rolled `PNGEncoder` class that parses PNG binary format, creates tEXt chunks with `chara` keyword containing base64-encoded character JSON. React: the PNG logic is framework-agnostic (operates on `ArrayBuffer`/`Blob`). Can port directly as a utility module. For replacing hand-rolled code, use **png-chunk-text** + **png-chunks-extract** + **png-chunks-encode** (established, browser-compatible). Or use **meta-png** (zero-dependency, simpler API). |
| Read metadata from existing PNGs | Import cards | Low | Same libraries support reading. `png-chunks-extract` + `png-chunk-text` for decode. |
| Image blob to PNG conversion pipeline | Character image + metadata = downloadable card | Medium | Current: fetches image URL, converts to blob, injects metadata, triggers download. React: same pipeline in a utility function, triggered by a button click handler. No React-specific concerns. |

**Implementation approach:** Extract PNG encoding into a standalone utility module (`lib/png-metadata.ts`). Replace the hand-rolled chunk parser with **png-chunk-text** + **png-chunks-extract** + **png-chunks-encode** for reliability. These are small, focused libraries (~2KB each) that handle CRC calculation and chunk formatting correctly. The current hand-rolled encoder works but is a maintenance liability and has edge cases around malformed PNGs.

**Confidence:** HIGH -- PNG chunk manipulation is a solved problem with established libraries.

### Form State Management for Config Panels

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| API settings modal (text API, image API, SillyTavern) | Users configure multiple API endpoints, keys, models | Medium | Current: `Config` class reads/writes localStorage/sessionStorage, `saveToForm()`/`saveFromForm()` syncs DOM inputs. React: controlled components with a config context. Use a `useConfig` hook backed by `useReducer` + localStorage sync. |
| Session vs persistent key storage toggle | Security-conscious API key handling | Low | `sessionStorage` for keys by default, `localStorage` opt-in via toggle. Same browser APIs, just wire the toggle to the storage target. |
| Nested config structure (api.text.baseUrl, api.image.model, etc.) | Deep config object with dot-path access | Low | Current: `config.get('api.text.baseUrl')` with dot-path resolver. React: same pattern, or flatten into a reducer. Could use `immer` for ergonomic nested updates if desired, but `useReducer` is sufficient. |
| Content policy prefix toggle | Global toggle affecting all LLM requests | Low | Boolean in config context, consumed by API layer. |
| Prompt overrides (per-prompt customization) | Power users customize LLM prompts | Medium | Current: modal with textarea per prompt, stored in config. React: modal component with controlled textarea, saves to config context. |

**Implementation approach:** A `ConfigProvider` context with `useReducer` for the nested config object. A `useConfig()` hook for reading/writing. localStorage/sessionStorage sync in a `useEffect`. No form library needed -- the config panel is a small number of inputs, not a complex dynamic form. Controlled components with the config context are sufficient.

**Confidence:** HIGH -- standard React state management patterns.

### Dark/Light Theme Switching

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Toggle between dark and light themes | User preference | Low | Current: sets `data-theme="dark"` on `<html>`, CSS uses `[data-theme="dark"]` selectors with overrides. React: same approach works perfectly. Use a `useTheme` hook that reads/writes `localStorage` and sets the `data-theme` attribute. No CSS-in-JS needed. |
| Persisted theme preference | Remember across sessions | Low | `localStorage.getItem('theme')` -- identical to current. |
| Icon swap (moon/sun) | Visual indicator | Low | Conditional rendering based on theme state. |

**Implementation approach:** A `useTheme()` hook that manages the `data-theme` attribute on `document.documentElement` and persists to localStorage. The CSS custom properties approach used currently is the correct pattern -- it works with any CSS methodology and doesn't require React-specific theming libraries. Migrate the `[data-theme="dark"]` CSS overrides to use CSS custom properties more consistently (the current CSS duplicates many selectors that could use `--var` swaps instead).

**Confidence:** HIGH -- `data-theme` attribute + CSS custom properties is the standard approach.

### Character Editor with Field Locking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Editable form with all character fields | Users review and edit generated characters | Medium | Current: `displayCharacter()` populates DOM inputs from `currentCharacter` object. React: controlled form components bound to character state. |
| Field lock/unlock toggles | Lock fields during re-generation to preserve edits | Medium | Current: `lockedFields` Set, checked during generation to preserve values. React: `useState<Set<string>>` for locked fields, generation logic checks before overwriting. |
| Changed field highlighting after regeneration | Visual diff of what changed | Low | Current: compares previous field values, adds CSS class. React: compute diff in a `useMemo`, apply conditional className. |
| Reset to AI-generated version | Undo all manual edits | Low | Store original in state, reset handler copies it back. |

**Implementation approach:** A `CharacterEditor` component with `useReducer` for character state (many interdependent fields). Field lock state as a sibling `useState`. The editor is the natural home for character data -- lift it to context if other components need access (e.g., the export flow).

**Confidence:** HIGH -- standard controlled form pattern.

### Library Drawer and CRUD

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slide-out library drawer with card/prompt lists | Browse and manage saved cards | Medium | Current: drawer with backdrop, card list, click-to-load. React: `<LibraryDrawer>` component with open/close state, fetches card list from API. |
| Card and prompt CRUD (save, load, delete) | Persistence | Medium | Current: REST calls to `/api/cards` and `/api/prompts`. React: custom hooks `useCards()` and `usePrompts()` wrapping fetch calls with loading/error state. |
| Card history and diff viewing | Version control for cards | Medium | Current: fetches git history, renders diff with `diff.js` library. React: same `diff.js` library, render diff output in a modal component. |
| SillyTavern push/pull sync | Sync cards with external SillyTavern instance | Medium | Current: REST calls to proxy which forwards to SillyTavern API. React: same API calls, wrapped in hooks. |

**Implementation approach:** Data-fetching hooks (`useCards`, `usePrompts`, `useCardHistory`) that encapsulate the REST API calls and manage loading/error states. The library drawer is a presentational component consuming these hooks. Plain `useEffect` + `useState` fetch hooks are sufficient for the current scale (3-4 endpoints, no complex caching needs).

**Confidence:** HIGH -- CRUD + list rendering is React's bread and butter.

### Image Generation Flow

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Generate image from character description | LLM creates prompt, sends to image API | Medium | Current: two-step flow (LLM generates image prompt, then image API generates image). React: same flow in a custom hook or action. |
| Image preview and prompt editing | Users see and can re-roll images | Low | Controlled state for image URL and prompt text. |
| Reference image upload with vision model description | Upload an image, get description via vision model | Medium | File input + `FileReader` + vision API call. Framework-agnostic logic. |
| Dual image API support (OpenAI-compatible + SD API) | Works with multiple image backends | Low | Proxy handles API detection -- frontend just sends to one endpoint. |

**Implementation approach:** `useImageGeneration` hook wrapping the two-step generation flow. Image state (URL, prompt, loading) managed in the hook. The proxy abstraction means the frontend doesn't need to know which image API is in use.

**Confidence:** HIGH.

### Lorebook Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Lorebook entry CRUD (add, edit, delete) | Manage world-building entries | Medium | Current: accordion UI in editor tab with per-entry forms. React: `<LorebookEditor>` component with dynamic form list. |
| Auto-generate lorebook during character creation | Checkbox to generate entries alongside character | Low | Existing API call, just wire the checkbox state to the generation flow. |
| Lorebook entries embedded in card export | Entries included in V2 PNG metadata | Low | Already part of character data structure, flows through PNG export. |

**Implementation approach:** `<LorebookEditor>` component with `useReducer` for the entries array. Each entry rendered as an expandable section with controlled inputs.

**Confidence:** HIGH.

## Differentiators

Features that the React migration enables or improves. Not in the current app or significantly better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Component-level error boundaries** | Errors in one panel don't crash the whole app. Currently, a JS error in image generation can break the entire UI. | Low | React `ErrorBoundary` components around each major section (editor, library, image preview). Huge reliability improvement for free. |
| **Proper loading states per component** | Each section has independent loading indicators instead of a single global spinner. | Low | Each hook manages its own `isLoading` state. The current app has a single `isGenerating` flag that blocks the whole UI. |
| **Hot module replacement during development** | Vite HMR means instant feedback when editing components. Currently, every change requires a full page reload and re-entering config. | Low | Vite provides this out of the box. Major DX improvement. |
| **TypeScript for character data structures** | Type-safe character card V2 spec. Current code has no types, leading to runtime errors from misspelled field names. | Medium | Define `CharacterCardV2` interface matching the spec. Catches errors at build time. |
| **Optimistic UI updates for library operations** | Save/delete feel instant, roll back on error. Current implementation waits for server response before updating UI. | Low | Pattern: update local state immediately, revert on API error. |
| **Proper abort handling across components** | Navigate away from generation tab cleanly aborts in-progress streams. Currently, orphaned streams continue in background. | Low | Cleanup in `useEffect` return function. React's lifecycle model handles this naturally. |
| **CSS custom property theming (cleanup)** | Current CSS duplicates ~50 selectors for dark mode. Migrate to CSS custom property swaps for cleaner, more maintainable theming. | Medium | Define `--color-bg`, `--color-text`, etc. on `:root` and `[data-theme="dark"]`. Replace all hardcoded color values. Not a new feature but a significant improvement in CSS maintainability. |
| **Accessible tab navigation** | Current tabs lack proper ARIA roles. React makes it easy to add `role="tablist"`, `aria-selected`, `aria-controls`. | Low | Use Radix Tabs or add ARIA attributes to custom tab component. |

## Anti-Features

Features to explicitly NOT build during the refactor.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **React Router / URL-based navigation** | The app is a single-view tool, not a multi-page app. Adding routing adds complexity with no user benefit. Tab state is ephemeral and shouldn't be in the URL. | Keep `useState` for tab switching. Add routing only if a future milestone needs deep-linking. |
| **Global state management library (Redux, Zustand, Jotai)** | The app has ~5 pieces of shared state (config, current character, theme, library data, generation status). Context + useReducer is sufficient. Adding a state library for this scale adds dependency weight and learning curve for no benefit. | Use React Context for shared state. Evaluate state libraries only if prop drilling becomes painful across 3+ levels. |
| **CSS-in-JS (styled-components, Emotion)** | The current CSS is well-structured in a single file with BEM-ish naming. CSS-in-JS adds bundle size, runtime overhead, and migration effort with no clear benefit for this app's scale. | Keep CSS files. Use CSS Modules if class name collisions become an issue. Vite supports CSS Modules out of the box. |
| **Server-side rendering (Next.js, Remix)** | This is a client-side tool. There's no SEO requirement, no public pages, no need for server rendering. SSR adds massive complexity. | Keep it as a Vite SPA with static asset output served by the existing Express server. |
| **Form library (React Hook Form, Formik)** | The config panel has ~15 inputs. The character editor has ~10 fields. These are small enough for controlled components. A form library adds abstraction for no benefit at this scale. | Controlled components with `useState` / `useReducer`. Re-evaluate if validation rules become complex. |
| **Rich text editor (Slate, TipTap, Draft.js)** | The only "rich" element is the @mention pills. Bringing in a full rich text editor for one feature is massive overkill. | Use `react-mentions` which handles @mention UI within a regular textarea. No contenteditable needed. |
| **Storybook** | Useful for design systems, overkill for a single-developer tool with ~15 components. | Build and test components in the running app. Add Storybook only if the component count exceeds 30+. |
| **React Query / SWR for data fetching** | Only 3-4 endpoints are called (cards list, prompts list, card detail, history). The caching and revalidation features of these libraries aren't needed at this scale. | Plain `useEffect` + `useState` fetch hooks. Introduce data fetching library only if cache invalidation becomes painful. |

## Feature Dependencies

```
Config System (context + persistence)
  |
  +---> API Layer (needs config for endpoints, keys, timeouts)
  |       |
  |       +---> Streaming Generation (needs API layer)
  |       |       |
  |       |       +---> Character Editor (displays generation results)
  |       |       |       |
  |       |       |       +---> Field Locking (editor feature)
  |       |       |       +---> Lorebook Editor (editor sub-feature)
  |       |       |
  |       |       +---> @Mention Expansion (runs before generation)
  |       |
  |       +---> Image Generation (needs API layer)
  |       |
  |       +---> Library CRUD (needs API layer for storage endpoints)
  |               |
  |               +---> @Mention Autocomplete (needs card list from library)
  |               +---> Card History/Diff (needs library)
  |               +---> SillyTavern Sync (needs library + API layer)
  |
  +---> Theme System (reads from config/localStorage)

PNG Export (needs character data + image blob, standalone utility)

Split Pane Layout (standalone, no dependencies)
Tab Navigation (standalone, no dependencies)
```

## MVP Recommendation

### Phase 1 - Foundation (must be first)
1. **Config system** (context, persistence, useConfig hook)
2. **Theme switching** (useTheme hook, CSS custom properties)
3. **Tab navigation** (simple state-based tabs)
4. **Split-pane layout** (react-resizable-panels)

### Phase 2 - Core Generation Loop
5. **API layer** (fetch wrapper, streaming hook)
6. **Streaming LLM display** (useStreamingGeneration hook + StreamOutput component)
7. **Character editor** (controlled form, field locking)
8. **@Mention autocomplete** (react-mentions on concept textarea)

### Phase 3 - Persistence and Export
9. **Library CRUD** (cards and prompts hooks)
10. **Library drawer** (UI component)
11. **PNG metadata export** (utility module with png-chunk-text)
12. **Image generation flow** (useImageGeneration hook)

### Phase 4 - Advanced Features
13. **Lorebook editor** (CRUD within character editor)
14. **Card history and diff** (diff.js integration)
15. **SillyTavern sync** (push/pull via API)
16. **Prompt override editor** (modal with per-prompt customization)

**Defer:** None of the table stakes features can be deferred -- feature parity is a hard requirement. The differentiators (error boundaries, TypeScript interfaces, CSS cleanup) should be woven into each phase as they're encountered, not treated as separate work items.

## Sources

- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) -- 2.7M+ weekly npm downloads, by React core team member Brian Vaughn
- [react-mentions](https://www.npmjs.com/package/react-mentions) -- 460K weekly npm downloads, mature @mention solution
- [png-chunk-text](https://github.com/hughsk/png-chunk-text) -- PNG tEXt chunk read/write, browser-compatible
- [meta-png](https://www.npmjs.com/package/meta-png) -- zero-dependency PNG metadata library
- [Streaming LLM Responses Guide](https://dev.to/pockit_tools/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534) -- comprehensive SSE + React pattern guide (2025)
- [react-rich-mentions](https://github.com/koala-interactive/react-rich-mentions) -- contenteditable alternative to react-mentions (if true pills needed)
- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) -- accessible headless tab primitive
FEATURES_
