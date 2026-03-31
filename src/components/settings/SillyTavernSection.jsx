import { useState } from 'react';
import styles from './SillyTavernSection.module.css';

/**
 * SillyTavern sync section for SettingsModal.
 *
 * Props:
 *   draft       — SettingsModal draft object (read draft.api.sillytavern.{url,password})
 *   updateDraft — (path, value) => void
 *
 * Character browsing and pull functionality has moved to STBrowserPanel in the Create tab.
 * Push to ST is in ActionBar (reads from configStore live).
 */

export default function SillyTavernSection({ draft, updateDraft }) {
  const [error, setError] = useState('');

  const stUrl = draft?.api?.sillytavern?.url || '';
  const stPassword = draft?.api?.sillytavern?.password || '';

  return (
    <div className={styles.section}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>ST URL</label>
        <input
          type="url"
          className={styles.input}
          value={stUrl}
          onChange={(e) => {
            setError('');
            updateDraft('api.sillytavern.url', e.target.value);
          }}
          placeholder="http://localhost:8000"
        />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Password</label>
        <input
          type="password"
          className={styles.input}
          value={stPassword}
          onChange={(e) => updateDraft('api.sillytavern.password', e.target.value)}
          placeholder="(leave blank if no password)"
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
