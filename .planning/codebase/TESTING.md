# Testing

**Analysis Date:** 2026-03-26

## Current State

**No tests exist.** There is no test framework, no test files, no test scripts, and no CI pipeline.

- No `test` script in `package.json` or `proxy/package.json`
- No test directories (`__tests__/`, `test/`, `spec/`)
- No test configuration files (jest.config, mocha, vitest, etc.)
- No test dependencies in devDependencies
- No CI/CD configuration (GitHub Actions, etc.)

## What Would Benefit from Testing

### High Priority
1. **Character data parsing** (`character-generator.js: parseCharacterData`, `parseScenarioData`) — complex regex-based parsing with many edge cases
2. **V2 spec conversion** (`character-generator.js: toSpecV2Format`, `normalizeLorebookEntry`) — structured data transformation
3. **PNG metadata encoding** (`png-encoder.js`) — binary format manipulation
4. **Config sanitization** (`config.js: getSanitizedConfigForStorage`, `redactSensitiveData`) — security-sensitive

### Medium Priority
5. **Proxy routing logic** (`proxy/server.js`) — SD API detection, URL construction, auth fallback
6. **Card/prompt CRUD** (`proxy/cards.js`, `proxy/prompts.js`) — filesystem + git operations
7. **Prompt registry** (`src/scripts/prompts.js`) — template integrity

### Lower Priority
8. **UI controller** (`main.js`) — large file, would need DOM mocking
9. **Storage client** (`storage-server.js`) — thin REST wrapper

## Recommended Approach

- **Backend**: Jest or Vitest with supertest for Express route testing
- **Frontend parsing logic**: Extract pure functions for unit testing (no DOM dependency)
- **E2E**: Playwright for critical user flows (generate → edit → save → download)

---

*Testing analysis: 2026-03-26*
