import { diffWords } from 'diff';
import styles from './DiffView.module.css';

const FIELD_LABELS = {
  name: 'Name', description: 'Description', personality: 'Personality',
  scenario: 'Scenario', firstMessage: 'First Message',
  mes_example: 'Message Example', mesExample: 'Message Example',
  systemPrompt: 'System Prompt', creatorNotes: 'Creator Notes', tags: 'Tags',
};

/** Renders a single side of the diff with word-level highlights */
function DiffSide({ before, after, side }) {
  const parts = diffWords(String(before ?? ''), String(after ?? ''));
  return (
    <pre className={styles.diffText}>
      {parts.map((part, i) => {
        if (side === 'before') {
          if (part.added) return null; // not present in before
          if (part.removed) return <mark key={i} className={styles.removed}>{part.value}</mark>;
        } else {
          if (part.removed) return null; // not present in after
          if (part.added) return <mark key={i} className={styles.added}>{part.value}</mark>;
        }
        return <span key={i}>{part.value}</span>;
      })}
    </pre>
  );
}

/** Renders field-by-field before/after diff from /api/cards/:slug/diff response */
export default function DiffView({ diff }) {
  if (!diff || Object.keys(diff).length === 0) {
    return <p className={styles.noDiff}>No differences found between these commits.</p>;
  }

  return (
    <div className={styles.diffView}>
      {Object.entries(diff).map(([field, { before, after }]) => (
        <div key={field} className={styles.fieldDiff}>
          <div className={styles.fieldLabel}>{FIELD_LABELS[field] || field}</div>
          <div className={styles.diffColumns}>
            <div className={`${styles.diffCol} ${styles.before}`}>
              <span className={styles.colLabel}>Before</span>
              <DiffSide before={before} after={after} side="before" />
            </div>
            <div className={`${styles.diffCol} ${styles.after}`}>
              <span className={styles.colLabel}>After</span>
              <DiffSide before={before} after={after} side="after" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
