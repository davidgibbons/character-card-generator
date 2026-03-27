# Phase 2: React App Shell - Research

**Researched:** 2026-03-26
**Domain:** React component architecture, split-pane layout, CSS Modules migration, Zustand state management
**Confidence:** HIGH

## Summary

Phase 2 replaces the placeholder `App.jsx` with a fully functional application shell: header with controls, tab navigation (Create/Edit), a shared resizable split-pane layout, a settings modal with explicit save/cancel, theme switching, and CSS Modules for component-scoped styles. The existing Zustand `configStore` already handles settings persistence including sensitive API key storage -- the settings modal is a React form that reads/writes to this store.

The core challenge is CSS migration. The existing `globals.css` is ~2300 lines covering every component in the app. Phase 2 should extract only the shell-related styles (header, tabs, split-pane, modal, progress bar, theme toggle) into CSS Modules, leaving the rest in globals.css for later phases to migrate. The theme system (`[data-theme="dark"]` attribute + CSS custom properties) stays global and works unchanged.

**Primary recommendation:** Build the shell top-down: App layout first, then header/tab bar, then split-pane, then settings modal. Use `react-resizable-panels` for the split-pane with `autoSaveId` for localStorage persistence. Keep the configStore as-is -- it already does everything the settings modal needs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Header + Tab Bar + Content Area layout. Header contains app title, settings gear icon, debug toggle button, and theme toggle. Tab bar below header for Create/Edit navigation.
- **D-02:** Top action bar below tab bar with generate/revise buttons and a consistent progress bar. This bar stays visible regardless of scroll position so the user always sees generation progress.
- **D-03:** Shared split-pane layout -- one split-pane for both Create and Edit tabs. Left panel content switches based on active tab (Create form or Edit form). Right panel always shows character preview/output.
- **D-04:** Library stays as a slide-out drawer (current behavior), not a dedicated tab. Toggle button in header.
- **D-05:** Use `react-resizable-panels` library for the resizable split-pane. Persist ratio to localStorage.
- **D-06:** Settings opens as a modal/overlay, NOT a tab. Triggered by gear icon in header. This removes Settings from the tab bar, leaving only Create and Edit tabs.
- **D-07:** Explicit save button for settings (not auto-save on change). Cancel button discards unsaved changes.
- **D-08:** (Claude's Discretion) CSS migration approach.

### Claude's Discretion
- CSS migration approach -- keep global styles initially and extract incrementally, or convert upfront
- Component file naming conventions (PascalCase .jsx files in src/components/)
- Whether to use sub-directories per feature (components/settings/, components/layout/) or flat
- Progress bar implementation details
- Keyboard navigation between tabs
- Split-pane collapse behavior (snap to closed, or minimum width)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REACT-01 | Frontend decomposed into React components replacing monolithic main.js | Component hierarchy and file structure defined below |
| REACT-02 | Tab navigation (Create, Edit) implemented as React components with conditional rendering | Tab bar component with useState, ARIA roles, keyboard nav |
| REACT-03 | Split-pane resizable layout implemented as React component | react-resizable-panels with autoSaveId for persistence |
| REACT-04 | Settings panel implemented as React form components with two-way binding to config store | Settings modal reading/writing existing Zustand configStore with save/cancel pattern |
| REACT-10 | Dark/light theme switching preserved via CSS custom properties and React state | useTheme hook managing data-theme attribute + localStorage |
| STATE-01 | Zustand store replaces window.config singleton for app configuration | configStore already exists and works; settings modal binds to it |
| STATE-05 | API keys persist in sessionStorage (or localStorage with opt-in) | configStore already handles this with persistApiKeys toggle |
| CSS-01 | Component styles use CSS Modules (.module.css files) scoped per component | Vite native CSS Modules support; incremental extraction strategy |
| CSS-02 | Global CSS custom properties (theme variables, resets) preserved in global stylesheet | globals.css keeps :root vars and [data-theme="dark"] overrides |
| CSS-03 | Visual appearance matches existing design (no regressions) | Extract existing CSS rules into modules; do not rewrite styling |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.4 | UI framework | Already in package.json |
| react-dom | 19.2.4 | DOM rendering | Already in package.json |
| zustand | 5.0.12 | State management | Already in package.json with configStore built |

### New for Phase 2
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-resizable-panels | 4.7.6 | Split-pane layout | User decision D-05. By Brian Vaughn (React core team). 2.7M+ weekly downloads. Built-in localStorage persistence via autoSaveId. Handles keyboard resizing and accessibility. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-resizable-panels | Hand-rolled split pane | More code, no accessibility, no built-in persistence |
| CSS Modules | Tailwind CSS | Adds migration scope; existing CSS design system works |
| Zustand (existing) | Context + useReducer | Research initially recommended this, but requirements specify Zustand (STATE-01..04) and configStore is already built. No reason to change. |

**Installation:**
```bash
npm install react-resizable-panels
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  App.jsx                          # Root layout: Header + TabBar + ActionBar + SplitPane
  main.jsx                         # React entry point (exists)
  components/
    layout/
      Header.jsx                   # App title, gear icon, debug toggle, theme toggle, library button
      Header.module.css
      TabBar.jsx                   # Create / Edit tab buttons
      TabBar.module.css
      ActionBar.jsx                # Generate/revise buttons + progress bar (sticky)
      ActionBar.module.css
      SplitPane.jsx                # react-resizable-panels wrapper
      SplitPane.module.css
    settings/
      SettingsModal.jsx            # Modal overlay with settings form
      SettingsModal.module.css
      ApiSettings.jsx              # Text API, Image API, SillyTavern config sections
      ApiSettings.module.css
      AppSettings.jsx              # Debug mode, persist keys, content policy toggle
      AppSettings.module.css
    common/
      Modal.jsx                    # Reusable modal shell (overlay + close + header)
      Modal.module.css
      ProgressBar.jsx              # Reusable progress bar component
      ProgressBar.module.css
  hooks/
    useTheme.js                    # Theme state + data-theme attribute management
    useLocalStorage.js             # Generic localStorage read/write hook (if needed)
  stores/
    configStore.js                 # Already exists -- settings persistence
  services/                        # Already exists -- 7 service modules
  styles/
    globals.css                    # Already exists -- :root vars, theme, global styles
```

**File naming:** PascalCase for components (`Header.jsx`), camelCase for hooks (`useTheme.js`). Feature sub-directories (`layout/`, `settings/`, `common/`) keep related files together.

### Pattern 1: Tab Navigation with Conditional Rendering
**What:** Simple state-driven tab switching with no router.
**When to use:** Two tabs (Create/Edit) that switch left-panel content while sharing the same split-pane.
**Example:**
```jsx
// TabBar.jsx
import styles from './TabBar.module.css';

const TABS = [
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
];

export default function TabBar({ activeTab, onTabChange }) {
  return (
    <div className={styles.tabBar} role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

### Pattern 2: Split Pane with react-resizable-panels
**What:** Resizable horizontal split-pane with localStorage persistence.
**When to use:** The main content area shared by Create and Edit tabs.
**Example:**
```jsx
// SplitPane.jsx
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import styles from './SplitPane.module.css';

export default function SplitPane({ leftContent, rightContent }) {
  return (
    <PanelGroup direction="horizontal" autoSaveId="main-split">
      <Panel defaultSize={50} minSize={25}>
        <div className={styles.panel}>
          {leftContent}
        </div>
      </Panel>
      <PanelResizeHandle className={styles.resizeHandle} />
      <Panel defaultSize={50} minSize={25}>
        <div className={styles.panel}>
          {rightContent}
        </div>
      </Panel>
    </PanelGroup>
  );
}
```

### Pattern 3: Settings Modal with Save/Cancel (D-07)
**What:** Modal that copies store state to local form state on open, writes back only on save.
**When to use:** Settings modal per decision D-07.
**Example:**
```jsx
// SettingsModal.jsx
import { useState, useEffect } from 'react';
import useConfigStore from '../../stores/configStore';

export default function SettingsModal({ isOpen, onClose }) {
  const storeState = useConfigStore();
  const [draft, setDraft] = useState(null);

  // Copy store state to draft when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraft({
        api: JSON.parse(JSON.stringify(storeState.api)),
        app: { ...storeState.app },
        prompts: { ...storeState.prompts },
      });
    }
  }, [isOpen]);

  const handleSave = () => {
    // Write draft back to store
    storeState.set('api.text.baseUrl', draft.api.text.baseUrl);
    storeState.set('api.text.apiKey', draft.api.text.apiKey);
    // ... other fields
    storeState.saveConfig();
    onClose();
  };

  const handleCancel = () => {
    // Discard draft -- store unchanged
    onClose();
  };

  if (!isOpen || !draft) return null;
  // ... render form with draft state
}
```

### Pattern 4: Theme Hook
**What:** Manages dark/light theme via `data-theme` attribute on document element.
**When to use:** Theme toggle in header.
**Example:**
```jsx
// useTheme.js
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'theme';

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
```

### Pattern 5: CSS Module Usage
**What:** Component-scoped styles imported as objects.
**When to use:** Every component in Phase 2.
**Example:**
```jsx
// Header.module.css
.header {
  padding: 1.4rem 1.6rem;
  border-radius: var(--radius-lg);
  /* uses global CSS custom properties */
  background: linear-gradient(120deg, rgba(255,255,255,0.78), rgba(255,255,255,0.52));
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(8px);
}

