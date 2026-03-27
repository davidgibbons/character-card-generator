import styles from './ProgressBar.module.css';

export default function ProgressBar({ active = false }) {
  return (
    <div className={`${styles.track} ${active ? '' : styles.hidden}`}>
      <div className={styles.bar} />
    </div>
  );
}
