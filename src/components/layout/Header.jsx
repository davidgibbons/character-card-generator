import useConfigStore from '../../stores/configStore';
import styles from './Header.module.css';

export default function Header({ onSettingsClick, onThemeToggle, isDark, onLibraryToggle }) {
  const debugMode = useConfigStore((s) => s.app.debugMode);
  const setDebugMode = useConfigStore((s) => s.setDebugMode);

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Character Generator</h1>
      <div className={styles.controls}>
        <button
          className={`${styles.iconBtn} ${debugMode ? styles.active : ''}`}
          onClick={() => setDebugMode(!debugMode)}
          title="Toggle debug mode"
          aria-label="Toggle debug mode"
        >
          {'\u{1F41B}'}
        </button>
        <button
          className={styles.iconBtn}
          onClick={onLibraryToggle}
          title="Toggle library"
          aria-label="Toggle library"
        >
          {'\u{1F4D6}'}
        </button>
        <button
          className={styles.iconBtn}
          onClick={onThemeToggle}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {isDark ? '\u2600\uFE0F' : '\u{1F319}'}
        </button>
        <button
          className={styles.iconBtn}
          onClick={onSettingsClick}
          title="Settings"
          aria-label="Settings"
        >
          {'\u2699\uFE0F'}
        </button>
      </div>
    </header>
  );
}
