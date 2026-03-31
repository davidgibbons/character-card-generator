import { useState, useEffect, useRef } from 'react';
import useConfigStore from '../../stores/configStore';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './STBrowserPanel.module.css';

/** Normalize ST V2 spec export → app internal camelCase format */
function normalizeStCharacter(raw) {
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

/** Compact tag summary: sorted by shortest, truncated to ~16 chars total */
function TagSummary({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const sorted = [...tags].sort((a, b) => a.length - b.length);
  let chars = 0;
  const visible = [];
  for (const tag of sorted) {
    if (chars + tag.length > 16 && visible.length > 0) break;
    visible.push(tag);
    chars += tag.length;
  }
  return (
    <span className={styles.tagSummary}>
      {visible.map((t, i) => (
        <span key={i} className={styles.tagChip}>{t}</span>
      ))}
      <span className={styles.tagCount} title={tags.join(', ')}>{tags.length}</span>
    </span>
  );
}

export default function STBrowserPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(null); // avatar of char being pulled
  const [error, setError] = useState('');
  const overlayRef = useRef(null);
  const searchRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Close on click outside
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) setIsOpen(false);
  }

  async function openAndList() {
    const stUrl = useConfigStore.getState().get('api.sillytavern.url');
    const stPassword = useConfigStore.getState().get('api.sillytavern.password');
    if (!stUrl) {
      setError('Enter the SillyTavern URL in Settings first.');
      return;
    }
    setError('');
    setIsOpen(true);
    setLoading(true);
    setCharacters([]);
    setSearch('');
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
      setError('Failed to list characters. Check the ST URL in Settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePull(char) {
    const stUrl = useConfigStore.getState().get('api.sillytavern.url');
    const stPassword = useConfigStore.getState().get('api.sillytavern.password');
    if (!stUrl) return;

    setError('');
    setPulling(char.avatar);
    try {
      // 1. Pull character data
      const r = await fetch('/api/st/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ST-URL': stUrl,
          'X-ST-Password': stPassword || '',
        },
        body: JSON.stringify({ avatar_url: char.avatar }),
      });
      if (!r.ok) throw new Error(await r.text());
      const raw = await r.json();
      useGenerationStore.getState().setCharacter(normalizeStCharacter(raw));

      // 2. Import avatar via proxy-image with ST auth
      if (char.avatar) {
        try {
          const avatarUrl = `${stUrl}/characters/${char.avatar}`;
          const imgResp = await fetch(
            `/api/proxy-image?url=${encodeURIComponent(avatarUrl)}`,
            {
              headers: {
                'X-ST-URL': stUrl,
                'X-ST-Password': stPassword || '',
              },
            }
          );
          if (imgResp.ok) {
            const blob = await imgResp.blob();
            const displayUrl = URL.createObjectURL(blob);
            useGenerationStore.getState().setImage(blob, displayUrl);
          } else {
            console.warn('STBrowserPanel: avatar fetch failed:', imgResp.status);
          }
        } catch (avatarErr) {
          console.warn('STBrowserPanel: avatar import failed:', avatarErr);
        }
      }

      // 3. Close overlay and switch to Edit tab
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent('gsd:switch-tab', { detail: 'edit' }));
    } catch (err) {
      console.error('STBrowserPanel: pull failed:', err);
      setError(`Pull failed: ${err.message}`);
    } finally {
      setPulling(null);
    }
  }

  // Filter characters by search (name or tag)
  const lower = search.toLowerCase();
  const filtered = characters.filter((c) => {
    const name = (c.name || c.avatar || '').toLowerCase();
    const tags = c.tags || [];
    return name.includes(lower) || tags.some((t) => t.toLowerCase().includes(lower));
  });

  return (
    <>
      <button
        type="button"
        className={`btn-outline ${styles.openBtn}`}
        onClick={openAndList}
      >
        Pull from SillyTavern
      </button>

      {error && !isOpen && <p className={styles.inlineError}>{error}</p>}

      {isOpen && (
        <div className={styles.backdrop} onClick={handleBackdropClick}>
          <div className={styles.overlay} ref={overlayRef}>
            <div className={styles.overlayHeader}>
              <h3 className={styles.overlayTitle}>SillyTavern Characters</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or tag…"
            />

            <div className={styles.charList}>
              {loading && <p className={styles.loadingText}>Loading…</p>}

              {!loading && filtered.length === 0 && characters.length > 0 && (
                <p className={styles.emptyText}>No characters match "{search}"</p>
              )}

              {!loading && characters.length === 0 && !error && (
                <p className={styles.emptyText}>No characters found.</p>
              )}

              {!loading && filtered.map((c) => (
                <button
                  key={c.avatar}
                  type="button"
                  className={styles.charRow}
                  onClick={() => handlePull(c)}
                  disabled={pulling !== null}
                >
                  <span className={styles.charName}>
                    {pulling === c.avatar ? 'Pulling…' : (c.name || c.avatar)}
                  </span>
                  <TagSummary tags={c.tags} />
                </button>
              ))}
            </div>

            {error && <p className={styles.overlayError}>{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
