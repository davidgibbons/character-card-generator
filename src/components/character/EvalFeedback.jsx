import useGenerationStore from '../../stores/useGenerationStore';
import styles from './EvalFeedback.module.css';

export default function EvalFeedback() {
  const evalFeedback = useGenerationStore((s) => s.evalFeedback);

  if (!evalFeedback) return null;

  // Handle string fallback (unlikely but defensive)
  if (typeof evalFeedback === 'string') {
    return (
      <div className={styles.container}>
        <h3 className={styles.heading}>Evaluation Feedback</h3>
        <div className={styles.content}>{evalFeedback}</div>
      </div>
    );
  }

  const { overallScore, dimensions, suggestions = [], contradictions = [] } = evalFeedback;

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Evaluation Feedback</h3>

      {overallScore !== undefined && (
        <div className={styles.score}>
          Overall score: <strong>{overallScore}</strong>
          {typeof overallScore === 'number' && ' / 10'}
        </div>
      )}

      {dimensions && Object.keys(dimensions).length > 0 && (
        <div className={styles.dimensions}>
          {Object.entries(dimensions).map(([key, val]) => (
            <div key={key} className={styles.dimensionRow}>
              <span className={styles.dimensionKey}>{key}</span>
              <span className={styles.dimensionVal}>
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Suggestions</div>
          <ul className={styles.list}>
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {contradictions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Contradictions</div>
          <ul className={styles.list}>
            {contradictions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
