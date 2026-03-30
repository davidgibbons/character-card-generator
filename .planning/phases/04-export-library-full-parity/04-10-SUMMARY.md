---
phase: 04-export-library-full-parity
plan: "10"
subsystem: create-panel
tags: [gap-closure, mention-input, arrow-keys, parity]
dependency_graph:
  requires: []
  provides: [arrow-key-cursor-movement-in-concept-textarea]
  affects: [MentionInput]
tech_stack:
  added: []
  patterns: [capture-phase-event-listener, aria-expanded-state-check]
key_files:
  created: []
  modified:
    - src/components/create/MentionInput.jsx
decisions:
  - "Use capture-phase addEventListener (true) to intercept ArrowUp/ArrowDown before react-mentions' bubble-phase handler — stopPropagation() only, no preventDefault(), so browser still moves cursor"
  - "Check aria-expanded attribute on textarea to detect whether dropdown is open — react-mentions sets this automatically via ARIA"
metrics:
  duration: 4min
  completed_date: "2026-03-30T20:19:14Z"
  tasks_completed: 1
  files_changed: 1
requirements_closed: [PARITY-02]
---

# Phase 04 Plan 10: Arrow Key Cursor Fix in Concept Textarea Summary

**One-liner:** Capture-phase keydown listener intercepts ArrowUp/ArrowDown in MentionInput and stops propagation when the react-mentions suggestion dropdown is closed, restoring native textarea cursor movement.

## What Was Built

GAP-03 fix: `MentionsInput` from react-mentions registered keydown listeners that consumed ArrowUp/ArrowDown events even when the suggestion dropdown was closed, making cursor navigation impossible in multi-line concept text.

The fix adds a capture-phase native event listener on the underlying `<textarea>` element. In the handler, if `aria-expanded` is not `"true"` (dropdown closed), `stopPropagation()` is called so react-mentions never sees the event and the browser handles cursor movement natively. When the dropdown is open (`aria-expanded="true"`), the event propagates normally so react-mentions can navigate suggestions.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add capture-phase arrow key fix to MentionInput | 6e0ddae | src/components/create/MentionInput.jsx |

## Decisions Made

1. **Capture phase over onKeyDown prop:** react-mentions registers its own native listener at bubble phase. Using React's `onKeyDown` prop would not intercept it. Capture-phase native listener runs first, allowing selective propagation blocking.

2. **aria-expanded for dropdown state:** react-mentions automatically sets `aria-expanded="true"` on the textarea when suggestions are visible. This is the simplest way to detect open state without tapping into library internals.

3. **stopPropagation only, not preventDefault:** Calling `preventDefault()` would block the browser from moving the cursor. Only `stopPropagation()` is used to prevent the library from consuming the event.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `src/components/create/MentionInput.jsx` modified with wrapperRef and handleArrowKey
- [x] Build passes (0 errors, 119 modules)
- [x] Commit 6e0ddae exists
- [x] wrapperRef, handleArrowKey, ArrowUp/ArrowDown, stopPropagation, addEventListener with capture true all present in file
