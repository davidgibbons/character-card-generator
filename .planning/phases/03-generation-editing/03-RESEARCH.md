# Phase 3: Generation + Editing — Research

**Researched:** 2026-03-28
**Domain:** React streaming UI, Zustand state management, react-mentions, character field editor
**Confidence:** HIGH

## Summary

Phase 3 wires the full character generation flow into the React app built in Phases 1–2. The service layer (api.js, characterGenerator.js, prompts.js) already exists and works — the primary work is building UI components that consume those services correctly while managing streaming state without stale closures.

The core technical challenge is SSE streaming. The existing `apiHandler.generateCharacter()` accepts an `onStream(chunk, fullContent)` callback and pipes Server-Sent Events chunks through it. React state setters cannot be passed as that callback because they capture stale closures; Zustand's `getState().append()` pattern avoids this entirely.

The secondary challenge is the parseSections() replacement. The existing parser uses brittle regex on non-uniform headers (e.g., `# Name's Profile`, `## My Personality & What Drives Me`, `# The Roleplay's Setup`). The CONTEXT.md decision normalizes ALL prompt templates to emit `## Section Name` headers and replaces the parser with a simple `split(/^##\s+/m)` approach. This requires editing all three prompt templates in prompts.js.

**Primary recommendation:** Build useGenerationStore first (the store is the foundation everything else depends on), then implement components top-down: CreatePanel → ActionBar wiring → StreamView → CharacterEditor/FieldRow → EvalFeedback.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**1. Streaming State Architecture**
- Zustand `useGenerationStore` store. `onStream(chunk)` callback writes via `getState().append(chunk)`. Components subscribe to store slices.
- Store shape:
  ```js
  {
    streamText: '',
    isGenerating: false,
    abortController: null,
    character: null,
    evalFeedback: '',
    reviseInstruction: '',
    lockedFields: Set(),
    // actions: append, reset, setCharacter, setEvalFeedback, setReviseInstruction, toggleLock, abort
  }
  ```
- Service call pattern: `apiHandler.generateCharacter(prompt, name, (chunk) => { useGenerationStore.getState().append(chunk); }, pov, lorebook)`

**2. Stream Output Display → Structured Field Editor**
- During generation: right panel shows raw stream text in scrolling `<pre>`-like box (StreamView)
- After generation completes: parseSections() runs on streamText, setCharacter(parsed) → right panel switches to CharacterEditor
- Field editor layout: flat list of labeled textareas, each row [Label] [textarea (auto-height)] [lock button]
- Field order: Name, Personality, Description, Scenario, First Message, Tags, Message Example, System Prompt, Creator Notes
- Locked fields: textarea disabled/dimmed, lock icon shows locked state
- Fields immediately editable after generation (no separate edit mode)

**3. parseSections() Utility**
- Location: `src/utils/parseSections.js`
- Implementation:
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
- All prompt templates in `src/services/prompts.js` updated to output `## Section Name` headers consistently
- Both 1st-person and 3rd-person modes use identical section headers: `## Name`, `## Personality`, `## Description`, `## Scenario`, `## First Message`, `## Tags`, `## Message Example`, `## System Prompt`
- POV affects prose style via system prompt instruction only
- Scenario-mode prompt already uses `##` markers — normalize to same set
- Replaces `parseCharacterData()` and `parseScenarioResponse()` in characterGenerator.js
- Fallback: if no sections found, return full text as `_raw` key

**4. Evaluate / Revise UX**
- Evaluate: non-streaming call to `apiHandler.evaluateCard(character)`, result in `useGenerationStore.evalFeedback`
- Right panel shows fields + eval feedback block below during post-evaluate state
- ActionBar expands: revision instruction textarea pre-populated from evalFeedback
- Revise: `apiHandler.reviseCharacter(character, reviseInstruction)` — NOTE: current api.js reviseCharacter does NOT stream and does NOT accept locked fields. Service layer must reconstruct character omitting locked content before the call.
- Revise streams back into streamText (but existing reviseCharacter is non-streaming JSON — see pitfall below)
- On complete: parseSections() runs, replaces non-locked fields in character
- evalFeedback clears on new generate or revise

