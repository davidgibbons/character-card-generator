import { useState } from 'react';
import useLorebookStore from '../../stores/useLorebookStore';
import styles from './LorebookEntryRow.module.css';

/**
 * Expandable lorebook entry row.
 * Collapsed: shows key summary + enabled state + lock button.
 * Expanded: shows all editable fields inline.
 *
 * Props: index (number)
 */
export default function LorebookEntryRow({ index }) {
  const entry = useLorebookStore((s) => s.entries[index]);
  const lockedEntries = useLorebookStore((s) => s.lockedEntries);
  const { updateEntry, deleteEntry, toggleEntryLock } = useLorebookStore.getState();

  const [expanded, setExpanded] = useState(false);

  if (!entry) return null;

  const isLocked = !!lockedEntries[index];
  const keySummary = Array.isArray(entry.keys) && entry.keys.length > 0
    ? entry.keys.join(', ')
    : '(no keys)';

  return (
    <div className={`${styles.row} ${isLocked ? styles.locked : ''} ${!entry.enabled ? styles.disabled : ''}`}>
      {/* Collapsed header — always visible */}
      <div
        className={styles.header}
        onClick={() => setExpanded((x) => !x)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((x) => !x)}
      >
        <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
        <span className={styles.keySummary}>{keySummary}</span>
        <span className={styles.headerActions} onClick={(e) => e.stopPropagation()}>
          {/* Enabled toggle */}
          <label className={styles.toggleLabel} title={entry.enabled ? 'Disable entry' : 'Enable entry'}>
            <input
              type="checkbox"
              checked={!!entry.enabled}
              onChange={(e) => updateEntry(index, 'enabled', e.target.checked)}
            />
            <span className={styles.toggleText}>{entry.enabled ? 'On' : 'Off'}</span>
          </label>
          {/* Lock button */}
          <button
            type="button"
            className={`${styles.lockBtn} ${isLocked ? styles.lockedBtn : ''}`}
            onClick={() => toggleEntryLock(index)}
            title={isLocked ? 'Unlock entry (will be replaced by Generate)' : 'Lock entry (preserve during Generate)'}
            aria-label={isLocked ? 'Unlock entry' : 'Lock entry'}
            aria-pressed={isLocked}
          >
            🔒
          </button>
        </span>
      </div>

      {/* Expanded body — inline editable fields */}
      {expanded && (
        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Keys</label>
            <input
              type="text"
              className={styles.textInput}
              value={Array.isArray(entry.keys) ? entry.keys.join(', ') : ''}
              onChange={(e) => updateEntry(index, 'keys', e.target.value.split(',').map((k) => k.trim()).filter(Boolean))}
              placeholder="keyword1, keyword2"
              disabled={isLocked}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Content</label>
            <textarea
              className={`textarea ${styles.textarea}`}
              value={entry.content || ''}
              onChange={(e) => updateEntry(index, 'content', e.target.value)}
              placeholder="Lorebook entry content…"
              disabled={isLocked}
              style={{ minHeight: '80px' }}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Comment</label>
            <input
              type="text"
              className={styles.textInput}
              value={entry.comment || ''}
              onChange={(e) => updateEntry(index, 'comment', e.target.value)}
              placeholder="Internal note…"
              disabled={isLocked}
            />
          </div>
          <div className={styles.fieldRow2}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Priority</label>
              <input
                type="number"
                className={styles.numberInput}
                value={entry.priority ?? 10}
                onChange={(e) => updateEntry(index, 'priority', Number(e.target.value))}
                disabled={isLocked}
                min={0}
              />
            </div>
          </div>
          {!isLocked && (
            <div className={styles.deleteRow}>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => deleteEntry(index)}
              >
                Delete Entry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
