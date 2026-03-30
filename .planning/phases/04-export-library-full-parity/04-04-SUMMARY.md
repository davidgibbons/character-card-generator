---
phase: 04-export-library-full-parity
plan: 04
subsystem: ui
tags: [react, zustand, library-drawer, css-modules, git-history, diff-view]

# Dependency graph
requires:
  - phase: 04-01
    provides: useLibraryStore with fetchCards, setIsOpen, toggleOpen, setSearchQuery; useGenerationStore with isDirty, setCharacter, setDirty, setImage
  - phase: 04-02
    provides: CharacterEditor, ImageSlot components
  - phase: 04-03
    provides: ActionBar Save Card integration

provides:
  - LibraryDrawer: slide-in drawer with search, card list, empty state, backdrop
  - CardListItem: card row with name/date/tags/quality badge + history and delete action buttons
  - DiffView: field-by-field before/after diff display
  - CardHistoryModal: git commit list with A/B commit selection and diff trigger
  - App.jsx wired to useLibraryStore.toggleOpen() via Header onLibraryToggle

affects:
  - 04-05 (export/download)
  - 04-06 (SillyTavern sync)
  - 04-07 (full parity verification)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LibraryDrawer uses globals.css shell classes (.library-drawer, .library-drawer-backdrop) for drawer animation"
    - "CardHistoryModal fetches /api/cards/:slug/history and /api/cards/:slug/diff/:a/:b directly via fetch (no storageClient wrapper)"
    - "isDirty check before card load via useGenerationStore.getState() in LibraryDrawer handler"

key-files:
  created:
    - src/components/library/LibraryDrawer.jsx
    - src/components/library/LibraryDrawer.module.css
    - src/components/library/CardListItem.jsx
    - src/components/library/CardListItem.module.css
    - src/components/library/CardHistoryModal.jsx
    - src/components/library/CardHistoryModal.module.css
    - src/components/library/DiffView.jsx
    - src/components/library/DiffView.module.css
  modified:
    - src/App.jsx
    - src/services/storage.js

key-decisions:
  - "storage.js listCards() now exposes slug field alongside id — components reference card.slug, not card.id"
  - "LibraryDrawer uses globals.css drawer shell classes (not CSS Modules) for slide animation — consistent with existing design system"
  - "CardHistoryModal fetches history/diff directly via fetch() — no storageClient wrapper since these endpoints are history-specific"

patterns-established:
  - "Pattern: drawer slide animation uses CSS class toggle on .library-drawer + .open (globals.css)"
  - "Pattern: history commit selection is A then B sequential — first click sets A, second sets B, third resets A"

requirements-completed: [REACT-07, REACT-12, STATE-04, PARITY-05]

# Metrics
duration: 15min
completed: 2026-03-30
---

# Phase 04 Plan 04: Library Drawer Summary

**Full library drawer with search, CRUD, and git history/diff — LibraryDrawer mounted in App.jsx and wired to useLibraryStore**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-30T19:14:17Z
- **Completed:** 2026-03-30T19:29:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built full library drawer: search input filtering cards by name and tags, card list with empty state, skeleton loading, backdrop
- Built CardListItem with name, date, tags (up to 3 + overflow count), quality badge, history and delete action buttons
- Built CardHistoryModal with git commit list, A/B commit selection, Show Diff trigger, and DiffView integration
- Built DiffView with field-by-field before/after comparison using FIELD_LABELS mapping
- Wired LibraryDrawer into App.jsx, replaced local libraryOpen useState with useLibraryStore.toggleOpen()
- Build passes (112 modules, 0 errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LibraryDrawer, CardListItem, and DiffView components** - `ec7aee2` (feat)
2. **Task 2: Create CardHistoryModal and wire LibraryDrawer into App.jsx** - `e4029c8` (feat)

## Files Created/Modified
- `src/components/library/LibraryDrawer.jsx` - Full library drawer: search, list, empty state, backdrop, dirty check, delete and discard confirmation modals
- `src/components/library/LibraryDrawer.module.css` - Drawer body styles: search input, card list, skeleton, empty state, dialog actions
- `src/components/library/CardListItem.jsx` - Card row with name/date/tags (up to 3 + N)/quality badge/action buttons
- `src/components/library/CardListItem.module.css` - Card row styles with hover, dark theme overrides
- `src/components/library/CardHistoryModal.jsx` - Commit history list with A/B selection, diff fetch, DiffView render
- `src/components/library/CardHistoryModal.module.css` - History modal styles: commit rows, A/B selection highlights, diff actions
- `src/components/library/DiffView.jsx` - Field-by-field before/after diff display with FIELD_LABELS mapping
- `src/components/library/DiffView.module.css` - Diff view styles with red/green tints for before/after
- `src/App.jsx` - Removed local libraryOpen state, imported LibraryDrawer and useLibraryStore, wired toggleOpen, mounted LibraryDrawer
- `src/services/storage.js` - listCards() now exposes slug field alongside id for component compatibility

## Decisions Made
- storage.js `listCards()` maps backend `{ slug, name }` to `{ id: c.slug, slug: c.slug, characterName: c.name }` — both `id` and `slug` exposed; existing callers using `id` are unaffected while new library components can use `card.slug`
- LibraryDrawer uses globals.css shell classes `.library-drawer` + `.library-drawer-backdrop` for slide animation (CSS class toggle on `open`) — consistent with the existing design system's drawer CSS defined in globals.css
- CardHistoryModal fetches `/api/cards/:slug/history` and `/api/cards/:slug/diff/:a/:b` directly via fetch() rather than through a storageClient wrapper — these are history-specific endpoints with no existing wrapper in storage.js

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed listCards() missing slug field in returned objects**
- **Found during:** Task 1 (LibraryDrawer, CardListItem, DiffView creation)
- **Issue:** Plan code uses `card.slug` throughout (LibraryDrawer and CardListItem), but `storage.js` `listCards()` returned `{ id: c.slug, ... }` with no `slug` field — components would get `undefined` for all card slugs used in API calls
- **Fix:** Added `slug: c.slug` and `tags: Array.isArray(c.tags) ? c.tags : []` to listCards() return shape
- **Files modified:** `src/services/storage.js`
- **Verification:** Build passes, card.slug references in LibraryDrawer resolve correctly
- **Committed in:** `ec7aee2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in service layer)
**Impact on plan:** Essential correctness fix — all card load/delete/history operations require slug. No scope creep.

## Issues Encountered
None beyond the auto-fixed slug mapping issue.

## Known Stubs
None — LibraryDrawer is fully wired to useLibraryStore which fetches from the real API.

## Next Phase Readiness
- Library drawer is fully functional: browse, search, load (with dirty check), delete, history/diff
- Ready for Phase 04-05 (export/download) and 04-06 (SillyTavern sync)

---
*Phase: 04-export-library-full-parity*
*Completed: 2026-03-30*