**5. Component Map (locked)**
New stores: `src/stores/useGenerationStore.js`
New utilities: `src/utils/parseSections.js`
New components:
- `src/components/create/CreatePanel.jsx` + `.module.css`
- `src/components/create/MentionInput.jsx` + `.module.css`
- `src/components/character/CharacterEditor.jsx` + `.module.css`
- `src/components/character/FieldRow.jsx` + `.module.css`
- `src/components/character/StreamView.jsx` + `.module.css`
- `src/components/character/EvalFeedback.jsx` + `.module.css`
Updated: ActionBar.jsx, App.jsx, src/services/prompts.js, src/services/characterGenerator.js

### Claude's Discretion

- Internal implementation details of each component (e.g., how auto-height textarea is implemented, exact useRef vs useCallback patterns)
- Order of wave execution within Phase 3
- Whether to use React.memo on FieldRow for rendering optimization
- Exact error display mechanism (inline vs status bar)

### Deferred Ideas (OUT OF SCOPE)

- Full library card population for @mention suggestions (Phase 4 alongside library CRUD)
- `src/services/mentionAutocomplete.js` — library card loading
- Any new features beyond the generation/editing parity items listed
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REACT-05 | Character create panel with concept input, POV selection, and generation controls | CreatePanel + MentionInput components; POV segmented control maps to `pov` arg in apiHandler.generateCharacter |
| REACT-06 | Character editor panel with editable fields, field locking, and evaluate/revise flow | CharacterEditor + FieldRow + EvalFeedback components; lockedFields Set in useGenerationStore |
| STATE-02 | Zustand store manages current character data, parsed fields, and edit state | useGenerationStore: character, lockedFields, evalFeedback, reviseInstruction fields |
| STATE-03 | Zustand store manages generation status, streaming state, and progress | useGenerationStore: isGenerating, streamText, abortController fields |
| STREAM-01 | LLM responses stream in real-time to the UI during character generation | StreamView subscribes to useGenerationStore.streamText; getState().append(chunk) pattern |
| STREAM-02 | User can stop/cancel an in-progress generation | apiHandler.stopGeneration() already exists; ActionBar Stop button calls it + store.abort() |
| STREAM-03 | Streaming state updates don't cause stale closure bugs or excessive re-renders | getState().append() never captures stale state; component subscribes to slice only |
| LIB-01 | LLM response parsing uses standardized `## Section` format with clean parseSections() utility | src/utils/parseSections.js + prompt template normalization |
| LIB-02 | @mention autocomplete uses react-mentions (not Tribute.js CDN) | react-mentions 4.4.10 — not yet in package.json, must be added |
| PARITY-01 | All existing character generation modes (1st person, 3rd person, scenario) work | POV selector maps to `pov` param; buildCharacterPrompt already handles all three modes |
| PARITY-02 | Character evaluation and revision workflow works | apiHandler.evaluateCard + reviseCharacter already exist; need to wire into React flow |
| PARITY-07 | Content policy prefix toggle works | configStore.get('prompts.contentPolicyPrefix') — prepareMessages() in api.js already handles this; UI toggle in CreatePanel |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.4 | UI components | Already in package.json |
| zustand | 5.0.12 | Generation state store | Already in use (configStore); locked decision |
| react-mentions | 4.4.10 | @mention autocomplete in concept textarea | Locked decision (LIB-02); Tribute.js replacement |

### Already Installed (no action needed)

| Library | Version | Purpose |
|---------|---------|---------|
| react-dom | 19.2.4 | React DOM renderer |
| vite | 8.0.3 | Build system |
| @vitejs/plugin-react | 6.0.1 | JSX transform |

### Must Install

| Library | Version | Installation |
|---------|---------|-------------|
| react-mentions | 4.4.10 (latest) | `npm install react-mentions` |

react-mentions peer deps: react >=16.8.3, react-dom >=16.8.3 — both satisfied by react 19.2.4.

