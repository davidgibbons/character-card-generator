import { useRef, useEffect } from 'react';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './FieldRow.module.css';
import TagChipEditor from './TagChipEditor';

/**
 * Single character field row: label + auto-height textarea + lock toggle.
 * Locked state is driven by useGenerationStore.lockedFields.
 * onChange is called with (fieldKey, newValue) — CharacterEditor dispatches to store.
 */
export default function FieldRow({ fieldKey, label, value, onChange, isProseField = true }) {
  const lockedFields = useGenerationStore((s) => s.lockedFields);
  const toggleLock = useGenerationStore((s) => s.toggleLock);
  const isLocked = !!lockedFields[fieldKey];
  const textareaRef = useRef(null);

  // Auto-height: recalculate on value change
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  // Normalize array values (tags) to display string
  const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '');

  function handleChange(e) {
    const raw = e.target.value;
    // Tags field: split back to array on change
    if (fieldKey === 'tags') {
      onChange(fieldKey, raw.split(',').map((t) => t.trim()).filter(Boolean));
    } else {
      onChange(fieldKey, raw);
    }
  }

  // Tags field: render chip editor instead of textarea
  if (fieldKey === 'tags') {
    return (
      <div className={styles.row}>
        <div className={styles.header}>
          <label className={styles.label} htmlFor={`field-${fieldKey}`}>
            {label}
          </label>
          <button
            type="button"
            className={`${styles.lockBtn} ${isLocked ? styles.locked : ''}`}
            onClick={() => toggleLock(fieldKey)}
            title={isLocked ? 'Unlock field (will be revised)' : 'Lock field (preserve during revise)'}
            aria-label={isLocked ? `Unlock ${label}` : `Lock ${label}`}
            aria-pressed={isLocked}
          >
            🔒
          </button>
        </div>
        <TagChipEditor
          value={Array.isArray(value) ? value : []}
          onChange={(tags) => onChange(fieldKey, tags)}
          disabled={isLocked}
        />
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.header}>
        <label className={styles.label} htmlFor={`field-${fieldKey}`}>
          {label}
        </label>
        <button
          type="button"
          className={`${styles.lockBtn} ${isLocked ? styles.locked : ''}`}
          onClick={() => toggleLock(fieldKey)}
          title={isLocked ? 'Unlock field (will be revised)' : 'Lock field (preserve during revise)'}
          aria-label={isLocked ? `Unlock ${label}` : `Lock ${label}`}
          aria-pressed={isLocked}
        >
          🔒
        </button>
      </div>
      <textarea
        id={`field-${fieldKey}`}
        ref={textareaRef}
        className={`textarea ${styles.textarea} ${isLocked ? styles.lockedTextarea : ''}`}
        value={displayValue}
        onChange={handleChange}
        disabled={isLocked}
        style={{ minHeight: isProseField ? '120px' : '80px' }}
      />
    </div>
  );
}
