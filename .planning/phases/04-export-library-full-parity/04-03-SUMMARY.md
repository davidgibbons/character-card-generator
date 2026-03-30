---
phase: 04-export-library-full-parity
plan: 03
subsystem: ui
tags: [react, actionbar, export, png, json, storage, pngEncoder]

# Dependency graph
requires:
  - phase: 04-01
    provides: useGenerationStore with imageBlob, isDirty, setDirty fields
provides:
  - Save Card button in ActionBar wired to storageClient.saveCard() with setDirty(false)
  - Download JSON button triggering browser file download of character JSON
  - Download PNG button using pngEncoder.createCharacterCard with blank PNG fallback
  - Export buttons disabled/hidden during streaming; disabled when no character
  - saveStatus state machine with transient 'Saved' feedback (1.5s)
affects: [04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - saveStatus state machine (idle/saving/saved/error) for transient button feedback
    - Export buttons hidden via uiPhase !== 'generating' guard
    - getState() snapshot pattern for async handlers to avoid stale closure issues

key-files:
  created: []
  modified:
    - src/components/layout/ActionBar.jsx
    - src/components/layout/ActionBar.module.css

key-decisions:
  - "Export buttons use uiPhase !== 'generating' hide guard (same as evaluate/revise) — not just disabled"
  - "handleSave reads imageBlob from getState() snapshot inside handler to avoid stale closure"
  - "createBlankPng() helper is a local function inside the component (not a module-level utility)"

patterns-established:
  - "saveStatus state machine: idle → saving → saved (setTimeout 1.5s) → idle; idle → error on failure"
  - "Export group uses border-left separator via .exportGroup CSS class"

requirements-completed: [REACT-11, PARITY-04, PARITY-08]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 04 Plan 03: ActionBar Export Buttons Summary

**Save Card, Download JSON, Download PNG buttons added to ActionBar with storageClient/pngEncoder wiring and transient 'Saved' feedback state machine**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-30T19:27:00Z
- **Completed:** 2026-03-30T19:35:03Z
- **Tasks:** 1 of 1
- **Files modified:** 2

## Accomplishments
- Added three export buttons (Save Card, Download JSON, Download PNG) to ActionBar as a visually separated second button group
- Wired Save Card to storageClient.saveCard() with setDirty(false) and a 1.5s transient "Saved" label
- Wired Download PNG to pngEncoder.createCharacterCard() with createBlankPng() fallback when no image is present
- Download JSON triggers browser file download of pretty-printed character JSON
- Export buttons are hidden during streaming (uiPhase === 'generating') and disabled with reduced opacity when no character exists

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Save Card, Download JSON, Download PNG to ActionBar** - `7f6148c` (feat)

## Files Created/Modified
- `src/components/layout/ActionBar.jsx` - Added storageClient/pngEncoder imports, saveStatus state, imageBlob subscription, createBlankPng helper, handleSave/handleDownloadJson/handleDownloadPng handlers, export button group JSX, saveError in error display
- `src/components/layout/ActionBar.module.css` - Added .exportGroup and .saveSuccess CSS classes

## Decisions Made
- Export buttons use the `uiPhase !== 'generating'` hide guard consistent with how Evaluate/Revise buttons are hidden, rather than just being disabled
- Handlers use `useGenerationStore.getState()` snapshots inside async handlers to avoid stale closure issues with imageBlob
- `createBlankPng()` is a local function inside the component (plan specified it inline, not as a service utility)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - build passed cleanly on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ActionBar export buttons complete; Save Card wires to library, clearing isDirty
- Plan 04-04 (Library panel) and 04-05 (SillyTavern sync) can proceed
- No blockers

---
*Phase: 04-export-library-full-parity*
*Completed: 2026-03-30*