**Installation:**
```bash
npm install react-mentions
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-mentions | @mentions-view or custom | react-mentions is locked per LIB-02; custom Tribute.js wrapper was the old approach, explicitly replaced |
| Zustand getState().append() | useRef for accumulation | Ref approach works but doesn't trigger re-renders; store approach is the locked decision |

---

## Architecture Patterns

### Project Structure (additions in Phase 3)

```
src/
├── stores/
│   ├── configStore.js           # existing
│   └── useGenerationStore.js    # NEW — streaming + character state
├── utils/
│   └── parseSections.js         # NEW — section parser
├── services/
│   ├── api.js                   # existing — no changes to streaming logic
│   ├── characterGenerator.js    # updated — parseSections() replaces regex parsers
│   └── prompts.js               # updated — normalize section headers to ## format
└── components/
    ├── layout/
    │   └── ActionBar.jsx        # updated — wire Generate/Stop/Evaluate/Revise
    ├── create/
    │   ├── CreatePanel.jsx      # NEW
    │   ├── CreatePanel.module.css
    │   ├── MentionInput.jsx     # NEW
    │   └── MentionInput.module.css
    └── character/
        ├── CharacterEditor.jsx  # NEW
        ├── CharacterEditor.module.css
        ├── FieldRow.jsx         # NEW
        ├── FieldRow.module.css
        ├── StreamView.jsx       # NEW
        ├── StreamView.module.css
        ├── EvalFeedback.jsx     # NEW
        └── EvalFeedback.module.css
```

### Pattern 1: Zustand getState() for streaming callbacks

**What:** Service callbacks that fire many times per second use `getState().append()` instead of React state setters.
**When to use:** Any callback passed to a streaming API call — never pass `useState` setter or `useCallback` hook as the stream callback.
**Why:** React state setters passed as callbacks capture the value at closure creation time. When a new generation starts, the closure still holds the old `streamText` value. `getState()` reads from the Zustand store directly — always fresh.

```js
// CORRECT — getState() is always fresh
const handleGenerate = async () => {
  useGenerationStore.getState().reset();
  await apiHandler.generateCharacter(
    concept,
    characterName,
    (chunk) => { useGenerationStore.getState().append(chunk); },
    pov,
    lorebook
  );
};

// WRONG — stale closure risk
const [streamText, setStreamText] = useState('');
await apiHandler.generateCharacter(prompt, name, (chunk) => {
  setStreamText(prev => prev + chunk); // prev is stale after multiple fast chunks
});
```

Source: 03-CONTEXT.md decision §1; Zustand docs on `getState()` for non-React contexts.

### Pattern 2: Zustand slice subscription

**What:** Components subscribe only to the specific store slice they render from. Do not destructure the entire store.
**When to use:** All Phase 3 components.

```js
// CORRECT — StreamView only re-renders when streamText changes
const streamText = useGenerationStore((s) => s.streamText);
const isGenerating = useGenerationStore((s) => s.isGenerating);

// WRONG — causes re-render on any store update
const store = useGenerationStore();
```

Source: Zustand 5.x docs on selector subscriptions.

### Pattern 3: Right-panel conditional rendering

**What:** Right panel renders exactly one view based on store state.
**When to use:** App.jsx right panel wiring.

```jsx
// In App.jsx
const character = useGenerationStore((s) => s.character);
const isGenerating = useGenerationStore((s) => s.isGenerating);
const streamText = useGenerationStore((s) => s.streamText);

const rightPanel = character !== null
  ? <CharacterEditor />
  : (isGenerating || streamText !== '')
    ? <StreamView />
    : <EmptyEditorState />;
```

Matches UI-SPEC interaction states table exactly.

### Pattern 4: react-mentions integration

**What:** Wrap react-mentions `MentionsInput` / `Mention` in MentionInput.jsx with CSS Module overrides.
**When to use:** Concept textarea in CreatePanel.

```jsx
// Source: react-mentions 4.4.10 API
import { MentionsInput, Mention } from 'react-mentions';

