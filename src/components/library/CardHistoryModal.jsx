import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import DiffView from './DiffView';
import styles from './CardHistoryModal.module.css';

/**
 * Shows git commit history for a card and allows selecting two commits to diff.
 * Props: slug (string), isOpen (boolean), onClose (function)
 *
 * API:
 *   GET /api/cards/:slug/history  → [{ hash, timestamp, message }, ...]
 *   GET /api/cards/:slug/diff/:a/:b  → { commitA, commitB, diff: {...} }
 */
export default function CardHistoryModal({ slug, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedA, setSelectedA] = useState(null); // hash string
  const [selectedB, setSelectedB] = useState(null); // hash string
  const [diffResult, setDiffResult] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !slug) return;
    setHistory([]);
    setSelectedA(null);
    setSelectedB(null);
    setDiffResult(null);
    setError('');
    setLoadingHistory(true);
    fetch(`/api/cards/${slug}/history`)
      .then((r) => r.json())
      .then((data) => { setHistory(Array.isArray(data) ? data : []); })
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoadingHistory(false));
  }, [isOpen, slug]);

  async function handleLoadDiff() {
    if (!selectedA || !selectedB || selectedA === selectedB) return;
    setLoadingDiff(true);
    setDiffResult(null);
    try {
      const r = await fetch(`/api/cards/${slug}/diff/${selectedA}/${selectedB}`);
      const data = await r.json();
      setDiffResult(data.diff || {});
    } catch {
      setError('Failed to load diff.');
    } finally {
      setLoadingDiff(false);
    }
  }

  function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Card History">
      {error && <p className={styles.error}>{error}</p>}
      {loadingHistory && <p className={styles.loading}>Loading history…</p>}
      {!loadingHistory && history.length === 0 && !error && (
        <p className={styles.empty}>No history available for this character.</p>
      )}
      {history.length > 0 && (
        <>
          <p className={styles.instruction}>Select two commits to compare:</p>
          <div className={styles.historyList}>
            {history.map((commit) => (
              <div
                key={commit.hash}
                className={`${styles.commitRow} ${selectedA === commit.hash ? styles.selectedA : ''} ${selectedB === commit.hash ? styles.selectedB : ''}`}
                onClick={() => {
                  if (!selectedA || (selectedA && selectedB)) {
                    setSelectedA(commit.hash);
                    setSelectedB(null);
                    setDiffResult(null);
                  } else {
                    setSelectedB(commit.hash);
                  }
                }}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
              >
                <span className={styles.commitMsg}>{commit.message || 'No message'}</span>
                <span className={styles.commitDate}>{formatDate(commit.timestamp)}</span>
                <span className={styles.commitHash}>{commit.hash?.slice(0, 7)}</span>
              </div>
            ))}
          </div>
          <div className={styles.diffActions}>
            <button
              className="btn-primary"
              onClick={handleLoadDiff}
              disabled={!selectedA || !selectedB || selectedA === selectedB || loadingDiff}
            >
              {loadingDiff ? 'Loading…' : 'Show Diff'}
            </button>
            {selectedA && !selectedB && <span className={styles.hint}>Select a second commit to compare</span>}
          </div>
          {diffResult && <DiffView diff={diffResult} />}
        </>
      )}
    </Modal>
  );
}
