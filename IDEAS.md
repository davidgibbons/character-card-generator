# Ideas & Future Work

Concepts to explore, grouped by theme. Shipped items are marked ✅.

---

## Current Focus: Polish shipped phases

All phases (1–5) are complete and running via a single Docker container. Known areas to revisit:

### Phase 1 — Generation UX
- **Progress bar** — works, but the indeterminate animation is generic. Could show real token-count progress if the API returns usage data mid-stream.
- **Field change highlights** — `.field-changed` clears on edit. Consider keeping a subtle indicator even after editing (e.g. a dot in the label) so the user knows the field was AI-generated since last save.

### Phase 2 — Git-Backed Storage
- **Avatar gitignore toggle** — the plan included a per-card "Version control avatar" toggle to opt the image into git commits. Not yet built.

### Phase 3 — Version History UI
- **History modal is not yet end-to-end tested** — needs at least one card with multiple commits to verify rendering, restore, and diff.
- ~~**Diff modal on mobile**~~ ✅ — Responsive stacked layout added for screens ≤ 600px.
- **"Show what changed" link** — only appears if the character had *prior* content. On first generation it correctly doesn't show. Confirm the logic is right when importing a card from library then regenerating.

### Phase 4 — ST Example Message Push
- **Push to ST requires an image** — if no image is loaded the push is blocked with a warning. Consider whether a no-image push (just updating `mes_example` via a different ST API endpoint) is worth implementing.
- **End-to-end test** — not tested against a live ST instance yet.

### Phase 5 — Prompt Template Persistence ✅
- Prompts stored server-side under `DATA_DIR/prompts/`, git-backed, same pattern as cards.
- History per prompt is intentionally not implemented (overkill for prompt templates).

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

- `@name` prompt references are unblocked (stable slug identity exists) but still need UX design work before implementation.
- Quality evaluator and lorebook generation remain deferred.
- Next meaningful features: `@name` references (medium effort) or avatar gitignore toggle (small effort).