export default function MentionInput({ value, onChange }) {
  return (
    <MentionsInput
      value={value}
      onChange={(e, newValue) => onChange(newValue)}
      className={styles.mentionInput}
      placeholder="Describe your character concept… (@ to mention a card from your library)"
    >
      <Mention
        trigger="@"
        data={[]}  // Phase 3: empty list — Phase 4 populates from library
        className={styles.mention}
      />
    </MentionsInput>
  );
}
```

Note: react-mentions injects inline styles for the textarea overlay. CSS Module classes are applied via `classNames` prop for container and suggestion styles. The `style` prop (not className) overrides the inner textarea styles — document this so FieldRow textarea CSS patterns are not mistakenly applied to MentionInput.

### Pattern 5: Auto-height textarea

**What:** Textareas grow with content using a useEffect + scrollHeight ref technique.
**When to use:** FieldRow textarea for each character field.

```js
// FieldRow.jsx
const ref = useRef(null);
useEffect(() => {
  if (ref.current) {
    ref.current.style.height = 'auto';
    ref.current.style.height = ref.current.scrollHeight + 'px';
  }
}, [value]);
```

This avoids a textarea resize library dependency.

### Pattern 6: CSS Modules + global class coexistence

**What:** Phase 2 established that global CSS classes from globals.css (`.btn-primary`, `.btn-outline`, `.textarea`, `.switch`, `.slider`) are used directly in JSX. CSS Module classes add component-specific layout.
**When to use:** All Phase 3 components — follow Phase 2 pattern exactly.

```jsx
// CORRECT — global class for btn style, CSS Module for layout
<button className={`btn-primary ${styles.generateBtn}`}>Generate Character</button>
<textarea className={`textarea ${styles.fieldTextarea}`} />
```

### Anti-Patterns to Avoid

- **Passing useState setter as onStream callback:** Stale closures cause dropped or duplicated chunks.
- **Subscribing to full Zustand store:** `useGenerationStore()` re-renders on every action — always use selectors.
- **Direct mutation of character object:** Use `setCharacter()` action with a new object — Zustand requires immutable updates.
- **Calling parseSections() on every chunk:** Only run after generation completes (`isGenerating` transitions false).
- **Using characterGenerator.js generateCharacter():** This service wraps api.js and also calls its own parse methods. For Phase 3, call `apiHandler.generateCharacter()` directly and run `parseSections()` in the store action or a generation handler. This avoids double-parsing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| @mention autocomplete | Custom dropdown + Tribute.js wrapper | react-mentions 4.4.10 | Locked decision LIB-02; handles positioning, keyboard nav, pill rendering |
| SSE parsing | Manual fetch + ReadableStream decoder | Existing `apiHandler.handleStreamResponse()` | Already handles chunk buffering, `[DONE]` sentinel, partial JSON recovery |
| Resizable split pane | CSS drag handler | Existing `react-resizable-panels` (Phase 2) | Already in package.json and working |
| Section parsing | Complex regex | `parseSections()` from `src/utils/parseSections.js` | Locked decision LIB-01 |
| Abort control | Custom cancellation | `apiHandler.stopGeneration()` + `useGenerationStore.abort()` | apiHandler already has `currentAbortController` and `currentReader` cancel logic |

**Key insight:** The service layer (api.js) is complete and handles all the difficult streaming plumbing. Phase 3 is almost entirely UI wiring work, not service work — except for prompt normalization and parseSections().

---

## Critical Implementation Details

### The reviseCharacter streaming discrepancy

**Finding:** The existing `apiHandler.reviseCharacter()` is NON-STREAMING — it sends `stream: false` and returns a parsed JSON object. The CONTEXT.md says "Streams back into streamText" which implies streaming.

**Current api.js behavior:** `reviseCharacter()` makes a non-streaming request, parses JSON from the response, and returns a structured character object. It does NOT call an `onStream` callback.

**Resolution options:**
1. Keep revise non-streaming (current behavior): after clicking Revise, show isGenerating=true with ProgressBar but no streaming text, then switch directly to CharacterEditor when JSON arrives. This is simpler and the revise prompt explicitly asks for JSON.
2. Add a streaming variant of reviseCharacter to api.js that streams and then parses the JSON from the accumulated text.

**Recommendation:** Option 1 (non-streaming revise). The revise prompt asks for strict JSON output — streaming raw JSON into StreamView is not useful to the user. Set `isGenerating=true`, hide StreamView, show ProgressBar, then on completion apply the result to non-locked fields. CONTEXT.md's "streams back into streamText" description is aspirational — the actual service is non-streaming and the plan should match the real behavior. Flag this discrepancy in the plan so the executor makes a deliberate choice.

### The parseSections() → prompt normalization coupling

The parseSections() utility is only useful if prompts actually emit `## Section Name` headers. The existing prompts use mixed formats:

