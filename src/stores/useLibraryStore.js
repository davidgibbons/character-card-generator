// Library drawer browsing state
// Uses Zustand 5.x named import pattern (matches other stores)
import { create } from 'zustand';
import { storageClient } from '../services/storage';

const useLibraryStore = create((set, get) => ({
  // ── Library Data ───────────────────────────────────
  cards: [],             // CardSummary[] from storageClient.listCards()
  isLoading: false,
  searchQuery: '',

  // ── Drawer UI ──────────────────────────────────────
  isOpen: false,

  // ── Actions ────────────────────────────────────────

  /** Open or close the library drawer. */
  setIsOpen: (flag) => set({ isOpen: flag }),

  /** Toggle drawer open state. */
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

  /** Update search query (filtering is synchronous — no async needed). */
  setSearchQuery: (query) => set({ searchQuery: query }),

  /** Fetch card list from server and update cards[]. */
  fetchCards: async () => {
    set({ isLoading: true });
    try {
      const cards = await storageClient.listCards();
      set({ cards: cards || [], isLoading: false });
    } catch (err) {
      console.error('fetchCards failed:', err);
      set({ isLoading: false });
    }
  },
}));

export default useLibraryStore;
