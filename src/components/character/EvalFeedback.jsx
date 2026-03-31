import useGenerationStore from '../../stores/useGenerationStore';
import styles from './EvalFeedback.module.css';

/** Return a CSS color variable based on score 0–100. */
function barColor(score) {
  if (score >= 70) return 'var(--success, #2a9d5c)';
  if (score >= 40) return 'var(--warning, #cf8a00)';
  return 'var(--error, #c93d4a)';
}

export default function EvalFeedback() {
  const evalFeedback = useGenerationStore((s) => s.evalFeedback);
  const excludedSuggestionIndices = useGenerationStore((s) => s.excludedSuggestionIndices);
  const toggleExcludeSuggestion = useGenerationStore((s) => s.toggleExcludeSuggestion);

  if (!evalFeedback) return null;

  // String fallback — defensive guard for unexpected payloads
  if (typeof evalFeedback === 'string') {
    return (
      <div className={styles.container}>
        <h3 className={styles.heading}>Evaluation Feedback</h3>
        <div className={styles.content}>{evalFeedback}</div>
      </div>
    );
  }

  const {
    overallScore,
    dimensions,
    suggestions = [],
    contradictions = [],
    misplacedContent = [],
  } = evalFeedback;

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Evaluation Feedback</h3>

      {/* ── Score circle + dimension bars ── */}
      {(overallScore !== undefined || (dimensions && Object.keys(dimensions).length > 0)) && (
        <div className={styles.summary}>
          {overallScore !== undefined && (
            <div className={styles.scoreCircle}>
              <span className={styles.scoreValue}>{overallScore}</span>
              <span className={styles.scoreLabel}>/ 100</span>
            </div>
          )}

          {dimensions && Object.keys(dimensions).length > 0 && (
            <div className={styles.dimensions}>
              {Object.entries(dimensions).map(([key, val]) => {
                const score = typeof val === 'object' ? val?.score : Number(val);
                const comment = typeof val === 'object' ? val?.comment : null;
                const pct = Math.min(100, Math.max(0, score || 0));
                return (
                  <div key={key} className={styles.dimensionBlock}>
                    <div className={styles.dimensionHeader}>
                      <span className={styles.dimensionLabel}>{key}</span>
                      <span className={styles.dimensionScore}>{score}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${pct}%`, background: barColor(pct) }}
                      />
                    </div>
                    {comment && (
                      <div className={styles.dimensionComment}>{comment}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Contradictions ── */}
      {contradictions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Contradictions</div>
          <ul className={styles.issueList}>
            {contradictions.map((c, i) => {
              const text = typeof c === 'string'
                ? c
                : `${Array.isArray(c.fields) ? c.fields.join(', ') : ''}: ${c.issue ?? ''}`;
              return (
                <li key={i} className={styles.issueItem}>{text}</li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Misplaced content ── */}
      {misplacedContent.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Misplaced Content</div>
          <ul className={styles.misplacedList}>
            {misplacedContent.map((m, i) => {
              const text = typeof m === 'string'
                ? m
                : `"${m.excerpt}" — move from ${m.currentField} to ${m.suggestedField}${m.reason ? ` (${m.reason})` : ''}`;
              return (
                <li key={i} className={styles.misplacedItem}>{text}</li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Suggestions (clickable) ── */}
      {suggestions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Suggestions</div>
          <ul className={styles.suggestionList}>
            {suggestions.map((s, i) => {
              const isExcluded = !!excludedSuggestionIndices[i];
              return (
                <li
                  key={i}
                  className={`${styles.suggestionItem}${isExcluded ? ` ${styles.excluded}` : ''}`}
                  onClick={() => toggleExcludeSuggestion(i)}
                  title={isExcluded ? 'Click to include in revision' : 'Click to exclude from revision'}
                >
                  <span className={styles.checkIndicator} aria-hidden="true">
                    {isExcluded ? '☐' : '☑'}
                  </span>
                  {s}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
