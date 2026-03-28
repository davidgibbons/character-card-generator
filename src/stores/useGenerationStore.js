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

  // ── Field Locks ────────────────────────────────────
  // Plain object { fieldKey: boolean } — NOT a Set (Set is not JSON-serializable)
  lockedFields: {},

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
    // lockedFields intentionally NOT reset — user keeps locks between runs
  }),

  /** Set generating flag and attach (or clear) AbortController. */
  setGenerating: (flag, controller = null) => set({
    isGenerating: flag,
    abortController: controller,
  }),

  /** Store parsed character; clear generating state. */
  setCharacter: (char) => set({ character: char, isGenerating: false }),

  /** Update a single character field (user edit in CharacterEditor). */
  updateField: (fieldKey, value) => set((s) => ({
    character: s.character ? { ...s.character, [fieldKey]: value } : s.character,
  })),

  /** Store eval result. Pre-populate reviseInstruction from suggestions. */
  setEvalFeedback: (feedback) => set({
    evalFeedback: feedback,
    reviseInstruction: Array.isArray(feedback?.suggestions)
      ? feedback.suggestions.join('\n')
      : (feedback?.suggestions ?? ''),
  }),

  /** Update revision instruction text (user edits). */
  setReviseInstruction: (text) => set({ reviseInstruction: text }),

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
}));

export default useGenerationStore;