- `generate_first_person`: Uses `# {{char}}'s Profile`, `## My Personality & What Drives Me`, `# The Roleplay's Setup`, `# First Message`, `# Example Messages`, `# Tags` — mix of `#` and `##`, inconsistent names
- `generate_third_person`: Same pattern as first_person with different labels
- `generate_scenario`: Already uses `## Description`, `## Personality`, `## Scenario`, `## First Message`, `## System Prompt`, `## Example Messages`, `## Tags`, `## Post-History Instructions` — closer to the target

**Work required:** Both `generate_first_person` and `generate_third_person` prompt templates must be updated to instruct the LLM to output `## Name`, `## Personality`, `## Description`, `## Scenario`, `## First Message`, `## Tags`, `## Message Example`, `## System Prompt` headers, replacing the current mixed `#`/`##` structure. This is a behavioral change in LLM output — LLMs may not comply perfectly, hence the `_raw` fallback.

### The lockedFields → reviseCharacter gap

`apiHandler.reviseCharacter(character, revisionInstruction)` accepts the full character and a revision instruction. It does NOT accept a locked-fields list. The caller must reconstruct a partial character object excluding locked fields before the call, then merge results back only into unlocked fields.

```js
// In generation handler (not in api.js)
const locked = useGenerationStore.getState().lockedFields;
const current = useGenerationStore.getState().character;

// Build character object with locked fields masked
const charForRevision = { ...current };
locked.forEach((field) => {
  charForRevision[field] = '[LOCKED - DO NOT MODIFY]';
});

const revised = await apiHandler.reviseCharacter(charForRevision, revisionInstruction);

// Merge only non-locked fields
const merged = { ...current };
Object.keys(revised).forEach((field) => {
  if (!locked.has(field)) {
    merged[field] = revised[field];
  }
});
useGenerationStore.getState().setCharacter(merged);
```

### Zustand 5.x Set type

Zustand 5.x state must be serializable for devtools. `lockedFields: new Set()` is not serializable. Two options:
1. Store lockedFields as a plain object `{}` or array `[]` — `{ name: true, personality: false }`
2. Store as Set but skip devtools

**Recommendation:** Use a plain object keyed by field name: `lockedFields: {}`. Toggle: `{ ...lockedFields, [field]: !lockedFields[field] }`. Check with `lockedFields[field]`. This is serializable and easier to inspect. The CONTEXT.md shows `Set()` — the plan should use the plain object approach and note the deviation.

### configStore.get('prompts.contentPolicyPrefix') — already wired in api.js

`prepareMessages()` in api.js already reads `configStore.get('prompts.contentPolicyPrefix')` and prepends the prefix to system messages. The UI toggle in CreatePanel just needs to call `configStore.set('prompts.contentPolicyPrefix', checked)` — no additional service work required.

---

## Common Pitfalls

### Pitfall 1: Stale closure in stream callback

**What goes wrong:** Tokens are dropped or the stream text doesn't accumulate correctly in the UI.
**Why it happens:** Developer passes `(chunk) => setStreamText(prev => prev + chunk)` — looks safe with the functional updater but React batches state updates under the hood. Under fast streaming, batched updates can race.
**How to avoid:** Always use `useGenerationStore.getState().append(chunk)` — Zustand `getState()` bypasses React's render cycle.
**Warning signs:** Stream text appears to reset mid-generation or skip chunks.

### Pitfall 2: parseSections() called on streaming chunks

