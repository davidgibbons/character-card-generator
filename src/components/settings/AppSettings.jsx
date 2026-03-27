import styles from './AppSettings.module.css';

export default function AppSettings({ draft, updateDraft }) {
  if (!draft) return null;

  return (
    <div>
      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <div className={styles.settingLabel}>Debug Mode</div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={draft.app.debugMode}
            onChange={(e) => updateDraft('app.debugMode', e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <div className={styles.settingLabel}>Persist API Keys</div>
          <div className={styles.settingHelp}>
            Store API keys in localStorage instead of sessionStorage (persists across browser sessions)
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={draft.app.persistApiKeys}
            onChange={(e) => updateDraft('app.persistApiKeys', e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <div className={styles.settingLabel}>Enable Image Generation</div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={draft.app.enableImageGeneration}
            onChange={(e) => updateDraft('app.enableImageGeneration', e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <div className={styles.settingLabel}>Content Policy Prefix</div>
          <div className={styles.settingHelp}>
            Prepend content policy bypass to prompts
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={draft.prompts.contentPolicyPrefix}
            onChange={(e) => updateDraft('prompts.contentPolicyPrefix', e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>
    </div>
  );
}
