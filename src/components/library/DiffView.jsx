import styles from './DiffView.module.css';

const FIELD_LABELS = {
  name: 'Name', description: 'Description', personality: 'Personality',
  scenario: 'Scenario', firstMessage: 'First Message',
  mes_example: 'Message Example', mesExample: 'Message Example',
  systemPrompt: 'System Prompt', creatorNotes: 'Creator Notes', tags: 'Tags',
};

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
              <pre className={styles.diffText}>{String(before ?? '')}</pre>
            </div>
            <div className={`${styles.diffCol} ${styles.after}`}>
              <span className={styles.colLabel}>After</span>
              <pre className={styles.diffText}>{String(after ?? '')}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