// Header.jsx
import styles from './Header.module.css';

export default function Header({ onSettingsClick, onThemeToggle, isDark }) {
  return (
    <header className={styles.header}>
      {/* ... */}
    </header>
  );
}
```

### Anti-Patterns to Avoid
- **Lifting ALL state to App:** Only tab selection and modal open/close belong in App. Settings state lives in configStore. Character data will live in its own store (Phase 3).
- **Auto-saving settings on every keystroke:** Decision D-07 requires explicit save. Use local component state for the form draft.
- **Importing globals.css in components:** Only import it once in main.jsx. Components use their own .module.css files plus inherit global CSS custom properties.
- **Using className strings for CSS Modules:** Always use `styles.className` object access, not string concatenation with module class names.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable split pane | Custom pointer event + resize logic | react-resizable-panels | Accessibility (keyboard resize), localStorage persistence, collapse behavior, mobile support all built in |
| Modal overlay | Custom div + z-index + escape handling | Reusable Modal component (but okay to build -- it is ~40 lines) | Keep it simple; no library needed for a single modal, but do extract a reusable component |
| Theme switching | Custom context provider | Simple useTheme hook + data-theme attribute | The CSS already uses `[data-theme="dark"]` selectors -- just set the attribute |

**Key insight:** The CSS theme system and the Zustand configStore are already built. Phase 2 is mostly about creating React components that consume these existing systems, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: CSS Module Class Name Collisions with Global Styles
**What goes wrong:** A CSS Module class `.header` gets scoped to `_header_abc123`, but globals.css also defines `.header` -- both could apply if the element has both classes.
**Why it happens:** globals.css selectors like `.header` match any element with that class, regardless of CSS Modules scoping.
**How to avoid:** When extracting a style to a CSS Module, REMOVE (or comment out) the corresponding rule from globals.css. Don't leave duplicate definitions. Extract incrementally -- only move styles for components built in this phase.
**Warning signs:** Styles appearing doubled or overridden unexpectedly.

### Pitfall 2: Settings Modal Stale State
**What goes wrong:** Modal shows outdated values because it captured store state at mount time and never refreshed.
**Why it happens:** Reading store state once in useState initializer, not re-reading when modal opens.
**How to avoid:** Use a `useEffect` keyed on `isOpen` to copy fresh store state into draft state every time the modal opens.
**Warning signs:** Changing settings, closing modal, changing something else, reopening modal shows wrong values.

### Pitfall 3: Theme Flash on Load
**What goes wrong:** Page loads with light theme, then flashes to dark after React hydrates.
**Why it happens:** React's useEffect runs after paint. The `data-theme` attribute isn't set until the effect fires.
**How to avoid:** Add a tiny inline script in `index.html` (before React loads) that reads localStorage and sets `data-theme` immediately:
```html
<script>
  const t = localStorage.getItem('theme');
  if (t) document.documentElement.dataset.theme = t;
