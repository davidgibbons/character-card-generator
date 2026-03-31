import { useState } from 'react';
import useGenerationStore from '../../stores/useGenerationStore';
import { pngEncoder } from '../../services/pngEncoder';
import styles from './SillyTavernSection.module.css';

/**
 * SillyTavern sync section for SettingsModal.
 *
 * Props:
 *   draft       — SettingsModal draft object (read draft.api.sillytavern.{url,password})
 *   updateDraft — (path, value) => void
 *
 * IMPORTANT: Use draft.api.sillytavern.url/password for API calls (not configStore)
 * because values may be unsaved at the time the user clicks List Characters.
 */
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

export default function SillyTavernSection({ draft, updateDraft, onClose }) {
  const [stCharacters, setStCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState('idle');
  const [pullStatus, setPullStatus] = useState('idle');
  const [error, setError] = useState('');

  const stUrl = draft?.api?.sillytavern?.url || '';
  const stPassword = draft?.api?.sillytavern?.password || '';

  async function blobToBase64(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  async function handleListCharacters() {
    if (!stUrl) { setError('Enter the SillyTavern URL first.'); return; }
    setError('');
    setListLoading(true);
    setStCharacters([]);
    setSelectedChar(null);
    try {
      const r = await fetch('/api/st/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ST-URL': stUrl,
          'X-ST-Password': stPassword,
        },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setStCharacters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to list characters. Verify the SillyTavern URL.');
    } finally {
      setListLoading(false);
    }
  }

  async function handlePush() {
    const { character, imageBlob } = useGenerationStore.getState();
    if (!character || !stUrl) return;
    setError('');
    setPushStatus('pushing');
    try {
      const fileName = `${character.name || 'character'}.png`;
      let body;
      if (imageBlob) {
        const pngBlob = await pngEncoder.createCharacterCard(imageBlob, character);
        const imageBase64 = await blobToBase64(pngBlob);
        body = { imageBase64, fileName };
      } else {
        body = { characterJson: character, fileName };
      }
      const r = await fetch('/api/st/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ST-URL': stUrl,
          'X-ST-Password': stPassword,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      setPushStatus('done');
      setTimeout(() => setPushStatus('idle'), 2000);
    } catch (err) {
      console.error('ST push failed:', err);
      setError('Push failed. Verify the SillyTavern URL and try again.');
      setPushStatus('idle');
    }
  }

  async function handlePull() {
    if (!selectedChar || !stUrl) return;
    setError('');
    setPullStatus('pulling');
    try {
      const r = await fetch('/api/st/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ST-URL': stUrl,
          'X-ST-Password': stPassword,
        },
        body: JSON.stringify({ avatar_url: selectedChar.avatar }),
      });
      if (!r.ok) throw new Error(await r.text());
      const raw = await r.json();
      useGenerationStore.getState().setCharacter(normalizeStCharacter(raw));
      setPullStatus('done');
      setTimeout(() => { setPullStatus('idle'); onClose?.(); }, 1500);
    } catch (err) {
      console.error('ST pull failed:', err);
      setError('Pull failed. Verify the SillyTavern URL and try again.');
      setPullStatus('idle');
    }
  }

  const character = useGenerationStore((s) => s.character);

  return (
    <div className={styles.section}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>ST URL</label>
        <input
          type="url"
          className={styles.input}
          value={stUrl}
          onChange={(e) => updateDraft('api.sillytavern.url', e.target.value)}
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

      <div className={styles.actions}>
        <button className="btn-outline" onClick={handleListCharacters} disabled={listLoading}>
          {listLoading ? 'Loading\u2026' : 'List Characters'}
        </button>
        <button
          className="btn-outline"
          onClick={handlePush}
          disabled={!character || pushStatus === 'pushing'}
        >
          {pushStatus === 'pushing' ? 'Pushing\u2026' : pushStatus === 'done' ? 'Pushed \u2713' : 'Push Character'}
        </button>
      </div>

      {stCharacters.length > 0 && (
        <div className={styles.charList}>
          <label className={styles.label}>Pull from SillyTavern</label>
          <select
            className={styles.select}
            value={selectedChar?.avatar || ''}
            onChange={(e) => {
              const c = stCharacters.find((x) => x.avatar === e.target.value);
              setSelectedChar(c || null);
            }}
          >
            <option value="">Select a character\u2026</option>
            {stCharacters.map((c) => (
              <option key={c.avatar} value={c.avatar}>{c.name || c.avatar}</option>
            ))}
          </select>
          <button
            className="btn-outline"
            onClick={handlePull}
            disabled={!selectedChar || pullStatus === 'pulling'}
          >
            {pullStatus === 'pulling' ? 'Pulling\u2026' : pullStatus === 'done' ? 'Pulled \u2713' : 'Pull Character'}
          </button>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
