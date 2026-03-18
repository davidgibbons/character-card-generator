# Ideas & Future Work

Concepts to explore, roughly grouped by theme. Not prioritized.

---

## Upstream PR Candidates

These are self-contained improvements with no fork-specific dependencies — good candidates to pitch to Tremontaine.

### Debug Response Viewer
Show the raw LLM output in a modal when the user wants to inspect it. Useful when the model refuses, hits a token limit, or returns garbled/incomplete fields — gives visibility into what actually came back before parsing.
**Status:** Done on `feature/debug-response`, awaiting upstream interest.

### API Settings Modal Scrolling
`overflow: hidden` on the modal cuts off fields below the fold.
**Status:** Fixed in `main` at `0ddff7f`, cherry-pick candidate.

### Dark Mode
A dark theme toggle. Eyes are bleeding.

### Card Quality Evaluator
After generation, offer a "Rate this card" action that sends the card back to the LLM to:
- Score overall quality
- Flag inconsistencies (personality contradicts scenario, first message breaks POV, etc.)
- Flag contradictions between fields

---

## SillyTavern Integration (Fork-specific)

### Pull/Push to SillyTavern
Sync cards directly with a running SillyTavern instance — pull existing characters for editing, push generated cards back.
**Status:** Pull is done (in `main`). Push not yet implemented.

### Push Generated Intro Messages to ST
The app already generates example/intro messages but currently relies on copy/paste into ST manually. Add a push action to write them directly to the character's profile in a running ST instance. Requires ST URL configured (same as pull).

### Reference Characters in Prompts
Once cards aren't duplicated (see versioning below), allow `@name` references in the concept prompt:
- _"Create an arch nemesis for @bob"_
- _"Update this character to be @chad's girlfriend"_

Resolves the referenced card's fields and injects relevant context into the generation prompt.

---

## Card Versioning

Currently each save creates a duplicate IndexedDB entry. Two paths forward:

### Option A — Linked records (smaller change)
Add `parentId` and `versionNumber` fields to card records. Each save creates a new record linked to its parent. UI shows version history and lets you roll back.
- Client-side only, no architecture change
- Simpler to implement

### Option B — Git-backed storage (larger change)
Migrate IndexedDB to server-side git storage via the proxy. Each save is a commit.
- Free diff/rollback via standard git tooling
- Opens path to GitHub backup and publishing
- Architecture shift: storage moves from client to server
- Enables cross-device access

Either option unblocks `@name` prompt references (no more ambiguity about which version to use).

---

## Lorebook Generation

Generate a lorebook alongside the character. UI-wise: wrap the results area in a tabbed layout so you can switch between the character editor and lorebook editor without losing context.

---

## Notes

- Ideas that touch versioning should probably wait until a versioning approach is chosen — several features depend on it.
- Dark mode and the quality evaluator are independent and could be picked up anytime.
