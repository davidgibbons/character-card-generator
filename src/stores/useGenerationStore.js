// Generation, streaming, and character editing state
// Uses Zustand 5.x named import pattern (matches configStore.js)
import { create } from 'zustand';

const useGenerationStore = create((set, get) => ({
  // ── Streaming ──────────────────────────────────────
  streamText: '',
  isGenerating: false,
  abortController: null,

  // ── Character ──────────────────────────────────────
  character: null,        // parsed character object after generation
  prevCharacter: null,    // snapshot before revise — for changed-field highlight

  // ── Eval / Revise ──────────────────────────────────
  evalFeedback: null,         // object from evaluateCard() — NOT a string
  reviseInstruction: '',      // user-editable, pre-populated from eval suggestions
  excludedSuggestionIndices: {}, // plain object { index: bool } — tracks excluded suggestions

  // ── Field Locks ────────────────────────────────────
  // Plain object { fieldKey: boolean } — NOT a Set (Set is not JSON-serializable)
  lockedFields: {},

  // ── Image ──────────────────────────────────────────
  imageBlob: null,          // Blob — current character image; null if none
  imageDisplayUrl: null,    // string — blob: URL for <img> display; null if none
  isImageGenerating: false, // boolean — image generation in progress

  // ── Dirty tracking ─────────────────────────────────
  isDirty: false,           // true after generate/edit, false after successful save

  // ── Create form state (persists across tab switches) ──
  concept: '',
  characterName: '',
  pov: 'first',

  // ── Actions ────────────────────────────────────────

  /** Accumulate a streaming chunk. Use via getState().append(chunk) — never pass as React state setter. */
  append: (chunk) => set((s) => ({ streamText: s.streamText + chunk })),

  /** Reset to initial streaming state (called before a new generate or revise). */
  reset: () => set({
    streamText: '',
    isGenerating: false,
    character: null,
    prevCharacter: null,
    evalFeedback: null,
    reviseInstruction: '',
    excludedSuggestionIndices: {},
    imageBlob: null,
    imageDisplayUrl: null,
    isImageGenerating: false,
    isDirty: false,
    // lockedFields intentionally NOT reset — user keeps locks between runs
  }),

  /** Set generating flag and attach (or clear) AbortController. */
  setGenerating: (flag, controller = null) => set({
    isGenerating: flag,
    abortController: controller,
  }),

  /** Store parsed character; clear generating state. */
  setCharacter: (char) => set({ character: char, isGenerating: false, isDirty: true }),

  /** Update a single character field (user edit in CharacterEditor). */
  updateField: (fieldKey, value) => set((s) => ({
    character: s.character ? { ...s.character, [fieldKey]: value } : s.character,
    isDirty: true,
  })),

  /** Store eval result. Pre-populate reviseInstruction from suggestions. Reset exclusions. */
  setEvalFeedback: (feedback) => set({
    evalFeedback: feedback,
    excludedSuggestionIndices: {},
    reviseInstruction: Array.isArray(feedback?.suggestions)
      ? feedback.suggestions.join('\n')
      : (feedback?.suggestions ?? ''),
  }),

  /** Update revision instruction text (user edits). */
  setReviseInstruction: (text) => set({ reviseInstruction: text }),

  /**
   * Toggle a suggestion's excluded state by index.
   * Recomputes reviseInstruction from all non-excluded suggestions.
   */
  toggleExcludeSuggestion: (i) => set((s) => {
    const excluded = { ...s.excludedSuggestionIndices, [i]: !s.excludedSuggestionIndices[i] };
    const suggestions = Array.isArray(s.evalFeedback?.suggestions) ? s.evalFeedback.suggestions : [];
    const remaining = suggestions.filter((_, idx) => !excluded[idx]);
    return { excludedSuggestionIndices: excluded, reviseInstruction: remaining.join('\n') };
  }),

  /**
   * Toggle a field's locked state.
   * lockedFields is a plain object: { fieldKey: true/false }
   * Check with: lockedFields[field]  (falsy = unlocked)
   */
  toggleLock: (field) => set((s) => ({
    lockedFields: { ...s.lockedFields, [field]: !s.lockedFields[field] },
  })),

  /** Abort current in-progress generation. */
  abort: () => {
    const { abortController } = get();
    if (abortController) abortController.abort();
    set({ isGenerating: false, abortController: null });
  },

  /** Set image blob and display URL together. Old displayUrl is NOT revoked here —
   *  caller must revoke via useEffect cleanup. */
  setImage: (blob, displayUrl) => set({ imageBlob: blob, imageDisplayUrl: displayUrl }),

  /** Clear image state (e.g. after new generation starts). */
  clearImage: () => set({ imageBlob: null, imageDisplayUrl: null }),

  /** Set image generation in-progress flag. */
  setImageGenerating: (flag) => set({ isImageGenerating: flag }),

  /** Mark character data as dirty (unsaved changes). */
  setDirty: (flag) => set({ isDirty: flag }),

  /** Update create-form concept text. */
  setConcept: (text) => set({ concept: text }),

  /** Update create-form character name. */
  setCharacterName: (name) => set({ characterName: name }),

  /** Update create-form POV mode. */
  setPov: (mode) => set({ pov: mode }),
}));

export default useGenerationStore;