**What goes wrong:** CharacterEditor shows up prematurely with partial field data during streaming.
**Why it happens:** Developer calls parseSections on each chunk to show "live" field population.
**How to avoid:** Only call parseSections after `isGenerating` transitions to `false`. StreamView shows raw text during generation; CharacterEditor shows after completion.

### Pitfall 3: react-mentions inline style conflicts

**What goes wrong:** react-mentions textarea looks wrong — wrong font, padding, background color — because its overlay technique uses inline styles that override CSS classes.
**Why it happens:** react-mentions renders a wrapper div with two layers: a highlights div and the actual textarea. It applies inline styles to both. CSS Module classes on the container apply to the wrapper but not to the inner textarea.
**How to avoid:** Pass `style` props directly to `MentionsInput` for textarea overrides. Use `classNames` prop for the suggestion dropdown. Test visually.
**Warning signs:** textarea has white background instead of --surface-strong, or wrong font-family.

### Pitfall 4: Zustand Set serialization

**What goes wrong:** Zustand devtools show `{}` for lockedFields instead of the actual Set.
**Why it happens:** Set is not JSON-serializable; Zustand's persist or devtools middleware may corrupt or drop it.
**How to avoid:** Use a plain object `{ fieldName: true/false }` for lockedFields. See Critical Implementation Details above.

### Pitfall 5: ActionBar state machine complexity

**What goes wrong:** Button states become inconsistent — e.g., both Generate and Stop visible, or Revise enabled when no character exists.
**Why it happens:** ActionBar wires to multiple independent state flags without a unified state machine.
**How to avoid:** Derive a single `uiPhase` variable from store state in ActionBar: `'idle' | 'generating' | 'has-character' | 'has-eval'`. All button show/hide/enable decisions branch on this one variable.

### Pitfall 6: Prompt template changes break LLM behavior

**What goes wrong:** After normalizing prompt headers to `## Section`, the LLM no longer generates the Name field or puts content in wrong sections.
**Why it happens:** Current prompts use extensive markdown scaffolding that guides the LLM. Changing section headers changes what the LLM follows.
**How to avoid:** Keep the full narrative template — only change the `##`-prefixed section markers, not the instructional prose. Add a `## Name` section explicitly at the top of the template since current prompts embed name in a `# Profile` header. Test against the real LLM after prompt changes.

### Pitfall 7: evalFeedback is JSON, not plain text

**What goes wrong:** EvalFeedback block shows raw JSON instead of readable evaluation.
**Why it happens:** `apiHandler.evaluateCard()` returns a parsed JavaScript object (scores, suggestions array, contradictions array) — not a human-readable string.
**How to avoid:** EvalFeedback component must format the object: display `overallScore`, render `dimensions` as a table or list, list `suggestions` as bullets. Do NOT pass the raw object directly to a text display.

---

## Code Examples

### useGenerationStore shape

```js
// src/stores/useGenerationStore.js
import { create } from 'zustand';

const useGenerationStore = create((set, get) => ({
  streamText: '',
  isGenerating: false,
  abortController: null,
  character: null,
  evalFeedback: null,       // object from evaluateCard(), not string
  reviseInstruction: '',
  lockedFields: {},         // { fieldKey: boolean } — NOT a Set

  append: (chunk) => set((s) => ({ streamText: s.streamText + chunk })),

  reset: () => set({
    streamText: '',
    isGenerating: false,
    character: null,
    evalFeedback: null,
    reviseInstruction: '',
  }),

  setGenerating: (flag, controller = null) => set({
    isGenerating: flag,
    abortController: controller,
  }),

  setCharacter: (char) => set({ character: char, isGenerating: false }),

  setEvalFeedback: (feedback) => set({
    evalFeedback: feedback,
    reviseInstruction: feedback?.suggestions?.join('\n') ?? '',
  }),

  toggleLock: (field) => set((s) => ({
    lockedFields: { ...s.lockedFields, [field]: !s.lockedFields[field] },
  })),

  abort: () => {
    const { abortController } = get();
    if (abortController) abortController.abort();
    set({ isGenerating: false, abortController: null });
  },
}));

export default useGenerationStore;
```

