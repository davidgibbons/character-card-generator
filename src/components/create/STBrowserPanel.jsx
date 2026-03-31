import { useState } from 'react';
import useConfigStore from '../../stores/configStore';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './STBrowserPanel.module.css';

/** Normalize ST V2 spec export → app internal camelCase format */
function normalizeStCharacter(raw) {
  // ST exports { spec: "chara_card_v2", data: { ... } } — unwrap data layer
  const d = raw?.spec === 'chara_card_v2' ? raw.data : raw;
  return {
    name: d.name || '',
    description: d.description || '',
    personality: d.personality || '',
    scenario: d.scenario || '',
    firstMessage: d.first_mes || '',
    mesExample: d.mes_example || '',
    systemPrompt: d.system_prompt || '',
    creatorNotes: d.creator_notes || '',
    tags: Array.isArray(d.tags) ? d.tags : [],
    characterBook: d.character_book || null,
  };
}

/** Render up to 4 tag bubbles for a character; show +N badge for overflow */
function TagBubbles({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const visible = tags.slice(0, 4);
  const overflow = tags.length - visible.length;
  return (
    <span className="st-char-tags">
      {visible.map((tag, i) => (
        <span key={i} className="tag">{tag}</span>
      ))}
      {overflow > 0 && (
        <span className="st-tag-more">+{overflow}</span>
      )}
    </span>
  );
}

export default function STBrowserPanel() {
  const [expanded, setExpanded] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [pullStatus, setPullStatus] = useState('idle'); // 'idle' | 'pulling' | 'done'
  const [error, setError] = useState('');

  async function handleListCharacters() {
    // Read live from configStore — same pattern as ActionBar handlePush (D003)
    const stUrl = useConfigStore.getState().get('api.sillytavern.url');
    const stPassword = useConfigStore.getState().get('api.sillytavern.password');
    if (!stUrl) {
      setError('Enter the SillyTavern URL in Settings first.');
      return;
    }
    setError('');
    setListLoading(true);
    setCharacters([]);
    setSelectedChar(null);
    try {
      const r = await fetch('/api/st/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ST-URL': stUrl,
          'X-ST-Password': stPassword || '',
        },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setCharacters(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('STBrowserPanel: list characters failed:', err);
      setError('Failed to list characters. Verify the SillyTavern URL in Settings.');
    } finally {
      setListLoading(false);
    }
  }

  async function handlePull() {
    if (!selectedChar) return;
    const stUrl = useConfigStore.getState().get('api.sillytavern.url');
    const stPassword = useConfigStore.getState().get('api.sillytavern.password');
    if (!stUrl) {
      setError('Enter the SillyTavern URL in Settings first.');
      return;
    }
    setError('');
    setPullStatus('pulling');
    try {
      // 1. Pull character data from ST
      const r = await fetch('/api/st/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ST-URL': stUrl,
          'X-ST-Password': stPassword || '',
        },
        body: JSON.stringify({ avatar_url: selectedChar.avatar }),
      });
      if (!r.ok) throw new Error(await r.text());
      const raw = await r.json();

      // 2. Normalize and push to generation store
      useGenerationStore.getState().setCharacter(normalizeStCharacter(raw));

      // 3. Import avatar via proxy-image endpoint
      if (selectedChar.avatar) {
        try {
          const avatarUrl = `${stUrl}/characters/${selectedChar.avatar}`;
          const imgResp = await fetch(
            `/api/proxy-image?url=${encodeURIComponent(avatarUrl)}`
          );
          if (imgResp.ok) {
            const blob = await imgResp.blob();
            const displayUrl = URL.createObjectURL(blob);
            useGenerationStore.getState().setImage(blob, displayUrl);
          } else {
            console.warn('STBrowserPanel: avatar fetch failed, skipping:', imgResp.status);
          }
        } catch (avatarErr) {
          // Non-fatal: character data was already imported
          console.warn('STBrowserPanel: avatar import failed:', avatarErr);
        }
      }

      setPullStatus('done');
      setTimeout(() => setPullStatus('idle'), 2000);
    } catch (err) {
      console.error('STBrowserPanel: pull failed:', err);
      setError('Pull failed. Verify the SillyTavern URL and try again.');
      setPullStatus('idle');
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* Collapsible toggle */}
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : styles.chevronClosed}`}
        >
          ▾
        </span>
        Pull from SillyTavern
      </button>

      {expanded && (
        <div className={styles.body}>
          {/* List characters button */}
          <button
            type="button"
            className={`btn-outline ${styles.listBtn}`}
            onClick={handleListCharacters}
            disabled={listLoading}
          >
            {listLoading ? 'Loading…' : 'List Characters'}
          </button>

          {/* Character list */}
          {characters.length > 0 && (
            <div className={styles.charList}>
              {characters.map((c) => (
                <div
                  key={c.avatar}
                  className={`st-char-item ${selectedChar?.avatar === c.avatar ? styles.charItemSelected : ''}`}
                  onClick={() => setSelectedChar(c)}
                  role="option"
                  aria-selected={selectedChar?.avatar === c.avatar}
                >
                  <span className="st-char-name">{c.name || c.avatar}</span>
                  <TagBubbles tags={c.tags} />
                </div>
              ))}
            </div>
          )}

          {/* Pull action row */}
          {characters.length > 0 && (
            <div className={styles.pullRow}>
              <button
                type="button"
                className="btn-outline"
                onClick={handlePull}
                disabled={!selectedChar || pullStatus === 'pulling'}
              >
                {pullStatus === 'pulling'
                  ? 'Pulling…'
                  : pullStatus === 'done'
                  ? 'Pulled ✓'
                  : 'Pull Character'}
              </button>
              {pullStatus === 'done' && (
                <span className={`${styles.pullStatus} ${styles.pullStatusDone}`}>
                  Character imported!
                </span>
              )}
            </div>
          )}

          {/* Error display */}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}
