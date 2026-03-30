# Phase 4: Export, Library + Full Parity - Research

**Researched:** 2026-03-30
**Domain:** React UI wiring for image generation, PNG export, library management, SillyTavern sync, lorebook editor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** CharacterEditor adopts two-section RPG sheet layout. Header: two-column (left ~70-75%: Name/Tags/CreatorNotes/buttons; right ~25-30%: portrait slot). Body: full-width large fields. EvalFeedback remains below body.
- **D-02:** "Advanced Settings" collapsible at bottom. System Prompt lives there by default.
- **D-03:** Image slot always visible in top-right of header section. Placeholder before generation.
- **D-04:** Upload and (Re)generate buttons in left column, not inside image frame. Always visible.
- **D-05:** After image generation, image fills slot immediately. No confirm step.
- **D-06:** Save, Download JSON, Download PNG are independent buttons in ActionBar.
- **D-07:** Save = storageClient.saveCard(). Download JSON = export JSON only. Download PNG = pngEncoder.createCharacterCard() with current image or blank PNG.
- **D-08:** Export buttons only active when character != null && !isStreaming.
- **D-09:** Cards-only library. No prompt template UI.
- **D-10:** Card list: search input at top (filters name + tags), each row shows name, last-updated date, visible tags (as many as fit), qualityScore badge if present.
- **D-11:** Clicking a card loads it into CharacterEditor. If unsaved changes exist, prompt "Discard current character?" before loading.
- **D-12:** Each card row has a History button. Opens modal showing git commit list. User selects two commits to diff → field-by-field diff view.
- **D-13:** Lorebook editor in a separate tab in the right panel — "Lorebook" tab alongside character output. Tab only active/visible when character exists.
- **D-14:** Lorebook tab: Generate button at top, Add Entry button, then entry list.
- **D-15:** Entry list uses expandable rows — collapsed shows key summary, click to expand inline showing all fields.
- **D-16:** Per-entry fields: Keys (comma-separated), Content, Comment, Priority, enabled toggle, lock button.
- **D-17:** Generate Lorebook calls api.generateLorebook(character). Replaces all unlocked entries. Locked entries preserved. If entries exist, prompts confirmation before replacing. Same Zustand lock pattern as character fields.
- **D-18:** Lorebook state lives in useGenerationStore or a sibling useLorebook store — Claude's discretion based on store size.
- **D-19:** MentionInput populates @mention suggestions with saved card names from storageClient.listCards(). Cards load on mount (or when drawer first opens).
- **D-20:** SillyTavern sync in Settings modal. "SillyTavern" section with: ST URL field, List Characters button, push/pull from character select.

### Claude's Discretion

- Exact field grouping in "Advanced Settings" collapsible
- Whether lorebook state goes in useGenerationStore or a sibling store
- Animation/transition for drawer open/close
- Empty state designs (no cards in library, no lorebook entries)
- Loading states for image generation and lorebook generation
- Tag display truncation strategy in card list rows

### Deferred Ideas (OUT OF SCOPE)

