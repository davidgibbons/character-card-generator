# Ideas & Future Work

Concepts to explore, grouped by theme. Shipped items are marked ✅.

---

## Current Focus: Iterate on Phases 1–4

The core roadmap (Phases 1–4) shipped in one session. Before moving to Phase 5 (Prompt Persistence), the priority is to stress-test and refine what's already built. Known areas to revisit:

### Phase 1 — Generation UX
- **Progress bar** — works, but the indeterminate animation is generic. Could show real token-count progress if the API returns usage data mid-stream.
- **Field change highlights** — `.field-changed` clears on edit. Consider keeping a subtle indicator even after editing (e.g. a dot in the label) so the user knows the field was AI-generated since last save.

### Phase 2 — Git-Backed Storage
- **Migration banner** — not yet tested with real IndexedDB data. Needs a test pass with existing cards.
- **Prompt storage still uses IndexedDB** — prompts are not yet server-side. They survive only in the browser. Phase 5 addresses this.
- **Avatar gitignore toggle** — the plan included a per-card "Version control avatar" toggle to opt the image into git commits. Not yet built.
- **Error UX when proxy is down** — `_cardsAvailable` is set false on startup if the proxy is unreachable, but the library just shows empty with no explanation. Should surface a clear "proxy not running" state.

### Phase 3 — Version History UI
- **History modal is not yet end-to-end tested** — needs at least one card with multiple commits to verify rendering, restore, and diff.
- **Diff modal on mobile** — the side-by-side grid collapses badly at narrow widths. Needs a responsive stack layout.
- **"Show what changed" link** — only appears if the character had *prior* content. On first generation it correctly doesn't show. Confirm the logic is right when importing a card from library then regenerating.

### Phase 4 — ST Example Message Push
- **Push to ST requires an image** — if no image is loaded the push is blocked with a warning. Consider whether a no-image push (just updating `mes_example` via a different ST API endpoint) is worth implementing.
- **End-to-end test** — not tested against a live ST instance yet.

---

## Phase 5: Prompt Template Persistence (Next)

Move prompt storage from IndexedDB to server-side git-backed storage under `DATA_DIR/prompts/`. Same pattern as cards. Enables cross-device access and removes the "lose your prompts if you clear storage" problem.

Considered scope: history per prompt is probably overkill. Simple versioned file storage (one commit per save) is enough for Phase 5.

---

## Upstream PR Candidates

Self-contained improvements with no fork-specific dependencies.

### Debug Response Viewer ✅
Show the raw LLM output in a modal. Done on `main`.

### API Settings Modal Scrolling ✅
Fixed `overflow: hidden` that cut off fields. Done on `main`.

### Dark Mode ✅
Moon/sun toggle in footer. Done on `main`.

---

## SillyTavern Integration

### Pull/Push to SillyTavern ✅
Pull characters for editing, push generated cards back. Done on `main`.

### Push Generated Intro Messages to ST ✅
Done (Phase 4). Button appears next to "Copy to Clipboard" after example messages are generated; requires ST URL configured and an image loaded.

### Reference Characters in Prompts
`@name` references in the concept field — resolves the referenced card's fields into the generation prompt. Depends on stable card identity (now available via slugs). Still not built.

---

## Card Versioning ✅

### Option B — Git-backed server storage
Done (Phase 2 + Phase 3). Each card save = git commit; history and diff UI implemented. `DATA_DIR` configurable, defaults to `/data` in Docker.

---

## Card Quality Evaluator

After generation, send the card back to the LLM to:
- Score overall quality
- Flag field inconsistencies (personality contradicts scenario, first message breaks POV)
- Flag contradictions between fields

Deferred — needs UX design work.

---

## Lorebook Generation

Generate a lorebook alongside the character. UI would need a tabbed layout to switch between character editor and lorebook editor.

Deferred — low demand signal.

---

## Notes

- Phase 5 (prompt server storage) is the natural next step but the user wants to iterate on Phases 1–4 first.
- `@name` prompt references are now unblocked (stable slug identity exists) but still need design work.
- Quality evaluator and lorebook generation remain deferred.
