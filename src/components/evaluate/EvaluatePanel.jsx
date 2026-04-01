import useGenerationStore from '../../stores/useGenerationStore';
import EvalFeedback from '../character/EvalFeedback';
import styles from './EvaluatePanel.module.css';

/**
 * Evaluate tab content:
 * - Before evaluation: prompt to run evaluation
 * - After evaluation: EvalFeedback (scores, suggestions with exclusion)
 *   + additional instructions textarea for the Refine action
 */
export default function EvaluatePanel() {
  const character = useGenerationStore((s) => s.character);
  const evalFeedback = useGenerationStore((s) => s.evalFeedback);
  const reviseInstruction = useGenerationStore((s) => s.reviseInstruction);

  if (!character) {
    return (
      <div className={styles.emptyState}>
        <h3>No character loaded</h3>
        <p>Generate or pull a character first, then come here to evaluate it.</p>
      </div>
    );
  }

  if (!evalFeedback) {
    return (
      <div className={styles.emptyState}>
        <h3>Ready to evaluate</h3>
        <p>Click <strong>Evaluate</strong> in the action bar to analyze this character.</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Evaluation results — scores, dimensions, suggestions with exclusion */}
      <EvalFeedback />

      {/* Additional instructions for Refine */}
      <div className={styles.instructionsSection}>
        <label className={styles.instructionsLabel}>Additional instructions</label>
        <textarea
          className={`textarea ${styles.instructionsTextarea}`}
          value={reviseInstruction}
          onChange={(e) => useGenerationStore.getState().setReviseInstruction(e.target.value)}
          placeholder="Add extra refinement instructions (optional). The selected suggestions above will also be included."
          rows={3}
        />
      </div>
    </div>
  );
}
