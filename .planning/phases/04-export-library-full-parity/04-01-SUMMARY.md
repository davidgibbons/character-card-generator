---
phase: 04-export-library-full-parity
plan: 01
subsystem: ui
tags: [zustand, react, state-management, lorebook, library]

# Dependency graph
requires:
  - phase: 03-generation-editing
    provides: useGenerationStore baseline with streaming, character, locks, eval/revise state
provides:
  - useGenerationStore extended with imageBlob, imageDisplayUrl, isImageGenerating, isDirty fields and setImage, clearImage, setImageGenerating, setDirty actions
  - useLorebookStore with entries, lockedEntries, CRUD actions, and index-shift-on-delete
  - useLibraryStore with cards, isLoading, searchQuery, isOpen, fetchCards
affects: [04-02-lorebook, 04-03-export, 04-04-library, 04-05-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isDirty flag set in setCharacter and updateField, cleared in reset() and setDirty(false)"
    - "lockedEntries uses same plain-object {index: boolean} pattern as lockedFields"
    - "index-shift rebuild on deleteEntry preserves correct locks after removal"
    - "fetchCards error handling: logs error and clears isLoading without throwing"

key-files:
  created:
    - src/stores/useLorebookStore.js
    - src/stores/useLibraryStore.js
  modified:
    - src/stores/useGenerationStore.js

key-decisions:
  - "imageDisplayUrl blob: URL revocation is caller's responsibility via useEffect cleanup — store does not revoke on setImage"
  - "reset() clears image state and isDirty; lockedFields intentionally NOT reset"
  - "useLibraryStore imports storageClient from ../services/storage (named export)"

patterns-established:
  - "Pattern: image state pair (imageBlob + imageDisplayUrl) always set/cleared together via setImage/clearImage"
  - "Pattern: isDirty lifecycle — true on setCharacter/updateField, false on reset() and explicit setDirty(false)"

requirements-completed: [STATE-04, PARITY-03]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 4 Plan 01: Store Foundation Summary

**Zustand stores extended and created: image+dirty state in useGenerationStore, new useLorebookStore with index-shift locking, new useLibraryStore with fetchCards**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T19:29:04Z
- **Completed:** 2026-03-30T19:30:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended useGenerationStore with image blob lifecycle (imageBlob, imageDisplayUrl, isImageGenerating) and isDirty dirty tracking
- Created useLorebookStore with full CRUD (addEntry, updateEntry, deleteEntry), lockedEntries with index-shift-on-delete, and setEntries/reset
- Created useLibraryStore with cards list, drawer open state, search query, and async fetchCards backed by storageClient

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useGenerationStore with image state and dirty tracking** - `7e6d32e` (feat)
2. **Task 2: Create useLorebookStore and useLibraryStore** - `468c43d` (feat)

## Files Created/Modified
- `src/stores/useGenerationStore.js` — Added imageBlob, imageDisplayUrl, isImageGenerating, isDirty fields; setImage, clearImage, setImageGenerating, setDirty actions; updated reset(), setCharacter(), updateField()
- `src/stores/useLorebookStore.js` — New store: entries with CRUD, lockedEntries with index-shift rebuild on delete, isGenerating
- `src/stores/useLibraryStore.js` — New store: cards, isLoading, searchQuery, isOpen with fetchCards async action

## Decisions Made
- imageDisplayUrl blob: URL revocation is the caller's responsibility — the store does not revoke on setImage, preventing accidental URL revocation if multiple consumers reference the same URL
- reset() clears image state and isDirty; lockedFields intentionally NOT reset so user keeps locks between generation runs
- useLibraryStore imports storageClient as named export from ../services/storage — matches how storage.js exports it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree branch `worktree-agent-a5f19e06` was behind main (at old vanilla JS codebase, commit 3433cc0). Reset to main (0edd1ca) before execution so src/stores/ was available. Not a code deviation — the worktree setup issue was resolved by reset --hard main.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three stores ready for consumption by Wave 2 plans (04-02, 04-03, 04-04)
- useGenerationStore: isDirty lets ActionBar drive save-button enabled state; image fields let ImagePanel manage avatar
- useLorebookStore: ready for LorebookSection component in 04-02
- useLibraryStore: ready for LibraryDrawer component in 04-04

---
*Phase: 04-export-library-full-parity*
*Completed: 2026-03-30*
