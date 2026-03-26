# Phase 1: Build System + Service Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 1-Build System + Service Layer
**Areas discussed:** Module conversion scope, Old file cleanup

---

## Module Conversion Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pure ES modules first (Recommended) | Convert window globals to export/import ES modules. Keep as plain classes/functions. React hooks wrap them in Phase 2+. | |
| Directly into React hooks | Skip the ES module step — rewrite each module as a React hook or Zustand store immediately. | ✓ |
| You decide | Claude picks the approach based on what works best | |

**User's choice:** Directly into React hooks
**Notes:** None

### Follow-up: Phase 1 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Vite + entry point only in Phase 1 | Phase 1: Vite scaffold, React entry point, npm deps, Docker. Phase 2: Convert modules to hooks/stores. | |
| Convert everything in Phase 1 | Phase 1 does it all: Vite scaffold AND converts all ~10 modules to React hooks/Zustand stores. | ✓ |

**User's choice:** Convert everything in Phase 1
**Notes:** None

---

## Old File Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Remove in Phase 1 (Recommended) | Clean break. Once Vite + React entry point works, delete old files. | ✓ |
| Keep until Phase 4 | Preserve old files as reference until full feature parity is verified. | |
| You decide | Claude picks the right time based on migration progress | |

**User's choice:** Remove in Phase 1
**Notes:** None

---

## Gray Areas Not Discussed

- **Migration strategy** — Big-bang vs incremental (user did not select)
- **Dev workflow** — Port numbers, script names, proxy config (user did not select)

## Claude's Discretion

- Dev workflow port numbers
- Exact Vite config details
- Migration order of individual modules
- Zustand vs Context for specific stores

## Deferred Ideas

None
