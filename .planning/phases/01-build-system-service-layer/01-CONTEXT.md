# Phase 1: Build System + Service Layer - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the frontend build system from vanilla JS with manual `<script>` tags to Vite + React. Convert all existing frontend modules (~10 files) from window-global singletons directly into React hooks and Zustand stores. Bundle all CDN dependencies via npm. Update Dockerfile for multi-stage build with Node 22. Remove old vanilla JS files after migration.

</domain>

<decisions>
## Implementation Decisions

### Module Conversion Strategy
- **D-01:** Convert all existing JS modules directly into React hooks and Zustand stores — skip the intermediate "pure ES module" step. Logic gets coupled to React from day 1. This means api.js becomes a hook/service, config.js becomes a Zustand store, character-generator.js becomes a hook, etc.
- **D-02:** All module conversions happen in Phase 1 (not deferred to Phase 2). Phase 1 is a bigger phase that delivers both the Vite scaffold AND the full service layer conversion.

### Old File Cleanup
- **D-03:** Remove old vanilla JS files (src/scripts/*.js, original index.html with script tags) in Phase 1 after the Vite + React entry point is working. Clean break — old code lives in git history. No dead code carried forward.

### Build System
- **D-04:** Vite 8 + @vitejs/plugin-react for build tooling. Dev server on port 2427 proxying /api to Express on port 2426 (same port layout as current).
- **D-05:** Docker multi-stage build: npm run build → Express serves dist/ in production. Node 22-alpine base image.
- **D-06:** npm scripts: `dev` (concurrent Vite + Express), `build` (Vite production build), `start` (Express only for production).

### Claude's Discretion
- Dev workflow port numbers (keep current 2427/2426 layout unless there's a reason to change)
- Exact Vite config details (proxy setup, build output dir)
- Migration order of individual modules (which to convert first)
- Whether to use Zustand or React Context for specific stores (research recommended Zustand for streaming state; Context acceptable for static config)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Codebase Analysis
- `.planning/codebase/STACK.md` — Current technology stack and dependencies
- `.planning/codebase/ARCHITECTURE.md` — Current module system (window globals, script loading order, data flows)
- `.planning/codebase/STRUCTURE.md` — Current file layout and entry points
- `.planning/codebase/CONCERNS.md` — Technical debt items relevant to migration

### Research
- `.planning/research/STACK.md` — Recommended Vite + React + Zustand stack with versions
- `.planning/research/ARCHITECTURE.md` — Component architecture and migration strategy
- `.planning/research/PITFALLS.md` — Migration pitfalls (Vite proxy is dev-only, SSE streaming stale closures, etc.)

### Project
- `.planning/PROJECT.md` — Project context, constraints (feature parity, single-container deployment)
- `.planning/REQUIREMENTS.md` — BUILD-01..07, LIB-03, LIB-04 requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Modules to Convert
- `src/scripts/config.js` — Config class with localStorage/sessionStorage → Zustand config store
- `src/scripts/api.js` — APIHandler class with streaming, abort, retry → useApi hook or api service
- `src/scripts/character-generator.js` — CharacterGenerator with parsing → useCharacterGenerator hook
- `src/scripts/image-generator.js` — ImageGenerator → useImageGenerator hook
- `src/scripts/png-encoder.js` — PNGEncoder (keep as utility, not a hook — pure logic)
- `src/scripts/storage-server.js` — ServerBackedStorage REST client → useStorage hook or storage service
- `src/scripts/prompts.js` — PROMPT_REGISTRY object → ES module export (data, not a class)
- `src/scripts/mention-autocomplete.js` — Tribute.js wrapper → will be replaced by react-mentions in Phase 3
- `src/scripts/main.js` — CharacterGeneratorApp controller → decomposed into React components in Phase 2+

### CDN Dependencies to Bundle
- `diff@7.0.0` from jsDelivr → npm install diff
- `tributejs@5.1.3` from jsDelivr → npm install tributejs (or replace with react-mentions)

### Integration Points
- Express backend (`proxy/server.js`) stays completely unchanged
- Vite dev proxy replaces the current `http-server --proxy` setup
- Production: Express `STATIC_ROOT` env var already supports serving from a different directory (just point to `dist/`)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Vite + React scaffolding.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-build-system-service-layer*
*Context gathered: 2026-03-26*
