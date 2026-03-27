# Phase 2: React App Shell - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the React application shell — the visual frame for all features. This includes the top-level layout (header, tab bar, action bar, content area), resizable split-pane, settings modal, theme switching, and CSS Modules migration. Phase 2 delivers the skeleton that Phases 3 and 4 fill with functionality.

</domain>

<decisions>
## Implementation Decisions

### Layout Structure
- **D-01:** Header + Tab Bar + Content Area layout. Header contains app title, settings gear icon, debug toggle button, and theme toggle. Tab bar below header for Create/Edit navigation.
- **D-02:** Top action bar below tab bar with generate/revise buttons and a consistent progress bar. This bar stays visible regardless of scroll position so the user always sees generation progress.
- **D-03:** Shared split-pane layout — one split-pane for both Create and Edit tabs. Left panel content switches based on active tab (Create form or Edit form). Right panel always shows character preview/output.

### Library Drawer
- **D-04:** Library stays as a slide-out drawer (current behavior), not a dedicated tab. Toggle button in header.

### Split Pane
- **D-05:** Use `react-resizable-panels` library for the resizable split-pane. Persist ratio to localStorage.

### Settings Panel
- **D-06:** Settings opens as a modal/overlay, NOT a tab. Triggered by gear icon in header. This removes Settings from the tab bar, leaving only Create and Edit tabs.
- **D-07:** Explicit save button for settings (not auto-save on change). Cancel button discards unsaved changes.

### CSS Migration
- **D-08:** (Claude's Discretion) The existing main.css needs to be migrated. Approach is up to implementation — likely keep global CSS custom properties in globals.css and extract component-specific styles into CSS Modules incrementally.

### Claude's Discretion
- CSS migration approach — keep global styles initially and extract incrementally, or convert upfront
- Component file naming conventions (PascalCase .jsx files in src/components/)
- Whether to use sub-directories per feature (components/settings/, components/layout/) or flat
- Progress bar implementation details
- Keyboard navigation between tabs
- Split-pane collapse behavior (snap to closed, or minimum width)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Artifacts (foundation)
- `.planning/phases/01-build-system-service-layer/01-CONTEXT.md` — Phase 1 decisions (module conversion strategy, cleanup approach)
- `src/stores/configStore.js` — Existing Zustand config store to use for settings
- `src/App.jsx` — Current React entry point (placeholder to replace)
- `src/main.jsx` — React 19 entry point with root render
- `vite.config.js` — Vite config with proxy setup
- `src/styles/globals.css` — Current global CSS (migrated from original main.css)

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — Original architecture and module system
- `.planning/codebase/STRUCTURE.md` — Original file structure for reference

### Research
- `.planning/research/STACK.md` — React + Zustand + CSS Modules recommendations
- `.planning/research/FEATURES.md` — Feature implementation patterns in React
- `.planning/research/ARCHITECTURE.md` — Component architecture recommendations

### Project
- `.planning/PROJECT.md` — Project constraints (feature parity, single-container)
- `.planning/REQUIREMENTS.md` — REACT-01..04, REACT-10, STATE-01, STATE-05, CSS-01..03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/configStore.js` — Zustand store with persist middleware, already has get/set/loadFromForm/saveConfig. Settings modal can read/write directly.
- `src/styles/globals.css` — Contains CSS custom properties for theming (:root vars, [data-theme="dark"] overrides). This stays as-is for theme switching.
- `src/services/` — All 7 service modules ready for components to import.

### Established Patterns
- Zustand stores with `persist` middleware for localStorage persistence
- ES module imports throughout (no window globals)
- Vite handles CSS Modules natively (`.module.css` files)

### Integration Points
- `src/App.jsx` — Replace placeholder with full layout component
- `src/main.jsx` — May need to wrap with providers if any React Context is used
- Settings modal reads from / writes to `configStore` (Zustand)
- Theme toggle updates `document.documentElement.dataset.theme` and persists to localStorage

</code_context>

<specifics>
## Specific Ideas

- Progress bar should be consistent and always visible at the top of the content area — user specifically wants to see generation progress regardless of which tab/panel is active
- Action buttons (generate, revise, evaluate) should be in a top bar, not buried in the content panels
- Settings gear and debug toggle in the header (not as a tab)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-react-app-shell*
*Context gathered: 2026-03-26*