</script>
```
**Warning signs:** Brief white flash when loading the app in dark mode.

### Pitfall 4: react-resizable-panels CSS Not Applied
**What goes wrong:** Panels don't resize or have zero height/width.
**Why it happens:** PanelGroup needs its parent to have explicit dimensions. If the containing element has no height, panels collapse.
**How to avoid:** Ensure the content area wrapper has `height: calc(100vh - header - tabs - actionbar)` or uses flex layout with `flex: 1` and `min-height: 0`. The PanelGroup must have a sized container.
**Warning signs:** Panels visible but resize handle doesn't work, or panels have 0px height.

### Pitfall 5: Zustand Selector Re-renders
**What goes wrong:** Components re-render on every store change even when they only need one field.
**Why it happens:** Using `useConfigStore()` without a selector subscribes to the entire store.
**How to avoid:** Always use selectors: `useConfigStore((s) => s.api.text.baseUrl)` or `useConfigStore((s) => s.app.debugMode)`.
**Warning signs:** Settings modal form fields causing unrelated components to re-render.

## Code Examples

### App Layout Skeleton
```jsx
// App.jsx
import { useState, useCallback } from 'react';
import Header from './components/layout/Header';
import TabBar from './components/layout/TabBar';
import ActionBar from './components/layout/ActionBar';
import SplitPane from './components/layout/SplitPane';
import SettingsModal from './components/settings/SettingsModal';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();

  // Placeholder content for panels (Phase 3 fills these in)
  const leftPanel = activeTab === 'create'
    ? <div>Create form placeholder</div>
    : <div>Edit form placeholder</div>;

  const rightPanel = <div>Character preview placeholder</div>;

  return (
    <div className="container">
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onThemeToggle={toggleTheme}
        isDark={isDark}
      />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <ActionBar />
      <SplitPane leftContent={leftPanel} rightContent={rightPanel} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
```

### CSS Module Extraction Example
```css
/* components/layout/Header.module.css */
/* Extracted from globals.css .header rules */
.header {
  padding: 1.4rem 1.6rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: linear-gradient(120deg, rgba(255,255,255,0.78), rgba(255,255,255,0.52));
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Dark theme override using global attribute selector */
:global([data-theme="dark"]) .header {
  border-color: rgba(255, 255, 255, 0.07);
  background: linear-gradient(120deg, rgba(26,38,55,0.92), rgba(20,30,46,0.88));
}
```

**Key technique:** Use `:global([data-theme="dark"])` in CSS Modules to reference the global theme attribute while keeping the component class scoped. This is how CSS Modules interop with global theme selectors.

### react-resizable-panels with Collapse
```jsx
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

// With minimum size (prevents collapsing to zero)
<PanelGroup direction="horizontal" autoSaveId="main-split">
  <Panel defaultSize={50} minSize={20}>
    {/* left panel */}
  </Panel>
  <PanelResizeHandle className={styles.handle} />
  <Panel defaultSize={50} minSize={20}>
    {/* right panel */}
  </Panel>
</PanelGroup>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zustand v4 `create` | Zustand v5 `create` (same API) | 2024 | v5 dropped default exports, uses named exports. Already correct in configStore.js |
| CSS-in-JS (styled-components) | CSS Modules or zero-runtime CSS | 2024-2025 | CSS Modules are the recommendation for new React projects without a design system framework |
| react-split-pane | react-resizable-panels | 2023 | react-split-pane is unmaintained. react-resizable-panels is the successor by React core team member |

## CSS Migration Strategy (Claude's Discretion Decision)

**Recommendation: Incremental extraction per phase.**

Phase 2 extracts ONLY shell component styles:
- `.header` + dark overrides -> `Header.module.css`
- `.tab-bar`, `.tab-btn`, `.tab-badge` + dark overrides -> `TabBar.module.css`
- `.split-pane`, `.split-divider` -> replaced by react-resizable-panels (remove from globals)
- `.modal-overlay`, `.modal-header`, `.modal-close`, `.modal-body`, `.modal-title` + dark overrides -> `Modal.module.css`
- `.generation-progress-bar` -> `ProgressBar.module.css`
- `.api-settings-modal` + dark overrides -> `SettingsModal.module.css`

Everything else stays in `globals.css` for Phases 3-4 to migrate when those components are built.

**Rationale:** Extracting all 2300 lines at once is error-prone and untestable. Extracting per-component as each component is built ensures visual parity can be verified immediately.

## Component File Naming (Claude's Discretion Decision)

**Recommendation: Feature sub-directories with PascalCase.**

- `src/components/layout/` -- Header, TabBar, ActionBar, SplitPane
- `src/components/settings/` -- SettingsModal, ApiSettings, AppSettings
- `src/components/common/` -- Modal, ProgressBar

PascalCase `.jsx` files match React community convention. Co-located `.module.css` files use the same base name.

## Split-Pane Collapse Behavior (Claude's Discretion Decision)

**Recommendation: Minimum width of 20%, no snap-to-close.**

Use `minSize={20}` on both panels. This prevents accidental collapse while still allowing generous resizing. Collapsible panels add UX complexity (how to re-expand?) that isn't needed for this two-panel layout. If the user wants more space, they can resize to the minimum.

## Progress Bar (Claude's Discretion Decision)

**Recommendation: Simple CSS width-transition bar.**

A `<ProgressBar value={0-100} />` component that renders a div with `width: ${value}%` and a CSS transition. The action bar always shows it; when not generating, it stays at 0% (invisible or faded). No library needed -- this is a styled div.

## Open Questions

1. **Action bar button behavior in Phase 2**
   - What we know: D-02 says generate/revise/evaluate buttons go in the action bar
   - What's unclear: These buttons need generation logic (Phase 3). In Phase 2, should they be present but disabled, or omitted entirely?
   - Recommendation: Include the buttons as disabled placeholders with no click handlers. This verifies the layout without requiring Phase 3 logic.

2. **Library drawer in Phase 2**
   - What we know: D-04 says library is a slide-out drawer with a toggle button in the header
   - What's unclear: The drawer content (card listing, search, CRUD) is Phase 4 scope
   - Recommendation: Include the header toggle button and an empty drawer shell (slide-in/slide-out animation + backdrop). Content placeholder only.

## Sources

### Primary (HIGH confidence)
- `src/stores/configStore.js` -- Existing Zustand store with persist middleware, session/localStorage key handling
- `src/styles/globals.css` -- Existing theme variables, component styles, dark mode overrides
- `package.json` -- Installed versions: react 19.2.4, zustand 5.0.12
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) -- API documentation, autoSaveId persistence
- [react-resizable-panels npm](https://www.npmjs.com/package/react-resizable-panels) -- v4.7.6 latest

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` -- Prior stack research (Zustand, CSS Modules, no-router decision)
- `.planning/research/FEATURES.md` -- Prior feature research (split pane, theme, tabs patterns)
- `.planning/research/ARCHITECTURE.md` -- Component hierarchy and service layer patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed except react-resizable-panels (verified v4.7.6 on npm)
- Architecture: HIGH -- component hierarchy follows established React patterns and matches user decisions
- Pitfalls: HIGH -- CSS Module + theme interop and split-pane sizing are well-documented issues
- CSS migration: HIGH -- incremental extraction is a proven strategy; exact selectors identified from globals.css

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no fast-moving dependencies)
