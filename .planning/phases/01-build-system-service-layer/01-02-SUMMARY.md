---
phase: 01-build-system-service-layer
plan: 02
subsystem: infra
tags: [zustand, es-modules, service-layer, diff, tributejs, configStore]

# Dependency graph
requires:
  - phase: 01-build-system-service-layer (plan 01)
    provides: Vite 8 build system with React 19 entry point
provides:
  - Zustand config store replacing window.config
  - 7 ES module services replacing all window-global singletons
  - diff@7 and tributejs@5 installed from npm (replacing CDN)
affects: [01-03, 02-ui-components, 03-react-migration]

# Tech tracking
tech-stack:
  added: [diff@7, tributejs@5]
  patterns: [configStore-accessor-pattern, es-module-singleton-export, debugLog-helper]

key-files:
  created: [src/stores/configStore.js, src/services/api.js, src/services/characterGenerator.js, src/services/imageGenerator.js, src/services/pngEncoder.js, src/services/storage.js, src/services/prompts.js, src/services/mentionAutocomplete.js]
  modified: [package.json, package-lock.json]

key-decisions:
  - "configStore.get(path) accessor pattern for non-React service modules avoids useConfigStore hook outside React"
  - "Duplicated normalizeLorebookEntry in api.js to avoid circular dependency (apiHandler <-> characterGenerator)"
  - "Removed typeof Tribute guard in mentionAutocomplete since Tribute is now a guaranteed npm import"

patterns-established:
  - "Config access pattern: import { configStore } from '../stores/configStore'; configStore.get('api.text.baseUrl')"
  - "Service singleton export: export const apiHandler = new APIHandler(); export default apiHandler;"
  - "Debug logging via standalone helper: const debugLog = (...args) => { if (configStore.getState().debugMode) console.log(...args); }"

requirements-completed: [LIB-03, LIB-04]

# Metrics
duration: 10min
completed: 2026-03-27
---

# Phase 01 Plan 02: Service Layer Extraction Summary

**Zustand config store and 7 ES module services replacing all window-global singletons, with diff@7 and tributejs@5 from npm**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-27T05:44:18Z
- **Completed:** 2026-03-27T05:54:31Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created Zustand config store with full localStorage/sessionStorage persistence matching original Config class behavior exactly
- Converted all 7 window-global modules (api, characterGenerator, imageGenerator, pngEncoder, storage, prompts, mentionAutocomplete) to ES module services
- Installed diff@7 and tributejs@5 from npm, replacing CDN script tags
- Zero window globals in any new module; Vite production build succeeds with all modules included

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Zustand config store and foundational services** - `92c7d6d` (feat)
2. **Task 2: Convert remaining service modules** - `987d0a6` (feat)

## Files Created/Modified
- `src/stores/configStore.js` - Zustand store with persist middleware, sensitive value handling, dot-notation get/set
- `src/services/api.js` - APIHandler with configStore imports, streaming, abort, retry logic preserved
- `src/services/characterGenerator.js` - Character generation with direct apiHandler import
- `src/services/imageGenerator.js` - Image generation with configStore and apiHandler imports
- `src/services/pngEncoder.js` - PNG metadata encoder with configStore import
- `src/services/storage.js` - ServerBackedStorage REST client with slugifyName/blobToDataUrl exports
- `src/services/prompts.js` - PROMPT_REGISTRY, getPrompt, renderTemplate exports with configStore for overrides
- `src/services/mentionAutocomplete.js` - MentionAutocomplete with npm Tribute import, expandMentions export
- `package.json` - Added diff@7 and tributejs@5 dependencies
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used `configStore.get(path)` accessor object for non-React service modules instead of the `useConfigStore` hook, since services run outside React component lifecycle
- Duplicated `normalizeLorebookEntry` logic in api.js as a standalone function to avoid a circular dependency between apiHandler and characterGenerator (both reference each other)
- Removed the `typeof Tribute === "undefined"` guard in mentionAutocomplete since Tribute is now a guaranteed npm import via Vite bundling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted normalizeLorebookEntry to avoid circular dependency**
- **Found during:** Task 2 (api.js conversion)
- **Issue:** api.js `parseLorebookResponse` called `window.characterGenerator.normalizeLorebookEntry()` -- importing characterGenerator would create a circular dependency since characterGenerator imports apiHandler
- **Fix:** Duplicated normalizeLorebookEntry as a standalone function in api.js
- **Files modified:** src/services/api.js
- **Verification:** Vite build succeeds, no circular dependency warnings
- **Committed in:** 987d0a6

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to avoid circular module dependency. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all service modules are complete conversions of the original window-global modules.

## Next Phase Readiness
- All service modules ready for import by React components in Phase 2
- Config store ready for React hook consumption via `useConfigStore`
- Old script files in `src/scripts/` preserved for Plan 03 cleanup
- Vite build includes all new modules with tree-shaking

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 01-build-system-service-layer*
*Completed: 2026-03-27*
