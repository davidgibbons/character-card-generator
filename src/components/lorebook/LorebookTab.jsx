import { useState } from 'react';
import useLorebookStore from '../../stores/useLorebookStore';
import useGenerationStore from '../../stores/useGenerationStore';
import { apiHandler } from '../../services/api';
import Modal from '../common/Modal';
import LorebookEntryRow from './LorebookEntryRow';
import styles from './LorebookTab.module.css';

export default function LorebookTab() {
  const entries = useLorebookStore((s) => s.entries);
  const lockedEntries = useLorebookStore((s) => s.lockedEntries);
  const isGenerating = useLorebookStore((s) => s.isGenerating);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [genError, setGenError] = useState('');

  const hasUnlockedEntries = entries.length > 0 && entries.some((_, i) => !lockedEntries[i]);

  async function doGenerateLorebook() {
    const character = useGenerationStore.getState().character;
    if (!character) return;
    setGenError('');
    const store = useLorebookStore.getState();
    const currentEntries = store.entries;
    const locked = store.lockedEntries;

    store.setGenerating(true);
    try {
      const newEntries = await apiHandler.generateLorebook(character, currentEntries);
      // Merge: preserve locked entries at their original positions, replace unlocked
      const merged = currentEntries.map((old, i) => locked[i] ? old : (newEntries[i] || null)).filter(Boolean);
      // Append any extra new entries beyond existing count
      const extras = newEntries.slice(currentEntries.length);
      store.setEntries([...merged, ...extras]);
    } catch (err) {
      console.error('Lorebook generation failed:', err);
      setGenError('Lorebook generation failed. Check the server connection and try again.');
    } finally {
      useLorebookStore.getState().setGenerating(false);
    }
  }

  function handleGenerateClick() {
    if (hasUnlockedEntries) {
      setConfirmReplace(true);
    } else {
      doGenerateLorebook();
    }
  }

  return (
    <div className={styles.tab}>
      {/* Top controls */}
      <div className={styles.controls}>
        <button
          className="btn-primary"
          onClick={handleGenerateClick}
          disabled={isGenerating}
        >
          {isGenerating
            ? 'Generating\u2026'
            : entries.length > 0
              ? 'Regenerate Lorebook'
              : 'Generate Lorebook'}
        </button>
        <button
          className="btn-outline"
          onClick={() => useLorebookStore.getState().addEntry()}
          disabled={isGenerating}
        >
          + Add Entry
        </button>
      </div>

      {genError && <p className={styles.error}>{genError}</p>}

      {/* Entry list or empty state */}
      {entries.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyHeading}>No lorebook entries</p>
          <p className={styles.emptyBody}>
            Click Generate Lorebook to auto-create entries, or add one manually.
          </p>
        </div>
      ) : (
        <div className={styles.entryList}>
          {entries.map((_, i) => (
            <LorebookEntryRow key={i} index={i} />
          ))}
        </div>
      )}

      {/* Replace confirmation modal */}
      <Modal
        isOpen={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="Replace Lorebook"
      >
        <p>This will replace all unlocked entries. Locked entries will be preserved. Continue?</p>
        <div className={styles.dialogActions}>
          <button className="btn-outline" onClick={() => setConfirmReplace(false)}>
            Keep Lorebook
          </button>
          <button
            className="btn-primary"
            onClick={() => { setConfirmReplace(false); doGenerateLorebook(); }}
          >
            Replace
          </button>
        </div>
      </Modal>
    </div>
  );
}