### StreamView auto-scroll

```jsx
// src/components/character/StreamView.jsx
import { useRef, useEffect } from 'react';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './StreamView.module.css';

export default function StreamView() {
  const streamText = useGenerationStore((s) => s.streamText);
  const containerRef = useRef(null);
  const userScrolledUp = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || userScrolledUp.current) return;
    el.scrollTop = el.scrollHeight;
  }, [streamText]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    userScrolledUp.current = el.scrollTop < el.scrollHeight - el.clientHeight - 50;
  }

  return (
    <pre
      ref={containerRef}
      className={styles.streamBox}
      onScroll={handleScroll}
    >
      {streamText || <span className={styles.placeholder}>Waiting for generation to start…</span>}
    </pre>
  );
}
```

### react-mentions basic setup

```jsx
// src/components/create/MentionInput.jsx
import { MentionsInput, Mention } from 'react-mentions';
import styles from './MentionInput.module.css';

export default function MentionInput({ value, onChange }) {
  return (
    <MentionsInput
      value={value}
      onChange={(e, newValue) => onChange(newValue)}
      placeholder="Describe your character concept… (@ to mention a card from your library)"
      classNames={styles}  // maps to .mentionInput__control, .mentionInput__suggestions, etc.
    >
      <Mention
        trigger="@"
        data={[]}   // Phase 3 skeleton — Phase 4 populates from library API
        className={styles.mention}
      />
    </MentionsInput>
  );
}
```

react-mentions `classNames` prop maps keys to CSS Module class names using its own naming convention. Key class names: `control`, `input`, `suggestions`, `suggestions__list`, `suggestions__item`, `suggestions__item--focused`.

### FieldRow component

```jsx
// src/components/character/FieldRow.jsx
import { useRef, useEffect } from 'react';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './FieldRow.module.css';

export default function FieldRow({ fieldKey, label, value, onChange }) {
  const lockedFields = useGenerationStore((s) => s.lockedFields);
  const toggleLock = useGenerationStore((s) => s.toggleLock);
  const isLocked = !!lockedFields[fieldKey];
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <div className={styles.row}>
      <div className={styles.header}>
        <label className={styles.label}>{label}</label>
        <button
          className={`${styles.lockBtn} ${isLocked ? styles.locked : ''}`}
          onClick={() => toggleLock(fieldKey)}
          title={isLocked ? 'Unlock field' : 'Lock field (preserve during revise)'}
        >
          {'\uD83D\uDD12'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className={`textarea ${styles.textarea} ${isLocked ? styles.lockedTextarea : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLocked}
      />
    </div>
  );
}
```

### Generation handler (in CreatePanel or a custom hook)

```js
async function handleGenerate() {
  const concept = ...; // from local state
  if (!concept.trim()) { /* show inline error */ return; }

  const store = useGenerationStore.getState();
  store.reset();
  store.setGenerating(true, new AbortController());

  try {
    await apiHandler.generateCharacter(
      concept,
      characterName,
      (chunk) => { useGenerationStore.getState().append(chunk); },
      pov,
      lorebook
    );
    const text = useGenerationStore.getState().streamText;
    const sections = parseSections(text);
    const character = sectionsToCharacter(sections, text); // map keys to character shape
    useGenerationStore.getState().setCharacter(character);
  } catch (err) {
    store.setGenerating(false, null);
    // show error
  }
}
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely frontend code changes. No external databases, CLI tools, or services beyond the existing Express proxy (already running) are needed. The Express proxy on port 2426 is a dev dependency already established in Phase 1.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Tribute.js CDN for @mention | react-mentions npm package | No CDN dependency; React-native integration; Phase 3 adds it |
| Regex-based section parsing (parseCharacterData) | parseSections() uniform ## split | Simpler, predictable, requires prompt normalization |
| window.characterGenerator singleton | ES module + Zustand store | Service is already converted; store is new in Phase 3 |
| Streaming into innerHTML | Streaming into Zustand store → React render | No XSS risk; proper React update cycle |

