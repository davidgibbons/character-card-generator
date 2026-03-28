# Roadmap: Character Card Generator — Code Quality Refactor

## Overview

Migrate the character card generator frontend from vanilla JS with window globals to React + Vite in four phases. Start with the build system and service layer conversion, then stand up the React app shell with layout/config/theme, then implement the primary generation and editing workflow, and finally bring over all remaining features (export, library, sync, lorebook) to achieve full feature parity. The backend is untouched throughout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Build System + Service Layer** - Vite scaffold, Docker multi-stage build, service modules converted from window globals to ES imports, all CDN deps moved to npm
- [x] **Phase 2: React App Shell** - Layout, tabs, split pane, config/settings, theme switching, CSS Modules, state store foundation
- [ ] **Phase 3: Generation + Editing** - Character creation panel, SSE streaming, @mention autocomplete, editor panel with field locking, evaluate/revise flow
- [ ] **Phase 4: Export, Library + Full Parity** - Image generation, PNG export, library CRUD with history/diff, SillyTavern sync, lorebook editor, final feature parity verification

## Phase Details

### Phase 1: Build System + Service Layer
**Goal**: The project builds with Vite, runs in Docker, and all frontend modules use ES imports instead of window globals
**Depends on**: Nothing (first phase)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06, BUILD-07, LIB-03, LIB-04
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` starts Vite dev server and Express backend concurrently, and the app loads in the browser
  2. Running `npm run build` produces static assets in `dist/` that Express can serve
  3. Docker image builds successfully and serves the app on port 2426 with both API and static assets working
  4. All JavaScript dependencies come from npm imports -- no CDN script tags remain in the HTML
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md — Vite scaffold, React entry point, package.json scripts
- [x] 01-02-PLAN.md — Service layer conversion (config store, all modules to ES imports)
- [x] 01-03-PLAN.md — Docker multi-stage build, old file cleanup, end-to-end verification

### Phase 2: React App Shell
**Goal**: Users see a working React application with tab navigation, resizable split-pane layout, settings panel, and theme switching -- the visual frame for all features
**Depends on**: Phase 1
**Requirements**: REACT-01, REACT-02, REACT-03, REACT-04, REACT-10, STATE-01, STATE-05, CSS-01, CSS-02, CSS-03
**Success Criteria** (what must be TRUE):
  1. User can navigate between Create and Edit tabs and each renders its own panel content
  2. User can resize the split-pane layout and the ratio persists across page reloads
  3. User can toggle dark/light theme and the choice persists across sessions
  4. User can configure API settings (endpoint, model, keys) and values persist correctly in session/local storage
  5. Component styles are scoped via CSS Modules and the visual appearance matches the existing design
**Plans:** 3 plans
Plans:
- [x] 02-01-PLAN.md — Layout shell (Header, TabBar, ActionBar, SplitPane), useTheme hook, CSS Modules
- [x] 02-02-PLAN.md — Settings modal with save/cancel, API config forms, app toggle settings
- [x] 02-03-PLAN.md — CSS cleanup (remove duplicated globals) and visual verification checkpoint
**UI hint**: yes

### Phase 3: Generation + Editing
**Goal**: Users can generate characters via streaming LLM calls, see tokens appear in real-time, edit the resulting character fields, and run the evaluate/revise workflow
**Depends on**: Phase 2
**Requirements**: REACT-05, REACT-06, STATE-02, STATE-03, STREAM-01, STREAM-02, STREAM-03, LIB-01, LIB-02, PARITY-01, PARITY-02, PARITY-07
**Success Criteria** (what must be TRUE):
  1. User can enter a character concept (with @mention autocomplete for library cards), select POV mode, and start generation
  2. LLM response tokens stream into the UI in real-time without stale closure bugs or missing tokens
  3. User can cancel an in-progress generation and the stream stops cleanly
  4. User can edit generated character fields, lock individual fields, and see which fields changed after revision
  5. User can trigger evaluate and revise cycles, with content policy prefix toggle working
**Plans:** 1/4 plans executed
Plans:
- [x] 03-01-PLAN.md — Foundation: parseSections utility, useGenerationStore, prompt normalization, react-mentions install
- [ ] 03-02-PLAN.md — CreatePanel with MentionInput, generation handler wired to store
- [ ] 03-03-PLAN.md — StreamView, CharacterEditor, FieldRow, EvalFeedback components
- [ ] 03-04-PLAN.md — App.jsx + ActionBar wiring, full state machine, visual verification
**UI hint**: yes

### Phase 4: Export, Library + Full Parity
**Goal**: All remaining features work in the React app -- image generation, PNG export, library management, SillyTavern sync, lorebook, and card history -- achieving complete feature parity with the original
**Depends on**: Phase 3
**Requirements**: REACT-07, REACT-08, REACT-09, REACT-11, REACT-12, STATE-04, PARITY-03, PARITY-04, PARITY-05, PARITY-06, PARITY-08, PARITY-09
**Success Criteria** (what must be TRUE):
  1. User can generate an image for a character and see it displayed in the UI
  2. User can download a character as a V2-spec PNG with embedded metadata and as JSON
  3. User can browse the card/prompt library, perform CRUD operations, and view card history with diffs
  4. User can push/pull characters to/from SillyTavern
  5. User can create, edit, delete, and auto-generate lorebook entries for a character
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Build System + Service Layer | 3/3 | Complete | - |
| 2. React App Shell | 3/3 | Complete | 2026-03-27 |
| 3. Generation + Editing | 1/4 | In Progress|  |
| 4. Export, Library + Full Parity | 0/? | Not started | - |
