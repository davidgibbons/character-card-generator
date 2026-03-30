// Lorebook entries and generation state
// Uses Zustand 5.x named import pattern (matches other stores)
import { create } from 'zustand';

const useLorebookStore = create((set, get) => ({
  // ── Entries ────────────────────────────────────────
  entries: [],         // LorebookEntry[] — SillyTavern V2 characterBook.entries shape

  // ── Entry Locks ────────────────────────────────────
  // Plain object { entryIndex: boolean } — same pattern as lockedFields in useGenerationStore
  lockedEntries: {},

  // ── Generation ─────────────────────────────────────
  isGenerating: false,

  // ── Actions ────────────────────────────────────────

  /** Replace the full entry list (after generate or load). */
  setEntries: (entries) => set({ entries }),

  /** Add a new blank entry. */
  addEntry: () => set((s) => ({
    entries: [
      ...s.entries,
      { keys: [], content: '', comment: '', priority: 10, enabled: true, name: '', constant: false },
    ],
  })),

  /** Update a single entry field. */
  updateEntry: (index, field, value) => set((s) => {
    const entries = [...s.entries];
    entries[index] = { ...entries[index], [field]: value };
    return { entries };
  }),

  /** Delete entry at index. Also removes lock for that index. */
  deleteEntry: (index) => set((s) => {
    const entries = s.entries.filter((_, i) => i !== index);
    // Rebuild lockedEntries — shift all indices above the deleted one
    const lockedEntries = {};
    Object.entries(s.lockedEntries).forEach(([k, v]) => {
      const i = Number(k);
      if (i < index) lockedEntries[i] = v;
      else if (i > index) lockedEntries[i - 1] = v;
      // i === index: deleted, drop it
    });
    return { entries, lockedEntries };
  }),

  /**
   * Toggle a lorebook entry's locked state.
   * lockedEntries is a plain object: { entryIndex: boolean }
   */
  toggleEntryLock: (index) => set((s) => ({
    lockedEntries: { ...s.lockedEntries, [index]: !s.lockedEntries[index] },
  })),

  /** Set lorebook generation in-progress flag. */
  setGenerating: (flag) => set({ isGenerating: flag }),

  /** Clear all entries and locks (called when a new character is loaded). */
  reset: () => set({ entries: [], lockedEntries: {}, isGenerating: false }),
}));

export default useLorebookStore;
