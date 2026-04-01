import { useEffect, useState, useCallback } from 'react';
import Modal from '../common/Modal';
import DiffView from './DiffView';
import { storageClient } from '../../services/storage';
import styles from './CardHistoryModal.module.css';

const FIELD_LABELS = {
  name: 'Name',
  description: 'Description',
  personality: 'Personality',
  scenario: 'Scenario',
  firstMessage: 'First Message',
  mesExample: 'Message Example',
  systemPrompt: 'System Prompt',
  creatorNotes: 'Creator Notes',
  tags: 'Tags',
};

// Fields to show in the version preview panel, in order
const PREVIEW_FIELDS = [
  'name', 'description', 'personality', 'scenario',
  'firstMessage', 'mesExample', 'systemPrompt', 'creatorNotes', 'tags',
];

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fieldValue(card, key) {
  if (!card) return '';
  // Tolerate legacy snake_case keys in older saves
  const snakeMap = {
    firstMessage: 'first_mes',
    mesExample: 'mes_example',
    systemPrompt: 'system_prompt',
    creatorNotes: 'creator_notes',
  };
  const val = key in card ? card[key] : card[snakeMap[key]];
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

/** Preview pane for a single version */
function VersionPreview({ card }) {
  if (!card) return <div className={styles.previewEmpty}>Select a revision to preview</div>;
  return (
    <div className={styles.preview}>
      {PREVIEW_FIELDS.map((key) => {
        const val = fieldValue(card, key);
        if (!val) return null;
        return (
          <div key={key} className={styles.previewField}>
            <div className={styles.previewLabel}>{FIELD_LABELS[key] || key}</div>
            <div className={styles.previewValue}>{val}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * CardHistoryModal — browse, preview, diff, load, and restore card revisions.
 *
 * Props:
 *   slug       — card slug
 *   isOpen     — boolean
 *   onClose    — () => void
 *   onLoad     — (character) => void  — called when user loads a version into editor
 */
export default function CardHistoryModal({ slug, isOpen, onClose, onLoad }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  // Preview mode: single selected commit
  const [previewHash, setPreviewHash] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Diff mode: two commits selected
  const [diffMode, setDiffMode] = useState(false);
  const [diffA, setDiffA] = useState(null);
  const [diffB, setDiffB] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Action state
  const [restoring, setRestoring] = useState(false);
  const [actionError, setActionError] = useState('');

  // Load history when modal opens
  useEffect(() => {
    if (!isOpen || !slug) return;
    setHistory([]);
    setPreviewHash(null);
    setPreviewCard(null);
    setDiffMode(false);
    setDiffA(null);
    setDiffB(null);
    setDiffResult(null);
    setError('');
    setActionError('');
    setLoadingHistory(true);
    storageClient.getCardHistory(slug)
      .then((data) => setHistory(data))
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoadingHistory(false));
  }, [isOpen, slug]);

  // Fetch preview when previewHash changes
  useEffect(() => {
    if (!previewHash || diffMode) return;
    setPreviewCard(null);
    setLoadingPreview(true);
    setActionError('');
    storageClient.getCardVersion(slug, previewHash)
      .then((card) => setPreviewCard(card))
      .catch(() => setActionError('Failed to load this version.'))
      .finally(() => setLoadingPreview(false));
  }, [previewHash, slug, diffMode]);

  // Fetch diff when both diff commits are selected
  useEffect(() => {
    if (!diffMode || !diffA || !diffB || diffA === diffB) return;
    setDiffResult(null);
    setLoadingDiff(true);
    setActionError('');
    storageClient.getCardDiff(slug, diffA, diffB)
      .then((diff) => setDiffResult(diff))
      .catch(() => setActionError('Failed to load diff.'))
      .finally(() => setLoadingDiff(false));
  }, [diffMode, diffA, diffB, slug]);

  function handleCommitClick(hash) {
    if (diffMode) {
      // In diff mode: first click sets A, second sets B
      if (!diffA || (diffA && diffB)) {
        setDiffA(hash);
        setDiffB(null);
        setDiffResult(null);
      } else if (hash !== diffA) {
        setDiffB(hash);
      }
    } else {
      setPreviewHash(hash === previewHash ? null : hash);
    }
  }

  function toggleDiffMode() {
    setDiffMode((d) => !d);
    setDiffA(null);
    setDiffB(null);
    setDiffResult(null);
    setActionError('');
  }

  async function handleLoad() {
    if (!previewCard) return;
    onLoad(previewCard);
    onClose();
  }

  async function handleRestore() {
    if (!previewCard || !slug) return;
    setRestoring(true);
    setActionError('');
    try {
      await storageClient.saveCard({
        characterName: previewCard.name || slug,
        character: previewCard,
        steeringInput: `Restored from revision ${previewHash?.slice(0, 7)}`,
      });
      onLoad(previewCard);
      onClose();
    } catch (err) {
      setActionError('Restore failed. Check the server connection.');
    } finally {
      setRestoring(false);
    }
  }

  function commitClass(hash) {
    const classes = [styles.commitRow];
    if (diffMode) {
      if (hash === diffA) classes.push(styles.selectedA);
      if (hash === diffB) classes.push(styles.selectedB);
    } else {
      if (hash === previewHash) classes.push(styles.selectedA);
    }
    return classes.join(' ');
  }

  const canDiff = diffMode && diffA && diffB && diffA !== diffB;
  const latestHash = history[0]?.hash;
  const isLatest = previewHash === latestHash;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Revision History" className={styles.wideModal}>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.layout}>
        {/* ── Left: commit list ── */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>
              {loadingHistory ? 'Loading…' : `${history.length} revision${history.length !== 1 ? 's' : ''}`}
            </span>
            <button
              className={`btn-small ${styles.modeToggle} ${diffMode ? styles.modeActive : ''}`}
              onClick={toggleDiffMode}
              title={diffMode ? 'Back to preview mode' : 'Compare two revisions'}
            >
              {diffMode ? '← Preview' : 'Compare'}
            </button>
          </div>

          {diffMode && (
            <p className={styles.diffHint}>
              {!diffA ? 'Click a revision to set From' : !diffB ? 'Click another to set To' : 'Showing diff ↓'}
            </p>
          )}

          <div className={styles.commitList}>
            {history.map((commit, idx) => (
              <div
                key={commit.hash}
                className={commitClass(commit.hash)}
                onClick={() => handleCommitClick(commit.hash)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCommitClick(commit.hash)}
              >
                <div className={styles.commitTop}>
                  <span className={styles.commitMsg}>
                    {commit.steeringInput || commit.message || 'Saved'}
                  </span>
                  {idx === 0 && <span className={styles.latestBadge}>latest</span>}
                </div>
                <div className={styles.commitMeta}>
                  <span className={styles.commitDate}>{formatDate(commit.timestamp)}</span>
                  <span className={styles.commitHash}>{commit.hash?.slice(0, 7)}</span>
                </div>
              </div>
            ))}
            {!loadingHistory && history.length === 0 && !error && (
              <p className={styles.empty}>No history available.</p>
            )}
          </div>
        </div>

        {/* ── Right: preview or diff ── */}
        <div className={styles.main}>
          {diffMode ? (
            <div className={styles.diffPanel}>
              {!diffA && !diffB && (
                <div className={styles.previewEmpty}>Select two revisions on the left to compare them.</div>
              )}
              {diffA && !diffB && (
                <div className={styles.previewEmpty}>Now select a second revision to compare against.</div>
              )}
              {loadingDiff && <div className={styles.previewEmpty}>Loading diff…</div>}
              {actionError && <p className={styles.actionError}>{actionError}</p>}
              {canDiff && !loadingDiff && diffResult !== null && (
                <DiffView diff={diffResult} />
              )}
            </div>
          ) : (
            <div className={styles.previewPanel}>
              {loadingPreview && <div className={styles.previewEmpty}>Loading…</div>}
              {actionError && <p className={styles.actionError}>{actionError}</p>}
              {!loadingPreview && <VersionPreview card={previewCard} />}

              {previewCard && (
                <div className={styles.actions}>
                  <button
                    className="btn-outline"
                    onClick={handleLoad}
                    title="Load into editor without saving — marks as unsaved"
                  >
                    Load into Editor
                  </button>
                  {!isLatest && (
                    <button
                      className="btn-primary"
                      onClick={handleRestore}
                      disabled={restoring}
                      title="Save this version as a new revision"
                    >
                      {restoring ? 'Restoring…' : 'Restore this Revision'}
                    </button>
                  )}
                  {isLatest && (
                    <span className={styles.latestNote}>This is the current version</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
