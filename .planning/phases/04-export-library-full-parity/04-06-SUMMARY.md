---
phase: 04-export-library-full-parity
plan: "06"
subsystem: settings-ui, mention-autocomplete
tags: [sillytavern, sync, push, pull, mention-autocomplete, settings]
dependency_graph:
  requires: [04-04]
  provides: [SillyTavernSection, MentionInput-wired]
  affects: [SettingsModal, CreatePanel]
tech_stack:
  added: []
  patterns: [draft-values-for-api-calls, getState-snapshot-pattern, useEffect-on-mount]
key_files:
  created:
    - src/components/settings/SillyTavernSection.jsx
    - src/components/settings/SillyTavernSection.module.css
  modified:
    - src/components/settings/SettingsModal.jsx
    - src/components/create/MentionInput.jsx
decisions:
  - SillyTavernSection reads draft.api.sillytavern.url/password for API calls (not configStore) per Pitfall 4 -- draft values may be unsaved when user clicks List Characters
  - Push with image uses pngEncoder.createCharacterCard + blobToBase64; without image sends characterJson directly
  - MentionInput errors are silently ignored (mention suggestions are a convenience feature, not critical)
metrics:
  duration: 2min
  completed: "2026-03-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 06: SillyTavern Sync and Mention Autocomplete Summary

SillyTavern push/pull sync UI in SettingsModal and @mention autocomplete wired to real card data from storageClient.listCards().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SillyTavernSection and add to SettingsModal | 5d0b63e | SillyTavernSection.jsx, SillyTavernSection.module.css, SettingsModal.jsx |
| 2 | Wire MentionInput @mention suggestions to storageClient.listCards() | c93561d | MentionInput.jsx |

## What Was Built

### SillyTavernSection (new)

- URL and password fields reading from `draft.api.sillytavern.url/password` (not configStore) so unsaved draft values are used for test API calls
- List Characters button: POST `/api/st/characters` with `X-ST-URL` / `X-ST-Password` headers
- Push Character button: if imageBlob exists, creates PNG via `pngEncoder.createCharacterCard` then base64-encodes and sends to POST `/api/st/push`; if no image, sends `characterJson` directly
- Pull Character: dropdown of ST characters after List; POST `/api/st/pull` with selected `avatar_url`; loads result into `useGenerationStore.getState().setCharacter()`
- Error states with user-facing messages for both push and pull failures
- Loading/done transient button states with 2-second reset

### MentionInput wired (updated)

- `useEffect` on mount calls `storageClient.listCards()` and maps results to `{ id: slug, display: characterName }` shape
- `data={cardMentions}` replaces the `data={[]}` placeholder from Phase 3
- Errors silently caught (convenience feature, not critical path)

## Decisions Made

- Draft values for ST API calls: `draft.api.sillytavern.url/password` used instead of `configStore.get()` — user may be testing with unsaved URL
- Push format: image path uses pngEncoder for ST-compatible V2 PNG; no-image path sends raw JSON (ST supports both)
- Mention errors silently ignored: network failure should not break the concept input textarea

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — MentionInput is now fully wired to real card data. SillyTavernSection makes real API calls.

## Self-Check: PASSED

- [x] src/components/settings/SillyTavernSection.jsx exists
- [x] src/components/settings/SillyTavernSection.module.css exists
- [x] src/components/settings/SettingsModal.jsx contains `import SillyTavernSection`
- [x] src/components/create/MentionInput.jsx contains `storageClient.listCards()`
- [x] Commits 5d0b63e and c93561d exist
- [x] npm run build exits 0
