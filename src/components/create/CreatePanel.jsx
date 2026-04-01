import { useState, useEffect } from 'react';
import MentionInput from './MentionInput';
import useGenerationStore from '../../stores/useGenerationStore';
import { apiHandler } from '../../services/api';
import { configStore } from '../../stores/configStore';
import { parseSections, sectionsToCharacter } from '../../utils/parseSections';
import STBrowserPanel from './STBrowserPanel';
import styles from './CreatePanel.module.css';

const POV_OPTIONS = [
  { value: 'first', label: '1st Person' },
  { value: 'third', label: '3rd Person' },
  { value: 'scenario', label: 'Scenario' },
];

const FIELD_ORDER = [
  'name', 'personality', 'description', 'scenario', 'firstMessage',
  'tags', 'mesExample', 'systemPrompt', 'creatorNotes',
];

export default function CreatePanel() {
  const concept = useGenerationStore((s) => s.concept);
  const setConcept = useGenerationStore((s) => s.setConcept);
  const characterName = useGenerationStore((s) => s.characterName);
  const setCharacterName = useGenerationStore((s) => s.setCharacterName);
  const pov = useGenerationStore((s) => s.pov);
  const setPov = useGenerationStore((s) => s.setPov);
  const [conceptError, setConceptError] = useState('');
  const [genError, setGenError] = useState('');

  const isGenerating = useGenerationStore((s) => s.isGenerating);

  // Listen for 'gsd:generate' dispatched by ActionBar Generate/Regenerate button
  useEffect(() => {
    const onGenerate = () => handleGenerate();
    window.addEventListener('gsd:generate', onGenerate);
    return () => window.removeEventListener('gsd:generate', onGenerate);
  }, []);  // stable — handleGenerate reads store state via getState()

  async function handleGenerate() {
    const { concept: currentConcept, characterName: currentName, pov: currentPov } = useGenerationStore.getState();
    if (!currentConcept.trim()) {
      setConceptError('Enter a character concept before generating.');
      return;
    }

    // Check API configuration before starting generation
    const apiKey = configStore.get('api.text.apiKey');
    const baseUrl = configStore.get('api.text.baseUrl');
    if (!apiKey || !baseUrl) {
      setGenError('API not configured. Open Settings to enter your API key and base URL.');
      return;
    }

    setConceptError('');
    setGenError('');

    const store = useGenerationStore.getState();
    const controller = new AbortController();
    store.reset();
    store.setGenerating(true, controller);

    try {
      // CORRECT: pass getState().append as callback — never a React state setter
      await apiHandler.generateCharacter(
        currentConcept,
        currentName,
        (chunk) => { useGenerationStore.getState().append(chunk); },
        currentPov,
        null  // lorebook: Phase 4
      );

      // Generation complete — parse and store character
      const rawText = useGenerationStore.getState().streamText;
      const sections = parseSections(rawText);
      const character = sectionsToCharacter(sections, rawText);
      useGenerationStore.getState().setCharacter(character);

      // Auto-switch to Edit tab after successful generation
      window.dispatchEvent(new CustomEvent('gsd:switch-tab', { detail: 'edit' }));
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Generation failed:', err);
        setGenError('Generation failed. Check your API settings and try again.');
        useGenerationStore.getState().setGenerating(false, null);
      }
      // AbortError = user stopped — store.abort() already set isGenerating=false
    }
  }

  return (
    <div className={styles.panel}>
      {/* Character Concept */}
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="concept-input">Character Concept</label>
        <MentionInput
          value={concept}
          onChange={setConcept}
          disabled={isGenerating}
        />
        {conceptError && (
          <span className={styles.inlineError}>{conceptError}</span>
        )}
      </div>

      {/* Character Name */}
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="character-name">Character Name</label>
        <input
          id="character-name"
          type="text"
          className="input"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="Character name (optional — LLM will generate one)"
          disabled={isGenerating}
        />
      </div>

      {/* POV Mode */}
      <div className={styles.formGroup}>
        <label className={styles.label}>POV Mode</label>
        <div className={styles.povGroup} role="group" aria-label="POV Mode">
          {POV_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={
                pov === value
                  ? `btn-primary ${styles.povBtn} ${styles.povBtnActive}`
                  : `btn-small ${styles.povBtn}`
              }
              onClick={() => setPov(value)}
              disabled={isGenerating}
              aria-pressed={pov === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ST Browser — pull a character from SillyTavern */}
      <div className={styles.formGroup}>
        <STBrowserPanel />
      </div>

      {/* Generation error */}
      {genError && (
        <div className={styles.errorBlock}>{genError}</div>
      )}
    </div>
  );
}

// Export FIELD_ORDER so App.jsx can pass it to CharacterEditor
export { FIELD_ORDER };
