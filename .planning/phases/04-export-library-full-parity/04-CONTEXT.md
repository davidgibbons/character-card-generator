# Phase 4: Export, Library + Full Parity - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement all remaining features to achieve full feature parity with the original vanilla JS app:
image generation display, PNG/JSON export, card library CRUD with history/diff, SillyTavern push/pull sync, lorebook editor, and @mention autocomplete card population.

The backend is already fully implemented for all of these (imageGenerator.js, pngEncoder.js, storageClient, api.generateLorebook/extractLorebook, proxy ST endpoints). Phase 4 is almost entirely React UI work wired to existing services.

</domain>

<decisions>
## Implementation Decisions

### Character Editor Layout (RPG Character Sheet)

- **D-01:** CharacterEditor adopts a two-section RPG character sheet layout:
  - **Header section (top):** Two-column layout. Left column (~70-75%): compact fields (Name, Tags, Creator Notes) + image upload/generate buttons. Right column (~25-30%): character portrait image placeholder/avatar.
  - **Body section (below):** Full-width large fields — Description, Personality, Scenario, First Message, Message Example, System Prompt.
  - The existing flat FieldRow list pattern is restructured into this two-section layout.

- **D-02:** "Advanced Settings" collapsible section at the bottom of CharacterEditor for less commonly edited fields (e.g. System Prompt, Creator Notes if not in header). Claude's discretion on exact fields to include there.

### Image Generation

- **D-03:** Image slot is always visible in CharacterEditor top-right. Before generation: shows a styled placeholder. Upload button and (Re)generate button live in the left column (compact fields area), not inside the image frame.
- **D-04:** Upload button allows file upload (user supplies their own image). Generate/Regenerate button triggers imageGenerator.generateCharacterImage(). Both buttons are always visible in the header section when CharacterEditor is shown.
- **D-05:** After image generation, the image fills the portrait slot. No separate confirm step.

### Export (Save / Download)

- **D-06:** Save, Download JSON, and Download PNG are **independent** buttons in ActionBar, alongside Generate/Evaluate/Revise. No forced coupling between saving and downloading.
- **D-07:** Save persists to the server library (storageClient.saveCard()). Download JSON exports character JSON only. Download PNG triggers pngEncoder.createCharacterCard() with the current image (or a blank PNG if no image).
- **D-08:** Buttons are only active when a character exists in useGenerationStore (not during streaming).

### Library Drawer

