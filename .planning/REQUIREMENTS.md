# Requirements: Character Card Generator — Code Quality Refactor

**Defined:** 2026-03-26
**Core Value:** Modernize the frontend architecture to React + Vite so the codebase is maintainable, extensible, and uses established libraries instead of hand-rolled solutions.

## v1 Requirements

### Build System

- [x] **BUILD-01**: Project builds with Vite and serves a React application entry point
- [x] **BUILD-02**: Vite dev server proxies `/api` requests to Express backend on port 2426
- [x] **BUILD-03**: `npm run dev` starts both Vite dev server and Express proxy concurrently
- [x] **BUILD-04**: `npm run build` produces production-ready static assets in `dist/`
- [x] **BUILD-05**: Dockerfile updated with multi-stage build (npm run build → Express serves dist/)
- [x] **BUILD-06**: Docker image uses Node 22-alpine for Vite 8 compatibility
- [x] **BUILD-07**: Single-container deployment preserved — Express serves both API and built static files

### React Migration

- [ ] **REACT-01**: Frontend decomposed into React components replacing monolithic main.js
- [ ] **REACT-02**: Tab navigation (Create, Edit, Settings) implemented as React components with conditional rendering
- [ ] **REACT-03**: Split-pane resizable layout implemented as React component
- [ ] **REACT-04**: Settings panel implemented as React form components with two-way binding to config store
- [x] **REACT-05**: Character create panel with concept input, POV selection, and generation controls
- [ ] **REACT-06**: Character editor panel with editable fields, field locking, and evaluate/revise flow
- [ ] **REACT-07**: Library drawer with card/prompt listing, search, and CRUD operations
- [ ] **REACT-08**: Lorebook editor with entry CRUD, generation, and toggle controls
- [ ] **REACT-09**: SillyTavern sync UI (push/pull/character list) implemented as React components
- [ ] **REACT-10**: Dark/light theme switching preserved via CSS custom properties and React state
- [ ] **REACT-11**: Card download (JSON + PNG with embedded metadata) working from React UI
- [ ] **REACT-12**: Card diff/history view working from React UI

### State Management

- [ ] **STATE-01**: Zustand store replaces window.config singleton for app configuration
- [x] **STATE-02**: Zustand store manages current character data, parsed fields, and edit state
- [x] **STATE-03**: Zustand store manages generation status, streaming state, and progress
- [ ] **STATE-04**: Zustand store manages library browsing state (cards, prompts, selection)
- [ ] **STATE-05**: API keys persist in sessionStorage (or localStorage with opt-in) as before

### Streaming

- [ ] **STREAM-01**: LLM responses stream in real-time to the UI during character generation
- [ ] **STREAM-02**: User can stop/cancel an in-progress generation
- [x] **STREAM-03**: Streaming state updates don't cause stale closure bugs or excessive re-renders

### CSS

- [ ] **CSS-01**: Component styles use CSS Modules (`.module.css` files) scoped per component
- [ ] **CSS-02**: Global CSS custom properties (theme variables, resets) preserved in global stylesheet
- [ ] **CSS-03**: Visual appearance matches existing design (no regressions in layout, colors, spacing)

### Library Replacements

- [x] **LIB-01**: LLM response parsing uses standardized `## Section` format with clean parseSections() utility
- [x] **LIB-02**: @mention autocomplete uses react-mentions (or equivalent React library) instead of Tribute.js CDN
- [x] **LIB-03**: diff and tributejs loaded from npm imports instead of jsDelivr CDN
- [x] **LIB-04**: No CDN script dependencies remain — all JS dependencies managed via npm

### Feature Parity

- [x] **PARITY-01**: All existing character generation modes (1st person, 3rd person, scenario) work
- [ ] **PARITY-02**: Character evaluation and revision workflow works
- [ ] **PARITY-03**: Image generation (OpenAI-compatible + SD API) works
- [ ] **PARITY-04**: V2 character card PNG export with embedded metadata works
- [ ] **PARITY-05**: Git-backed card/prompt library with CRUD, history, and diff works
- [ ] **PARITY-06**: SillyTavern push/pull sync works
- [x] **PARITY-07**: Content policy prefix toggle works
- [ ] **PARITY-08**: Configurable API settings with session/persistent key storage works
- [ ] **PARITY-09**: Lorebook generation and CRUD works

## v2 Requirements

### Library Replacements (Deferred)

- **LIB-05**: PNG metadata encoder replaced with png-chunks-extract/encode/text library

### Security

- **SEC-01**: Image proxy validates URL against allowlist to prevent SSRF
- **SEC-02**: CSP header tightened to remove unsafe-inline

### Testing

- **TEST-01**: Unit tests for character parsing logic
- **TEST-02**: Unit tests for Zustand stores
- **TEST-03**: Integration tests for Express proxy routes
- **TEST-04**: E2E tests for critical user flows

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend refactoring | Express proxy is stable; minimize blast radius |
| New features | This is a refactor milestone, not a feature milestone |
| TypeScript migration | Could be added later; not required for React migration |
| React Router | App is a tabbed SPA, not a multi-page routed app |
| Tailwind CSS | Existing CSS design system works; CSS Modules preserve it |
| Test suite | Deferred to future milestone |
| Security hardening | Deferred to future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 1 | Complete |
| BUILD-02 | Phase 1 | Complete |
| BUILD-03 | Phase 1 | Complete |
| BUILD-04 | Phase 1 | Complete |
| BUILD-05 | Phase 1 | Complete |
| BUILD-06 | Phase 1 | Complete |
| BUILD-07 | Phase 1 | Complete |
| LIB-03 | Phase 1 | Complete |
| LIB-04 | Phase 1 | Complete |
| REACT-01 | Phase 2 | Pending |
| REACT-02 | Phase 2 | Pending |
| REACT-03 | Phase 2 | Pending |
| REACT-04 | Phase 2 | Pending |
| REACT-10 | Phase 2 | Pending |
| STATE-01 | Phase 2 | Pending |
| STATE-05 | Phase 2 | Pending |
| CSS-01 | Phase 2 | Pending |
| CSS-02 | Phase 2 | Pending |
| CSS-03 | Phase 2 | Pending |
| REACT-05 | Phase 3 | Complete |
| REACT-06 | Phase 3 | Pending |
| STATE-02 | Phase 3 | Complete |
| STATE-03 | Phase 3 | Complete |
| STREAM-01 | Phase 3 | Pending |
| STREAM-02 | Phase 3 | Pending |
| STREAM-03 | Phase 3 | Complete |
| LIB-01 | Phase 3 | Complete |
| LIB-02 | Phase 3 | Complete |
| PARITY-01 | Phase 3 | Complete |
| PARITY-02 | Phase 3 | Pending |
| PARITY-07 | Phase 3 | Complete |
| REACT-07 | Phase 4 | Pending |
| REACT-08 | Phase 4 | Pending |
| REACT-09 | Phase 4 | Pending |
| REACT-11 | Phase 4 | Pending |
| REACT-12 | Phase 4 | Pending |
| STATE-04 | Phase 4 | Pending |
| PARITY-03 | Phase 4 | Pending |
| PARITY-04 | Phase 4 | Pending |
| PARITY-05 | Phase 4 | Pending |
| PARITY-06 | Phase 4 | Pending |
| PARITY-08 | Phase 4 | Pending |
| PARITY-09 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
