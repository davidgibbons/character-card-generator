---
phase: 03-generation-editing
type: context
status: complete
date: 2026-03-28
---

# Phase 3 Context: Generation + Editing

## Phase Goal

Wire up the full character generation flow in React: concept input panel, SSE streaming display, structured field editor, evaluate/revise cycle, @mention autocomplete, and parseSections() parser replacement.

## Prior Decisions (carried forward)

- **Shared split-pane**: left = form (tab-specific), right = character output — locked in Phase 2
- **CSS Modules** per component — established in Phase 2
- **Zustand** for all shared state — established in Phase 1
- **react-mentions** for @mention autocomplete — LIB-02, locked in requirements
- **Services as ES modules** in `src/services/` — established in Phase 1
- **No new features** — feature parity only

---

## Decisions Made in This Session

### 1. Streaming State Architecture

**Decision:** Zustand `useGenerationStore` store. `onStream(chunk)` callback writes directly via `getState().append(chunk)`. Components subscribe to store slices.

**Store shape:**
```js
// src/stores/useGenerationStore.js
{
  streamText: '',       // raw accumulated stream output
  isGenerating: false,  // true while SSE stream is active
  abortController: null,// current AbortController for stop button
  character: null,      // parsed character object after generation
  evalFeedback: '',     // evaluation result text
  reviseInstruction: '',// editable revision instruction (pre-populated from eval)
  lockedFields: Set(),  // field keys locked from revise
  // actions: append, reset, setCharacter, setEvalFeedback, setReviseInstruction, toggleLock, abort
}
```

**Why this pattern:** `getState().append()` never captures stale closures — always reads fresh Zustand state. Components use `useGenerationStore((s) => s.streamText)` subscriptions.

**Service call pattern:**
```js
// No closure risk — getState() is always fresh
apiHandler.generateCharacter(prompt, name, (chunk) => {
  useGenerationStore.getState().append(chunk);
}, pov, lorebook);
```

---

### 2. Stream Output Display → Structured Field Editor

**During generation:**
- Right panel shows raw stream text in a scrolling `<pre>`/textarea-like box
- Auto-scrolls to bottom as chunks arrive
- ProgressBar (already built) shows in ActionBar

**After generation completes:**
- `parseSections()` runs on `streamText`
- `setCharacter(parsed)` stores the structured object in `useGenerationStore`
- Right panel switches from `<StreamView>` to `<CharacterEditor>`
- `streamText` can be cleared or kept for debug mode display

**Field editor layout:**
- Flat list of labeled textareas
- Each row: `[Label] [textarea (auto-height)] [🔒 lock button]`
- Fields in order: Name, Personality, Description, Scenario, First Message, Tags, Message Example, System Prompt, Creator Notes
- Locked fields: textarea is disabled/dimmed, lock icon shows locked state
- Fields are immediately editable after generation (no separate "edit mode")

---

### 3. parseSections() Utility

**Location:** `src/utils/parseSections.js`

**Implementation:**
```js
export function parseSections(text) {
  const sections = {};
  const blocks = text.split(/^##\s+/m);
  for (const block of blocks.slice(1)) {
    const nl = block.indexOf('\n');
    if (nl === -1) continue;
    const key = block.slice(0, nl).trim().toLowerCase();
    sections[key] = block.slice(nl + 1).trim();
  }
  return sections;
}
```

**Prompt normalization:**
- All prompt templates in `src/services/prompts.js` updated to output `## Section Name` headers consistently
- Both first-person and third-person modes use **identical section headers**:
  `## Name`, `## Personality`, `## Description`, `## Scenario`, `## First Message`, `## Tags`, `## Message Example`, `## System Prompt`
- POV only affects prose style via the system prompt instruction (e.g. "write in first person")
- Scenario-mode prompt already uses `##` markers — normalize to same set

**Replaces:**
- `parseCharacterData()` regex logic in `src/services/characterGenerator.js`
- `parseScenarioResponse()` in `src/services/characterGenerator.js`
- Any other ad-hoc section parsing

---

### 4. Evaluate / Revise UX

**Evaluate flow:**
1. User clicks Evaluate button in ActionBar
2. `isGenerating = true`, ProgressBar shows
3. `apiHandler.evaluateCard(character)` runs (non-streaming, per existing api.js)
4. Result stored in `useGenerationStore.evalFeedback`
5. Right panel shows character fields + eval feedback block below
6. ActionBar expands to show revision instruction textarea (pre-populated from eval feedback)

**Eval feedback block (inline in right panel, below fields):**
```
┌─ Evaluation Feedback ──────────────────┐
│ [eval text — read-only, scrollable]    │
└────────────────────────────────────────┘
```

**Revise flow:**
1. ActionBar revision instruction textarea is pre-populated with eval feedback
2. User can edit the instruction freely
3. User clicks Revise → `apiHandler.reviseCharacter(character, reviseInstruction)` runs
4. Streams back into `streamText`, right panel switches back to StreamView
5. On complete, parseSections() runs again, replaces non-locked fields in `character`
6. Eval feedback block clears (revise resets it)

**Locking during revise:**
- `lockedFields` Set in store contains field keys to skip
- `reviseCharacter` call passes locked fields so service can omit them from the prompt
- Right panel shows locked fields dimmed with lock icon

---

## Component Map (new/updated for Phase 3)

### New stores
- `src/stores/useGenerationStore.js` — stream, character, eval, revise, locks

### New utilities
- `src/utils/parseSections.js` — section parser

### New components
- `src/components/create/CreatePanel.jsx` + `.module.css` — left panel: concept input, name, POV selector
- `src/components/create/MentionInput.jsx` + `.module.css` — react-mentions wrapper for concept textarea
- `src/components/character/CharacterEditor.jsx` + `.module.css` — right panel: flat field list
- `src/components/character/FieldRow.jsx` + `.module.css` — single field: label + textarea + lock button
- `src/components/character/StreamView.jsx` + `.module.css` — raw stream output display
- `src/components/character/EvalFeedback.jsx` + `.module.css` — evaluation feedback block

### Updated components
- `src/components/layout/ActionBar.jsx` — wire Generate/Evaluate/Revise buttons, revision textarea expansion, stop button
- `src/App.jsx` — wire left panel to CreatePanel, right panel to StreamView/CharacterEditor
- `src/stores/configStore.js` — no changes expected

### Updated services
- `src/services/prompts.js` — normalize all section headers to consistent `## Section` format
- `src/services/characterGenerator.js` — replace parseCharacterData/parseScenarioResponse with parseSections()
- `src/services/api.js` — minimal: ensure onStream callback contract is preserved (no changes to streaming logic itself)

### Deferred to Phase 4
- `src/services/mentionAutocomplete.js` — library card loading for @mention suggestions (react-mentions skeleton in Phase 3, full card list population in Phase 4 alongside library CRUD)

---

## Risk Notes

- **SSE stale closure**: Mitigated by `getState().append()` pattern. Do NOT pass React state setters as the onStream callback.
- **parseSections() robustness**: LLMs may deviate from `##` headers. Add a fallback that returns the full text as a `_raw` key if no sections are found.
- **react-mentions bundle size**: Check that tree-shaking works; react-mentions brings its own deps.
- **Revise with locked fields**: The existing `api.reviseCharacter()` doesn't accept a locked-fields list — the service layer will need to reconstruct the character object omitting locked content before sending.
- **evalFeedback reset on revise**: Ensure store resets `evalFeedback` and `reviseInstruction` when a new generate or revise starts.
