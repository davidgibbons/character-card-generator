import { useEffect, useState } from 'react';
import useLibraryStore from '../../stores/useLibraryStore';
import useGenerationStore from '../../stores/useGenerationStore';
import { storageClient } from '../../services/storage';
import CardListItem from './CardListItem';
import CardHistoryModal from './CardHistoryModal';
import Modal from '../common/Modal';
import styles from './LibraryDrawer.module.css';

export default function LibraryDrawer() {
  const cards = useLibraryStore((s) => s.cards);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const isOpen = useLibraryStore((s) => s.isOpen);
  const { fetchCards, setSearchQuery, setIsOpen } = useLibraryStore.getState();

  // Confirmation dialogs
  const [confirmDiscard, setConfirmDiscard] = useState(null); // { slug } | null
  const [confirmDelete, setConfirmDelete] = useState(null);   // { slug, name } | null
  // History modal
  const [historySlug, setHistorySlug] = useState(null);

  // Fetch cards when drawer opens
  useEffect(() => {
    if (isOpen) fetchCards();
  }, [isOpen]);

  // Filtered cards (synchronous)
  const q = searchQuery.toLowerCase();
  const filteredCards = q
    ? cards.filter((c) => {
        const name = (c.characterName || '').toLowerCase();
        const tags = Array.isArray(c.tags) ? c.tags.join(' ').toLowerCase() : '';
        return name.includes(q) || tags.includes(q);
      })
    : cards;

  function handleClose() {
    setIsOpen(false);
  }

  function handleLoadCard(slug) {
    const isDirty = useGenerationStore.getState().isDirty;
    if (isDirty) {
      setConfirmDiscard({ slug });
    } else {
      doLoadCard(slug);
    }
  }

  async function doLoadCard(slug) {
    const result = await storageClient.getCard(slug);
    if (result?.character) {
      const store = useGenerationStore.getState();
      store.setCharacter(result.character);
      store.setDirty(false);
      if (result.avatarUrl) store.setImage(null, result.avatarUrl);
      setIsOpen(false);
    }
  }

  function handleDeleteCard(slug, name) {
    setConfirmDelete({ slug, name });
  }

  async function doDeleteCard(slug) {
    await storageClient.deleteCard(slug);
    fetchCards(); // Refresh list after delete
    setConfirmDelete(null);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`library-drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className={`library-drawer ${isOpen ? 'open' : ''}`} aria-label="Library drawer" role="complementary">
        <div className="library-drawer-header">
          <h2>Library</h2>
          <button className="library-drawer-close" onClick={handleClose} aria-label="Close library">×</button>
        </div>
        <div className="library-drawer-body">
          {/* Search */}
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search cards…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Card list */}
          {isLoading ? (
            <div className={styles.skeleton}>
              {[1, 2, 3].map((i) => <div key={i} className={styles.skeletonRow} />)}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyHeading}>
                {cards.length === 0 ? 'No saved characters yet' : 'No matches found'}
              </p>
              {cards.length === 0 && (
                <p className={styles.emptyBody}>
                  Generate a character and click Save Card to add it to your library.
                </p>
              )}
            </div>
          ) : (
            <div className={styles.cardList}>
              {filteredCards.map((card) => (
                <CardListItem
                  key={card.slug}
                  card={card}
                  onLoad={() => handleLoadCard(card.slug)}
                  onDelete={() => handleDeleteCard(card.slug, card.characterName)}
                  onHistory={() => setHistorySlug(card.slug)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Discard Changes confirmation */}
      <Modal
        isOpen={confirmDiscard !== null}
        onClose={() => setConfirmDiscard(null)}
        title="Discard Changes"
      >
        <p>You have unsaved changes. Load this character anyway?</p>
        <div className={styles.dialogActions}>
          <button className="btn-outline" onClick={() => setConfirmDiscard(null)}>Keep Changes</button>
          <button className="btn-primary" onClick={() => { doLoadCard(confirmDiscard.slug); setConfirmDiscard(null); }}>
            Discard
          </button>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete Character"
      >
        <p>This will permanently remove the card from your library. This action cannot be undone.</p>
        <div className={styles.dialogActions}>
          <button className="btn-outline" onClick={() => setConfirmDelete(null)}>Keep Character</button>
          <button
            className={`btn-primary ${styles.deleteConfirm}`}
            onClick={() => doDeleteCard(confirmDelete.slug)}
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Card History Modal */}
      {historySlug && (
        <CardHistoryModal
          slug={historySlug}
          isOpen={historySlug !== null}
          onClose={() => setHistorySlug(null)}
        />
      )}
    </>
  );
}
