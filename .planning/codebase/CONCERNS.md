# Technical Concerns

**Analysis Date:** 2026-03-26

## Security

### SSRF via Image Proxy (Medium)
`/api/proxy-image?url=...` fetches arbitrary URLs server-side with no allowlist. An attacker could use this to probe internal network resources or access cloud metadata endpoints. The `url` parameter is used directly in `fetch()` without validation.

### Open CORS (Low)
`app.use(cors())` allows all origins. Acceptable for a self-hosted tool, but worth noting.

### CSP Allows unsafe-inline (Low)
The Content-Security-Policy header includes `'unsafe-inline'`, which weakens XSS protections. The inline styles in `index.html` require this.

### API Keys in Browser (Acceptable/By Design)
API keys stored in sessionStorage (or localStorage with opt-in). The proxy forwards but never stores them. This is a deliberate design choice for a self-hosted tool.

## Performance

### Large Main Controller (~1500+ lines)
`main.js` contains the entire `CharacterGeneratorApp` class with all UI logic. While functional, it's becoming harder to navigate and maintain. No performance issue, but a maintainability concern.

### No Code Splitting or Lazy Loading
All JS files loaded upfront. Not a concern at current size (~10 files), but would matter if the codebase grows significantly.

### Manual Cache-Busting
Script/CSS tags use manual query string versioning (`?v=20260325a`). Easy to forget to update, leading to stale cached code in browsers.

## Technical Debt

### No Module System
Window-global singletons with manual `<script>` load ordering. Works but fragile — adding/reordering scripts can cause subtle breakage. Migration to ES modules would improve reliability.

### Regex-Based Response Parsing
`character-generator.js` parses LLM output using regex patterns (`parseCharacterData`, `parseScenarioData`). Brittle against format variations in LLM responses. Edge cases exist where section markers are missing or formatted differently.

### No Tests
Zero test coverage. Changes to parsing logic, config handling, or API routing can introduce regressions undetected. See TESTING.md for recommendations.

### Monolithic index.html
Single HTML file contains all markup. Not a blocker but makes it harder to work on specific UI sections.

## Dependency Risks

### CDN Dependencies
`diff` and `tributejs` loaded from jsDelivr CDN. If CDN is unavailable, @mention autocomplete and card diffing break. Consider bundling or self-hosting.

### `response.buffer()` Deprecation
`proxy/server.js:480` uses `response.buffer()` which is deprecated in newer Node.js fetch implementations. Should use `response.arrayBuffer()` and wrap with `Buffer.from()`.

### simple-git
`simple-git` shells out to the system `git` binary. The Docker image installs git via `apk add`, but any environment without git will fail at runtime with an unclear error.

## Scalability

### Single-Process Server
One Express instance handles all requests. Fine for personal/small-team use. Not suitable for high-concurrency scenarios.

### Filesystem Storage
Cards and prompts stored as individual JSON files on disk. Git operations (commit per save) add latency. Would not scale to thousands of cards, but appropriate for the use case.

### No Rate Limiting
Proxy endpoints have no rate limiting. An exposed instance could be used to make unlimited upstream API calls.

---

*Concerns analysis: 2026-03-26*
