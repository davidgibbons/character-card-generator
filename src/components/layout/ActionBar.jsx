import ProgressBar from '../common/ProgressBar';
import styles from './ActionBar.module.css';

export default function ActionBar({ isGenerating = false }) {
  return (
    <div className={styles.actionBar}>
      <div className={styles.btnGroup}>
        <button className="btn-primary" disabled>
          Generate
        </button>
        <button className="btn-outline" disabled>
          Evaluate
        </button>
        <button className="btn-outline" disabled>
          Revise
        </button>
      </div>
      <ProgressBar active={isGenerating} />
    </div>
  );
}
