import { useState } from 'react';
import useLorebookStore from '../../stores/useLorebookStore';
import styles from './LorebookEntryRow.module.css';

/** Human-readable labels for the 5 ST-standard insertion positions (D001). */
const POSITION_LABELS = {
  before_char: 'Before Char',
  after_char: 'After Char',
  before_AN: 'Before AN',
  after_AN: 'After AN',
  at_depth: 'At Depth',
};

/**
 * Expandable lorebook entry row.
 * Collapsed: shows primary key + metadata chips (priority, position, % chance) + enabled/lock.
 * Expanded: shows all editable fields inline with Primary Key / Secondary Keys split.
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

  // Collapsed header: primary key only (first key)
  const primaryKeyDisplay = Array.isArray(entry.keys) && entry.keys.length > 0
    ? entry.keys[0]
    : '(no keys)';

  // Metadata chip values with fallback defaults
  const chipPriority = entry.priority ?? 10;
  const chipPosition = POSITION_LABELS[entry.position ?? 'before_char'] ?? (entry.position ?? 'before_char');
  const chipProbability = entry.probability ?? 100;

  // Expanded: primary key and secondary keys
  const primaryKeyValue = Array.isArray(entry.keys) ? (entry.keys[0] || '') : '';
  const secondaryKeysValue = Array.isArray(entry.keys) && entry.keys.length > 1
    ? entry.keys.slice(1).join(', ')
    : '';

  function handlePrimaryKeyChange(e) {
    const newVal = e.target.value;
    updateEntry(index, 'keys', [newVal, ...(Array.isArray(entry.keys) ? entry.keys.slice(1) : [])]);
  }

  function handleSecondaryKeysChange(e) {
    const parsed = e.target.value
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    updateEntry(index, 'keys', [entry.keys[0] || '', ...parsed]);
  }

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
        <span className={styles.primaryKey}>{primaryKeyDisplay}</span>
        <span className={styles.metaChips}>
          <span className={styles.metaChip} title="Priority">P:{chipPriority}</span>
          <span className={styles.metaChip} title="Position">{chipPosition}</span>
          <span className={styles.metaChip} title="Trigger probability">{chipProbability}%</span>
        </span>
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
          {/* Primary Key */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Primary Key</label>
            <input
              type="text"
              className={styles.textInput}
              value={primaryKeyValue}
              onChange={handlePrimaryKeyChange}
              placeholder="Primary trigger keyword"
              disabled={isLocked}
            />
          </div>
          {/* Secondary Keys */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Secondary Keys</label>
            <input
              type="text"
              className={styles.textInput}
              value={secondaryKeysValue}
              onChange={handleSecondaryKeysChange}
              placeholder="keyword2, keyword3, …"
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
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Position</label>
              <select
                className={styles.selectInput}
                value={entry.position ?? 'before_char'}
                onChange={(e) => updateEntry(index, 'position', e.target.value)}
                disabled={isLocked}
              >
                {Object.entries(POSITION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Probability %</label>
              <input
                type="number"
                className={styles.numberInput}
                value={entry.probability ?? 100}
                onChange={(e) => updateEntry(index, 'probability', Number(e.target.value))}
                disabled={isLocked}
                min={0}
                max={100}
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