**Zustand 5.x vs 4.x note:** The project uses Zustand 5.0.12. Zustand 5 removed the default export — `create` must be imported as a named export: `import { create } from 'zustand'`. The existing configStore.js already uses this pattern correctly. Follow it in useGenerationStore.

---

## Open Questions

1. **reviseCharacter streaming vs non-streaming**
   - What we know: existing `reviseCharacter()` in api.js is non-streaming, returns parsed JSON
   - What's unclear: CONTEXT.md implies streaming; the plan must decide which to implement
   - Recommendation: Use non-streaming (existing behavior) for Phase 3. Show isGenerating=true with ProgressBar, switch to CharacterEditor on completion. Add streaming variant in a future phase if desired.

2. **evalFeedback display format**
   - What we know: `evaluateCard()` returns a JSON object with scores, suggestions, contradictions
   - What's unclear: CONTEXT.md shows eval feedback as a "read-only scrollable text" block, but the data is structured
   - Recommendation: EvalFeedback component renders the object in a lightweight structured display (overall score, bullet suggestions). Pre-populate reviseInstruction from suggestions array joined with newlines.

3. **parseSections key mapping**
   - What we know: `parseSections()` returns `{ name, personality, description, ... }` keys from `## Name` headers
   - What's unclear: The character object uses camelCase (`firstMessage`) but `## First Message` would map to `first message` (with space)
   - Recommendation: Add a key normalization step in sectionsToCharacter(): `'first message' → firstMessage`, `'message example' → mesExample`, `'system prompt' → systemPrompt`. Document this mapping in the utility.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `src/services/api.js` — confirmed streaming API, stopGeneration(), evaluateCard(), reviseCharacter() signatures
- Direct code inspection: `src/services/characterGenerator.js` — confirmed current regex parsing that parseSections() replaces
- Direct code inspection: `src/services/prompts.js` — confirmed current non-uniform section headers across all three prompt templates
- Direct code inspection: `src/stores/configStore.js` — confirmed Zustand 5 `create` named import pattern
- Direct code inspection: `package.json` — confirmed react 19.2.4, zustand 5.0.12, react-mentions NOT present
- `npm view react-mentions version` — confirmed 4.4.10 current, peer deps react >=16.8.3
- `.planning/phases/03-generation-editing/03-CONTEXT.md` — locked decisions
- `.planning/phases/03-generation-editing/03-UI-SPEC.md` — visual and interaction contract

### Secondary (MEDIUM confidence)

- react-mentions 4.4.10 `classNames` prop API — from package description and known v4 API; not verified against official docs in this session (react-mentions docs are minimal)

### Tertiary (LOW confidence)

- None

---

## Project Constraints (from CLAUDE.md)

| Directive | Research Compliance |
|-----------|-------------------|
| Feature parity — no regressions | All three POV modes preserved; evaluate/revise wired |
| Backend unchanged — Express proxy stays CommonJS | No backend changes in Phase 3 |
| No new features | Phase 3 only wires existing service capabilities into React UI |
| CSS naming: lowercase with hyphens for classes/IDs | CSS Modules enforce scoping; global classes follow existing pattern |
| JS naming: PascalCase components, camelCase methods | Component names in this plan comply |
| File naming: lowercase with hyphens | Component files use PascalCase (React convention) — existing Phase 2 components use PascalCase (ActionBar.jsx, SplitPane.jsx). This is an apparent exception to CLAUDE.md's hyphen rule that was established in Phase 2. Follow Phase 2 precedent. |
| async/await throughout, no raw Promises | All generation handlers use async/await |
| CSS Modules per component | All new components have paired .module.css files |
| No TypeScript | All files are .jsx or .js |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and code inspection
- Architecture patterns: HIGH — derived from locked CONTEXT.md decisions and existing code patterns
- Pitfalls: HIGH — identified from direct code reading (revise is non-streaming, eval returns JSON object, react-mentions style override behavior)
- Open questions: MEDIUM — real implementation decisions needed

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable stack, no fast-moving dependencies)
