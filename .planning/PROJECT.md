# Character Card Generator — Code Quality Refactor

## What This Is

A self-hosted web app for generating SillyTavern-compatible AI character cards using LLM APIs. Users describe a character concept, the app generates structured character profiles via streaming LLM calls, supports image generation, and exports cards as V2-spec PNG files with embedded metadata. Includes a git-backed card/prompt library and SillyTavern push/pull sync.

## Core Value

Modernize the frontend architecture to React + Vite so the codebase is maintainable, extensible, and uses established libraries instead of hand-rolled solutions.

## Requirements

### Validated

- ✓ Character generation via OpenAI-compatible LLM APIs with streaming — existing
- ✓ First-person, third-person, and scenario card generation modes — existing
- ✓ Character evaluation and revision workflow — existing
- ✓ Image generation (OpenAI-compatible + A1111/KoboldCpp SD API) — existing
- ✓ V2 character card PNG export with embedded metadata — existing
- ✓ Git-backed card and prompt library with CRUD, history, and diff — existing
- ✓ SillyTavern push/pull sync — existing
- ✓ @mention autocomplete for referencing library cards — existing
- ✓ Lorebook generation and CRUD — existing
- ✓ Content policy prefix toggle — existing
- ✓ Dark/light theme switching — existing
- ✓ Configurable API settings with session/persistent key storage — existing
- ✓ Single-container Docker deployment — existing

### Active

- [ ] Migrate build system from static `<script>` tags to Vite
- [ ] Rewrite frontend from vanilla JS + window globals to React components
- [ ] Replace regex-based LLM response parsing with a structured parsing approach/library
- [ ] Replace hand-rolled PNG metadata encoder with an established library
- [ ] Preserve all existing features through the migration (feature parity)
- [ ] Maintain single-container Docker deployment (Vite builds static assets, Express serves them)

### Out of Scope

- Security hardening (SSRF on image proxy, CSP tightening) — deferred to future milestone
- Test suite — deferred to future milestone
- New features — this milestone is purely about architecture and code quality
- Backend refactoring — Express proxy server stays as-is (CommonJS Node.js)

## Context

- Brownfield project with ~10 frontend JS files using window-global singleton pattern
- `main.js` is ~1500+ lines containing all UI logic — the largest maintainability pain point
- No build step currently — all JS served as-is with manual cache-busting query strings
- Backend is Express with `simple-git` for versioned card/prompt storage
- Codebase map available at `.planning/codebase/` with full architecture analysis
- Existing Docker setup uses `node:20-alpine`, serves both API and static files on port 2426

## Constraints

- **Feature parity**: Every existing capability must work after migration — no regressions
- **Deployment model**: Single Docker container serving both API and static assets
- **Backend unchanged**: Express proxy server (`proxy/`) stays CommonJS Node.js — only frontend migrates
- **No new features**: This is a refactor milestone, not a feature milestone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vite as build tool | Modern, fast, excellent React support, ESM-native | — Pending |
| React as frontend framework | Largest ecosystem, component model, hooks for state management | — Pending |
| Keep Express backend as-is | Backend is stable and working; minimize blast radius | — Pending |
| Single-container deployment preserved | User requirement; Vite builds to static assets served by Express | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after initialization*
