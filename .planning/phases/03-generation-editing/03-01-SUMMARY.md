---
phase: 03-generation-editing
plan: "01"
subsystem: generation
tags: [parsing, state-management, zustand, prompts, react-mentions]
dependency_graph:
  requires: []
  provides:
    - src/utils/parseSections.js
    - src/stores/useGenerationStore.js
  affects:
    - src/services/characterGenerator.js
    - src/services/prompts.js
tech_stack:
  added:
    - react-mentions ^4.4.10
  patterns:
    - parseSections() splits ## headers into keyed object with _raw fallback
    - sectionsToCharacter() maps lowercase section keys to camelCase character fields
    - Zustand 5.x named import pattern for useGenerationStore
    - lockedFields as plain object (not Set) for JSON-serializability
key_files:
  created:
    - src/utils/parseSections.js
    - src/stores/useGenerationStore.js
  modified:
    - src/services/prompts.js
    - src/services/characterGenerator.js
    - package.json
    - package-lock.json
decisions:
  - lockedFields is plain object {} not Set — Set is not JSON-serializable and harder to debug
  - sectionsToCharacter() maps 'creator notes' (not 'post history instructions') to match CharacterEditor field name
  - reset() preserves lockedFields so user lock state survives between generation runs
metrics:
  duration: 3 minutes
  completed: "2026-03-28"
  tasks_completed: 3
  files_changed: 6
---

# Phase 3 Plan 1: Foundation — parseSections, useGenerationStore, Prompt Normalization Summary

**One-liner:** parseSections() utility + sectionsToCharacter() key mapping, useGenerationStore Zustand store with streaming/lock state, and normalized ## Section headers across all prompt templates replacing ad-hoc regex parsing in characterGenerator.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install react-mentions and create parseSections utility | 4546f7c | src/utils/parseSections.js, package.json, package-lock.json |
| 2 | Create useGenerationStore | 3cbf019 | src/stores/useGenerationStore.js |
| 3 | Normalize prompt templates and replace parser in characterGenerator | fe703d8 | src/services/prompts.js, src/services/characterGenerator.js |

## What Was Built

### parseSections.js + sectionsToCharacter()

`src/utils/parseSections.js` exports two functions:

- `parseSections(text)` — splits on `^## ` markers (multiline regex), returns `{ sectionNameLowercase: content }` for each section. Returns `{ _raw: text }` if no `##` sections are found (LLM deviated from template).
- `sectionsToCharacter(sections, rawText)` — maps lowercase section keys to camelCase character object fields. Handles aliases (`'first message'` → `firstMessage`, `'message example'` → `mesExample`, `'system prompt'` → `systemPrompt`, etc.). Returns a full character object with all expected fields.

### useGenerationStore

`src/stores/useGenerationStore.js` — Zustand 5.x store managing all generation/streaming/editing state:

- **Streaming state:** `streamText`, `isGenerating`, `abortController`
- **Character state:** `character` (parsed after generation), `prevCharacter` (snapshot before revise for diff highlight)
- **Eval/revise state:** `evalFeedback` (object from evaluateCard, not string), `reviseInstruction`
- **Lock state:** `lockedFields` as plain object `{ fieldKey: boolean }` — intentionally preserved on `reset()` so user lock choices survive between generation runs
- **Actions:** `append`, `reset`, `setGenerating`, `setCharacter`, `updateField`, `setEvalFeedback`, `setReviseInstruction`, `toggleLock`, `abort`

### Normalized Prompt Templates

All three generation prompt templates in `src/services/prompts.js` now emit consistent `## Section` headers parseable by `parseSections()`:

- **generate_first_person**: `## Name`, `## Personality` (was `## My Personality & What Drives Me`), `## Scenario` (was `# The Roleplay's Setup`), `## First Message` (was `# First Message`), `## Message Example` (was `# Example Messages`), `## Tags` (was `# Tags`)
- **generate_third_person**: Same set. `## Personality` (was `## Personality & Drives`), same other changes as above.
- **generate_scenario**: `## Name` added, `## Message Example` (was `## Example Messages`), `## Creator Notes` (was `## Post-History Instructions`)

All three templates include an explicit `## Name` instruction block instructing the LLM to write only the character's actual name on the line after the header.

### characterGenerator.js Updated

`parseCharacterData()` and `parseScenarioData()` method bodies replaced with two-line delegation to `parseSections()` + `sectionsToCharacter()`. All the previous regex-based parsing (~130 lines) removed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates foundational utilities and store, not UI components. All exports are fully functional.

## Self-Check: PASSED

- src/utils/parseSections.js: FOUND
- src/stores/useGenerationStore.js: FOUND
- Commit 4546f7c: FOUND
- Commit 3cbf019: FOUND
- Commit fe703d8: FOUND
- react-mentions in package.json: FOUND
- parseSections tests: PASS
- useGenerationStore tests: PASS