- **D-09:** Cards-only library. Prompt template list UI is **not implemented** in Phase 4 (storageClient has the methods but no UI — deferred). The drawer shows saved character cards only.
- **D-10:** Card list UI: search input at top filters by name and tags. Each card row shows: name, last-updated date, visible tags (as many as fit), and quality score badge if present (storageClient.listCards() returns qualityScore).
- **D-11:** Clicking a card loads it into CharacterEditor. If CharacterEditor has unsaved changes (character exists and hasn't been saved since last generate/edit), prompt "Discard current character?" before loading.
- **D-12:** Each card row has a History button. Clicking it opens a modal showing the git commit list for that card (GET /api/cards/:slug/history). User selects two commits to diff → field-by-field diff view (GET /api/cards/:slug/diff/:commitA/:commitB). Both endpoints exist in the backend already.

### Lorebook Editor

- **D-13:** Lorebook editor lives in a **separate tab in the right panel** — a "Lorebook" tab alongside the character output view. Tab is only active/visible when a character exists.
- **D-14:** Lorebook tab shows: Generate button at the top, Add Entry button, then the entry list.
- **D-15:** Entry list uses expandable rows — collapsed shows key summary, click to expand inline showing all fields. Edits are in-place.
- **D-16:** Per-entry fields (full SillyTavern spec): Keys (comma-separated), Content, Comment, Priority (insertion priority number), enabled toggle, and lock button (same lock pattern as character fields).
- **D-17:** Generate Lorebook button calls api.generateLorebook(character). Replaces all **unlocked** entries. Locked entries are preserved. If entries exist, prompts confirmation before replacing. Uses same Zustand lock pattern as character field locking.
- **D-18:** Lorebook state lives in useGenerationStore (or a sibling useLorebook store — Claude's discretion based on store size).

### @Mention Autocomplete

- **D-19:** MentionInput in CreatePanel populates the @mention suggestions with saved card names from storageClient.listCards(). Cards load on component mount (or when drawer first opens). mentionAutocomplete.js service is the existing skeleton — wire it to storageClient.

### SillyTavern Sync

- **D-20:** SillyTavern sync is **not in the library drawer** — it lives in the Settings modal (already built). ST URL config is already in configStore. A "SillyTavern" section in Settings with: ST URL field, List Characters button (calls /api/st/characters), push/pull from character select.
- Note: PARITY-06 requires ST sync to work. This is the chosen surface. If Settings modal becomes too crowded, Claude may put it in a dedicated ST section tab within Settings.

### Claude's Discretion

- Exact field grouping in "Advanced Settings" collapsible
- Whether lorebook state goes in useGenerationStore or a sibling store
- Animation/transition for drawer open/close
- Empty state designs (no cards in library, no lorebook entries)
- Loading states for image generation and lorebook generation
- Tag display truncation strategy in card list rows

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Services (all ready, just need React UI)
- `src/services/imageGenerator.js` — image generation + download, ImageGenerator class
- `src/services/pngEncoder.js` — PNG V2 character card export, PNGEncoder.createCharacterCard()
- `src/services/storage.js` — storageClient with listCards, getCard, saveCard, deleteCard; slugifyName utility
- `src/services/api.js` — generateLorebook(), extractLorebook(), ST methods via proxy
- `src/services/mentionAutocomplete.js` — @mention skeleton, needs storageClient.listCards() wired

### Existing Stores
- `src/stores/useGenerationStore.js` — character, lockedFields, evalFeedback — lorebook state may extend here
- `src/stores/configStore.js` — ST URL and all API config already stored here

### Existing Components (reusable)
- `src/components/common/Modal.jsx` — for history/diff modal and confirmation dialogs
- `src/components/character/FieldRow.jsx` — per-field row pattern with lock button (reuse or adapt for lorebook entries)
- `src/components/layout/ActionBar.jsx` — add Save/Download/DownloadPNG buttons here
- `src/components/settings/` — SillyTavern sync section goes in Settings modal

### Backend Endpoints (already implemented)
- `GET /api/cards` — list cards (returns slug, name, updatedAt, commitCount, qualityScore)
- `GET /api/cards/:slug` — get card with avatarUrl
- `POST /api/cards/:slug` — save card
- `DELETE /api/cards/:slug` — delete card
- `GET /api/cards/:slug/history` — git commit list
- `GET /api/cards/:slug/diff/:commitA/:commitB` — field-by-field diff
- `POST /api/st/characters` — list ST characters
- `POST /api/st/push` — push PNG to ST
- `POST /api/st/pull` — pull character from ST

### Phase Context
- `.planning/phases/03-generation-editing/03-CONTEXT.md` — CharacterEditor, FieldRow, ActionBar patterns established in Phase 3
- `.planning/phases/02-react-app-shell/02-CONTEXT.md` — Library drawer is slide-out (D-04), Settings modal pattern (D-06, D-07)
- `.planning/REQUIREMENTS.md` — REACT-07..09, REACT-11..12, STATE-04, PARITY-03..06, PARITY-08..09

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `imageGenerator.js` (313 lines): generateCharacterImage(), downloadImage(), convertToBlob() — fully implemented, just needs a React hook wrapper
- `pngEncoder.js` (661 lines): createCharacterCard(imageBlob, characterData) — fully implemented, needs a download button
- `storageClient` in storage.js: full CRUD ready; history/diff backend APIs exist but not yet called from the frontend
- `Modal.jsx`: general-purpose modal, reuse for history/diff modal and load-confirmation dialog
- `FieldRow.jsx`: lock button pattern — lorebook entry rows can reuse or adapt this

### Established Patterns
- Zustand store with getState().action() for non-React service callbacks (established in Phase 3)
- CSS Modules per component (.module.css)
- ActionBar manages generation-phase-aware button states via deriveUiPhase()
- Library drawer toggle via Header button (D-04 from Phase 2)

### Integration Points
- `CharacterEditor.jsx` — restructure to RPG sheet layout (D-01); add Lorebook tab
- `ActionBar.jsx` — add Save, Download JSON, Download PNG buttons
- `Header.jsx` — library drawer toggle already there
- `src/components/settings/` — add SillyTavern sync section
- `MentionInput.jsx` — wire storageClient.listCards() into suggestions

</code_context>

<specifics>
## Specific Ideas

- **RPG character sheet mockup**: User provided a layout reference showing portrait top-right, compact fields top-left (Name, Author's note/Creator Notes, Tags, buttons), large fields full-width below, Advanced Settings collapsible at bottom. This is the target for CharacterEditor.
- **Lorebook lock pattern**: Same as character field locking — per-entry lock buttons, generate replaces unlocked only. User explicitly confirmed this analogy.
- **Prompt templates**: storageClient has prompt CRUD methods but the user confirmed no prompt library UI is needed. Only card library UI.

</specifics>

<deferred>
## Deferred Ideas

- **Prompt template library UI** — storageClient.listPrompts/savePrompt/deletePrompt methods exist but user confirmed no UI needed in Phase 4. Remains available for a future phase if needed.
- **LIB-05 (v2 requirement)**: PNG metadata encoder replacement with png-chunks library — deferred to v2 milestone per REQUIREMENTS.md.

</deferred>

---

*Phase: 04-export-library-full-parity*
*Context gathered: 2026-03-29*