- Prompt template library UI (storageClient has methods but no UI needed in Phase 4)
- LIB-05: PNG metadata encoder replacement with png-chunks library (deferred to v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REACT-07 | Library drawer with card listing, search, CRUD operations | storageClient CRUD fully implemented; backend endpoints documented; globals.css has drawer shell |
| REACT-08 | Lorebook editor with entry CRUD, generation, toggle controls | api.generateLorebook/extractLorebook fully implemented; lorebook entry structure documented below |
| REACT-09 | SillyTavern sync UI (push/pull/character list) as React components | proxy endpoints /api/st/characters, /api/st/push, /api/st/pull fully implemented; request shapes documented |
| REACT-11 | Card download (JSON + PNG with embedded metadata) working from React UI | pngEncoder.createCharacterCard() fully implemented; download via anchor click pattern documented |
| REACT-12 | Card diff/history view working from React UI | /api/cards/:slug/history and /api/cards/:slug/diff/:a/:b fully implemented; response shapes documented |
| STATE-04 | Zustand store manages library browsing state (cards, selection) | New useLibraryStore or extension of useGenerationStore — research documents both options |
| PARITY-03 | Image generation (OpenAI-compatible + SD API) works | imageGenerator.generateCharacterImage() fully implemented; React hook wrapper pattern documented |
| PARITY-04 | V2 character card PNG export with embedded metadata works | pngEncoder.createCharacterCard(imageBlob, characterData) fully implemented; blank PNG fallback documented |
| PARITY-05 | Git-backed card/prompt library with CRUD, history, diff works | All backend routes exist and verified; storageClient wraps them; diff response shape documented |
| PARITY-06 | SillyTavern push/pull sync works | Backend endpoints verified; header-based auth (X-ST-URL, X-ST-Password) documented |
| PARITY-08 | Configurable API settings with session/persistent key storage works | configStore already complete; ST URL/password already wired; only UI surface needed |
| PARITY-09 | Lorebook generation and CRUD works | api.generateLorebook() returns normalized entry array; entry shape documented |
</phase_requirements>

---

## Summary

Phase 4 is almost entirely React UI work. All backend endpoints and service-layer implementations are verified complete. The work is wiring existing services to new React components, restructuring CharacterEditor, and extending Zustand stores.

The key complexity areas are: (1) restructuring CharacterEditor to the RPG sheet layout while adding the Lorebook subtab, (2) building the LibraryDrawer with history/diff modal, and (3) managing the image blob lifecycle from generation → display → PNG export. The lorebook state design (sibling store vs extension) needs a decision before planning, and this research recommends a sibling `useLorebookStore` to keep `useGenerationStore` lean.

State management for the library drawer is entirely new — `useLibraryStore` for cards[], isLoading, search query, and selection is the right pattern. SillyTavern sync in Settings modal is low-complexity because the configStore already holds ST URL/password and the proxy endpoints are fully implemented.

**Primary recommendation:** Plan around 6 independent deliverables (CharacterEditor restructure, ImageSlot, ActionBar export buttons, LibraryDrawer, LorebookTab, SillyTavernSection) that can be verified separately before integration.

---

## Standard Stack

### Core (already installed — no new dependencies required)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| react | 19.x | Component rendering | Already installed |
| zustand | 5.x | State management | Already installed, pattern established |
| CSS Modules | native Vite | Scoped component styles | Pattern established in Phases 2-3 |

### No New Dependencies

Phase 4 adds zero new npm dependencies. Every library needed is already installed:
- Image generation: `imageGenerator` service (already in `src/services/`)
- PNG export: `pngEncoder` service (already in `src/services/`) — hand-rolled, no external libs
- Storage: `storageClient` service (already in `src/services/storage.js`)
- Diff display: `diff` package already installed from Phase 1 (LIB-03 completed)
- ST sync: fetch to existing proxy endpoints

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── components/
│   ├── character/
│   │   ├── CharacterEditor.jsx       (MODIFY: RPG layout + lorebook subtab)
│   │   └── ImageSlot.jsx             (NEW)
│   ├── library/
│   │   ├── LibraryDrawer.jsx         (NEW)
│   │   ├── CardListItem.jsx          (NEW)
│   │   ├── CardHistoryModal.jsx      (NEW)
│   │   └── DiffView.jsx              (NEW)
│   ├── lorebook/
│   │   ├── LorebookTab.jsx           (NEW)
│   │   └── LorebookEntryRow.jsx      (NEW)
│   └── settings/
│       └── SillyTavernSection.jsx    (NEW)
├── stores/
│   └── useLorebookStore.js           (NEW — recommended)
```

### Pattern 1: Image Blob Lifecycle

The image state must persist a blob URL for display and a blob for PNG export. The lifecycle is:

1. User triggers generation → `imageGenerator.generateCharacterImage(description, name)` returns a URL (may be remote, blob:, or data:)
2. `imageGenerator.convertToBlob(url)` converts to blob → store blob in state
3. `URL.createObjectURL(blob)` creates display URL → store display URL in state
4. On unmount or new generation → `URL.revokeObjectURL(displayUrl)` to prevent memory leak
5. For PNG export: `pngEncoder.createCharacterCard(imageBlob, character)` → download

**Key insight from imageGenerator.js:** `generateCharacterImage()` returns the raw URL. The `generateAndDisplayImage()` method does DOM manipulation (container.innerHTML) — do NOT use it in React. Instead, call `generateCharacterImage()` and then `convertToBlob()` manually.

For a blank PNG export (no image): create a minimal 1×1 white PNG blob. The pngEncoder.createCharacterCard() only needs a valid Blob; any PNG blob works.

```javascript
// Pattern for blank PNG export
async function createBlankPng() {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 400;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 400, 400);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
```

### Pattern 2: Lorebook Entry Shape (verified from api.js)

The `api.generateLorebook()` returns an array of entries parsed from `parseLorebookResponse()`. The normalized shape is:

```javascript
// Entry shape (SillyTavern V2 characterBook.entries spec)
{
  keys: ['keyword1', 'keyword2'],  // array of strings
  content: 'Entry text...',
  comment: 'Internal note',
  priority: 10,                    // insertion priority number
  enabled: true,                   // boolean toggle
  name: 'Entry display name',      // optional, derived from keys[0]
  constant: false,                 // constant injection regardless of trigger
}
```

**Lorebook state location decision:** Recommend `useLorebookStore` as a sibling store. Reasons: (1) `useGenerationStore` is already 80+ lines with 10+ actions; adding 6+ lorebook actions would push it past maintainable size. (2) Lorebook state is orthogonal to character generation/streaming state — no cross-cutting subscriptions needed. (3) The lock pattern can be replicated in useLorebookStore without coupling.

```javascript
// useLorebookStore recommended shape
{
  entries: [],                    // LorebookEntry[]
  lockedEntries: {},              // { entryIndex: boolean } — same pattern as lockedFields
  isGenerating: false,
  // actions: setEntries, addEntry, updateEntry, deleteEntry, toggleEntryLock, setGenerating
}
```

### Pattern 3: Library Drawer State (STATE-04)

New `useLibraryStore` (separate from generation store). The library is read-only from a generation perspective — it has its own loading/search/selection state:

```javascript
// useLibraryStore shape
{
  cards: [],                      // CardSummary[] from storageClient.listCards()
  isLoading: false,
  searchQuery: '',
  isOpen: false,
  // actions: fetchCards, setSearchQuery, setIsOpen
}
```

The `isOpen` flag can live in useLibraryStore or be passed down from App.jsx via props (existing pattern: Header.jsx already receives `onLibraryToggle`). Either works; storing in useLibraryStore avoids prop drilling.

Filtered cards are derived synchronously: `cards.filter(c => c.characterName.toLowerCase().includes(searchQuery.toLowerCase()))` — no async needed.

### Pattern 4: SillyTavern API Request Shape (verified from proxy/server.js)

```javascript
// List characters
POST /api/st/characters
Headers: { 'X-ST-URL': stUrl, 'X-ST-Password': stPassword }
Body: {}
Response: ST characters array

// Push character (with PNG image)
POST /api/st/push
Headers: { 'X-ST-URL': stUrl, 'X-ST-Password': stPassword }
Body: { imageBase64: string, fileName: string }
// imageBase64 is base64-encoded PNG with character metadata embedded

// Push character (no image)
POST /api/st/push
Body: { characterJson: object, fileName: string }

// Pull character
POST /api/st/pull
Headers: { 'X-ST-URL': stUrl, 'X-ST-Password': stPassword }
Body: { avatar_url: string }  // from ST character list response
Response: character JSON object
```

The configStore already has `api.sillytavern.url` and `api.sillytavern.password` wired and persisted. `SillyTavernSection` reads these from the draft object in SettingsModal.

**ST Push flow:** To push with PNG, the component must: (1) get the current image blob from state, (2) call `pngEncoder.createCharacterCard(imageBlob, character)`, (3) convert blob to base64, (4) POST to /api/st/push with imageBase64. If no image, send characterJson directly.

```javascript
// Base64 encoding for ST push
async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
```

### Pattern 5: Card History/Diff API Shape (verified from proxy/cards.js)

```javascript
// GET /api/cards/:slug/history response
[
  { hash: 'abc123', timestamp: '2026-03-29T...', message: 'Save Aria', steeringInput: 'Aria' },
  ...
]

// GET /api/cards/:slug/diff/:commitA/:commitB response
{
  commitA: 'abc123',
  commitB: 'def456',
  diff: {
    name:         { before: 'Aria', after: 'Aria V2' },
    description:  { before: '...', after: '...' },
    // only changed fields appear; unchanged fields omitted
    // fields: name, description, personality, scenario, firstMessage, mes_example
  }
}
```

DiffView component renders each key in `diff` as a before/after comparison. The `diff` package (already installed from LIB-03) can produce word-level diffs if desired, but a simple before/after two-column display satisfies the requirement.

### Pattern 6: PNG Download (verified from pngEncoder.js)

```javascript
// Download trigger pattern (already in pngEncoder.downloadCharacterCard)
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
```

The React Download PNG button handler calls `pngEncoder.createCharacterCard(imageBlob, character)` then triggers download. pngEncoder is already an ES module singleton (`export const pngEncoder = new PNGEncoder()`).

### Pattern 7: Unsaved Changes Detection (D-11)

The store needs a `isDirty` boolean that becomes true after generation or field edit, and false after saveCard(). This can be added to useGenerationStore as a simple boolean:

```javascript
// In useGenerationStore — add:
isDirty: false,
setDirty: (flag) => set({ isDirty: flag }),
// Set to true in setCharacter(), updateField()
// Set to false after successful storageClient.saveCard()
```

### Anti-Patterns to Avoid

- **Using `imageGenerator.generateAndDisplayImage()`:** This method mutates `container.innerHTML` — it is the vanilla JS DOM pattern. In React, call `imageGenerator.generateCharacterImage()` and `imageGenerator.convertToBlob()` directly.
- **Storing display blob URLs in Zustand without cleanup:** Always revoke object URLs on unmount via `useEffect` cleanup or on new image generation. Failure to do so leaks memory.
- **Calling `api.generateLorebook()` inside a streaming context:** `generateLorebook()` uses `handleStreamResponse` internally with an empty `onStream` callback. It resolves to the full response, not a stream. Do not treat it as streaming for UI purposes.
- **btoa() on non-Latin-1 strings:** The pngEncoder uses `btoa(String.fromCharCode(...characterJsonBytes))` where `characterJsonBytes` is a `Uint8Array`. This pattern is correct. Do not call `btoa()` directly on a UTF-8 string containing characters above U+00FF.
- **Forgetting to strip the `diff` npm package import collision:** `import { diffLines } from 'diff'` — the package is named `diff`, not `diff-js`. It is already in package.json from Phase 1.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG V2 metadata injection | Custom PNG chunk writer | `pngEncoder.createCharacterCard()` | Already handles IEND positioning, CRC32, tEXt chunk, existing chunk removal, fallback to canvas recreation |
| Image blob→base64 | Custom FileReader logic | `blobToDataUrl()` from storage.js or `blobToBase64()` helper | Edge cases around large images |
| Card slug generation | Custom string normalization | `slugifyName()` from storage.js | Already handles edge cases, used by server |
| ST CSRF token handling | Client-side CSRF management | Proxy handles it (server.js `getSTCsrfToken`) | ST requires server-side CSRF acquisition |

**Key insight:** The proxy is the ST integration boundary. The React UI never talks to ST directly — only via `/api/st/*` endpoints that handle authentication and CSRF internally.

---

## Common Pitfalls

### Pitfall 1: Image blob URL revocation timing
**What goes wrong:** Calling `URL.revokeObjectURL(displayUrl)` too early causes a broken `<img>` — the blob is freed while the image is still displayed.
**Why it happens:** Blob URLs are only safe to revoke after the browser has decoded the image data (not just set `img.src`).
**How to avoid:** Only revoke in `useEffect` cleanup (when component unmounts or when a new image replaces it), never immediately after creation.
**Warning signs:** `<img>` tag shows broken image icon despite URL being set.

### Pitfall 2: Stale card list after save/delete
**What goes wrong:** User saves or deletes a card, but the library drawer shows the old list.
**Why it happens:** `useLibraryStore.cards` is fetched once on mount and not invalidated.
**How to avoid:** Call `fetchCards()` after successful save and delete operations. Pass an `onSuccess` callback or use a store action that chains fetch.

### Pitfall 3: CharacterEditor field key mismatch with storageClient
**What goes wrong:** `storageClient.saveCard()` saves the character object with the camelCase keys from `useGenerationStore` (e.g. `firstMessage`, `mesExample`), but the diff endpoint in cards.js compares `mes_example` (snake_case). The diff will never show changes to mesExample.
**Why it happens:** `proxy/cards.js` diff route (line 289-296) compares `mes_example` but the React store uses `mesExample`.
**How to avoid:** In DiffView, map `mes_example` → `mesExample` for display consistency. Accept that the diff endpoint may miss this field — it is a pre-existing backend limitation.
**Warning signs:** Diff modal shows no changes to Message Example field even when the text differs.

### Pitfall 4: SettingsModal draft pattern for SillyTavernSection
**What goes wrong:** SillyTavernSection reads from draft (passed from SettingsModal) but the "List Characters" button needs to make a live API call with the potentially unsaved draft URL.
**Why it happens:** Draft values are not in the store until Save is clicked.
**How to avoid:** Pass draft values directly to the ST API calls within the Settings modal context. `List Characters` should use `draft.api.sillytavern.url` and `draft.api.sillytavern.password`, not `configStore.get(...)`.

### Pitfall 5: Lorebook generation during existing entries — replace vs merge
**What goes wrong:** `api.generateLorebook()` returns a completely new array — it does not merge with existing entries. If the component calls it without checking for existing unlocked entries, users lose their work silently.
**Why it happens:** `generateLorebook()` signature accepts `existingEntries` but returns all-new entries based on the character context.
**How to avoid:** Before calling `generateLorebook()`, check `useLorebookStore.getState().entries.some(e => !lockedEntries[index])`. If unlocked entries exist, show confirmation dialog (D-17). Pass current unlocked entries as context to generateLorebook for better coherence.

### Pitfall 6: Missing `isDirty` flag for unsaved change detection (D-11)
**What goes wrong:** Without tracking dirty state, the "Discard changes?" prompt either never shows or always shows.
**Why it happens:** `useGenerationStore` does not currently have `isDirty` state.
**How to avoid:** Add `isDirty` to `useGenerationStore` — set to `true` in `setCharacter()` and `updateField()`, reset to `false` after successful `storageClient.saveCard()`.

---

## Code Examples

### ImageSlot — generation trigger and state pattern

```javascript
// src/components/character/ImageSlot.jsx pattern
// Source: imageGenerator.js + React hooks pattern

// State in parent (CharacterEditor) or useImageStore:
const [imageBlob, setImageBlob] = useState(null);
const [imageDisplayUrl, setImageDisplayUrl] = useState(null);
const [isGenerating, setIsGenerating] = useState(false);

// Cleanup blob URL on unmount or replacement
useEffect(() => {
  return () => {
    if (imageDisplayUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imageDisplayUrl);
    }
  };
}, [imageDisplayUrl]);

async function handleGenerate() {
  setIsGenerating(true);
  try {
    const url = await imageGenerator.generateCharacterImage(
      character.description, character.name
    );
    const blob = await imageGenerator.convertToBlob(url);
    const displayUrl = URL.createObjectURL(blob);
    // Revoke old display URL before setting new one
    if (imageDisplayUrl?.startsWith('blob:')) URL.revokeObjectURL(imageDisplayUrl);
    setImageBlob(blob);
    setImageDisplayUrl(displayUrl);
  } catch (err) {
    // Show error state in ImageSlot
  } finally {
    setIsGenerating(false);
  }
}

// Upload pattern
async function handleUpload(file) {
  imageGenerator.validateImageFile(file); // throws on invalid
  const displayUrl = URL.createObjectURL(file);
  if (imageDisplayUrl?.startsWith('blob:')) URL.revokeObjectURL(imageDisplayUrl);
  setImageBlob(file); // File is a Blob subtype — works with pngEncoder
  setImageDisplayUrl(displayUrl);
}
```

### ActionBar Save Card button

```javascript
// In ActionBar.jsx addition
const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

async function handleSave() {
  const { character } = useGenerationStore.getState();
  if (!character) return;
  setSaveStatus('saving');
  try {
    await storageClient.saveCard({
      characterName: character.name,
      character,
      imageBlob: /* from image state */,
    });
    useGenerationStore.getState().setDirty(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500); // "Saved" transient label per UI spec
  } catch (err) {
    setSaveStatus('error');
  }
}
```

### LibraryDrawer loading card with dirty check (D-11)

```javascript
async function handleCardClick(slug) {
  const isDirty = useGenerationStore.getState().isDirty;
  if (isDirty) {
    // Show confirmation modal: "Discard Changes?"
    // If confirmed: proceed; if cancelled: return
  }
  const result = await storageClient.getCard(slug);
  if (result) {
    useGenerationStore.getState().setCharacter(result.character);
    // Also set avatarUrl into image state if result.avatarUrl exists
  }
}
```

### LorebookTab — generate with lock preservation

```javascript
async function handleGenerateLorebook() {
  const entries = useLorebookStore.getState().entries;
  const locked = useLorebookStore.getState().lockedEntries;
  const lockedEntries = entries.filter((_, i) => locked[i]);
  const hasUnlocked = entries.some((_, i) => !locked[i]);

  if (entries.length > 0 && hasUnlocked) {
    // Show confirmation: "Replace Lorebook?" per UI spec D-17
    // Proceed only if confirmed
  }

  useLorebookStore.getState().setGenerating(true);
  try {
    const newEntries = await apiHandler.generateLorebook(
      character,
      entries, // pass all entries so AI can avoid inconsistencies
    );
    // Merge: preserve locked entries, replace unlocked
    const merged = entries.map((old, i) => locked[i] ? old : newEntries[i]).filter(Boolean);
    // Append any extra new entries beyond existing count
    const extras = newEntries.slice(entries.length);
    useLorebookStore.getState().setEntries([...merged, ...extras]);
  } finally {
    useLorebookStore.getState().setGenerating(false);
  }
}
```

### Download PNG button

```javascript
async function handleDownloadPng() {
  const { character } = useGenerationStore.getState();
  let blob = imageBlob; // from image state
  if (!blob) {
    blob = await createBlankPng(); // canvas-based 400x400 white PNG
  }
  const pngBlob = await pngEncoder.createCharacterCard(blob, character);
  pngEncoder.downloadCharacterCard(pngBlob, character.name || 'character');
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| imageGenerator.generateAndDisplayImage() with DOM container | Call generateCharacterImage() + convertToBlob() + React state | DOM pattern not usable in React |
| window.characterStorage singleton | ES module storageClient singleton imported directly | Already migrated in Phase 1 |
| window.pngEncoder singleton | ES module pngEncoder singleton | Already migrated in Phase 1 |
| Tribute.js mention autocomplete | react-mentions already installed (Phase 3) | MentionInput.jsx exists with empty data=[] — Phase 4 wires storageClient.listCards() into it |

**Deprecated/outdated:**
- `imageGenerator.generateAndDisplayImage()`: DOM manipulation — do not call from React components
- `imageGenerator.formatImageForDisplay()`: Returns innerHTML string — do not use in React
- `imageGenerator.displayLoadingState()` / `displayErrorState()`: DOM manipulation — replace with React state

---

## Open Questions

1. **Image state location: where does imageBlob live?**
   - What we know: CharacterEditor restructure is in scope. ActionBar needs imageBlob for PNG export. Multiple components need it.
   - What's unclear: Should imageBlob go in `useGenerationStore` (co-located with character), or in `useLorebookStore` sibling (no, wrong domain), or its own `useImageStore`, or React `useState` passed as props?
   - Recommendation: Add `imageBlob`, `imageDisplayUrl`, `isImageGenerating` to `useGenerationStore`. They are tightly coupled to the character lifecycle (resetting with the character, exported with the card). This keeps all per-character state in one store. The planner should make this decision explicit.

2. **PARITY-08 scope clarification**
   - What we know: PARITY-08 says "Configurable API settings with session/persistent key storage works." The configStore already handles all of this. SettingsModal already has text/image API sections.
   - What's unclear: Does PARITY-08 require any new UI, or is it already satisfied by Phase 2 work?
   - Recommendation: PARITY-08 is satisfied if SettingsModal is fully functional. The SillyTavernSection (D-20) covers the remaining gap (ST URL not yet in Settings UI). Plan tasks should make the ST URL/password fields part of a new Settings section tab.

3. **`mes_example` vs `mesExample` in diff endpoint**
   - What we know: The diff endpoint in proxy/cards.js compares `mes_example` (snake_case, line 296). The character store and CharacterEditor use `mesExample` (camelCase).
   - What's unclear: Whether this pre-existing mismatch causes a visible regression in the diff view.
   - Recommendation: DiffView should display all diff keys using human-readable labels, mapping snake_case backend keys to display names. Accept that `mesExample` changes may not appear in diffs — document as a known limitation.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is pure frontend React component work. All external dependencies (Node.js, npm, Vite dev server, Express proxy) were validated in prior phases. No new external tools required.

---

## Component Inventory Cross-Reference

New components and what they depend on:

| Component | Depends On | Key Interaction |
|-----------|------------|-----------------|
| `ImageSlot.jsx` | imageGenerator service | generateCharacterImage, convertToBlob |
| `LibraryDrawer.jsx` | useLibraryStore (NEW), storageClient | fetchCards, getCard, deleteCard |
| `CardListItem.jsx` | Props from LibraryDrawer | onClick load, onHistory click, onDelete click |
| `CardHistoryModal.jsx` | Modal.jsx, fetch /api/cards/:slug/history + diff | GET history, GET diff |
| `DiffView.jsx` | diff package (already installed) | diffWords() for inline highlights |
| `LorebookTab.jsx` | useLorebookStore (NEW), apiHandler | generateLorebook() |
| `LorebookEntryRow.jsx` | useLorebookStore | entry CRUD, toggleEntryLock |
| `SillyTavernSection.jsx` | SettingsModal draft pattern, fetch /api/st/* | list, push, pull |

Modified components:

| Component | Changes Needed |
|-----------|---------------|
| `CharacterEditor.jsx` | RPG sheet layout (D-01/D-02), add Lorebook subtab (D-13) |
| `ActionBar.jsx` | Add Save Card, Download JSON, Download PNG buttons (D-06/D-07/D-08) |
| `MentionInput.jsx` | Wire storageClient.listCards() into data prop (D-19) |
| `SettingsModal.jsx` | Add SillyTavernSection component (D-20) |
| `useGenerationStore.js` | Add isDirty, imageBlob, imageDisplayUrl, isImageGenerating (if image state goes here) |

---

## Sources

### Primary (HIGH confidence — direct source code inspection)
- `/src/services/imageGenerator.js` — All method signatures, return types, DOM methods to avoid in React
- `/src/services/pngEncoder.js` — createCharacterCard(), downloadCharacterCard(), blank PNG fallback strategy
- `/src/services/storage.js` — storageClient CRUD shapes, slugifyName, blobToDataUrl exports
- `/src/services/api.js` — generateLorebook(), extractLorebook() return shapes, parseLorebookResponse(), generateImage()
- `/proxy/cards.js` — All REST endpoint shapes and response formats for history and diff
- `/proxy/server.js` — ST proxy endpoints, request headers (X-ST-URL, X-ST-Password), push/pull body shapes
- `/src/stores/useGenerationStore.js` — Current store shape, locked pattern, setCharacter action
- `/src/stores/configStore.js` — api.sillytavern shape, sensitive value persistence
- `/src/components/*` — All existing component interfaces, ActionBar.deriveUiPhase(), Modal.jsx props

### Secondary (HIGH confidence — official docs verified)
- CSS custom properties in `/src/styles/globals.css` — library-drawer shell, .library-* classes, dark theme overrides confirmed present and usable

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries required; all services are hand-rolled ES modules verified by direct source inspection
- Architecture: HIGH — service signatures, endpoint shapes, and component patterns all verified from source
- Pitfalls: HIGH — identified from code inspection of known mismatches (mes_example vs mesExample) and API behavior (generateAndDisplayImage is DOM-only)
- State design: MEDIUM — recommendations for useLorebookStore and image state location in useGenerationStore are well-reasoned but represent planning decisions

**Research date:** 2026-03-30
**Valid until:** This project has no external package dependencies in Phase 4 — findings are stable indefinitely relative to the codebase.
