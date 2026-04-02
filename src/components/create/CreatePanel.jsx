import { useState, useEffect, useRef } from 'react';
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
  const [suggestions, setSuggestions] = useState([]);   // [{ title, concept }]
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const conceptRef = useRef(null);

  const isGenerating = useGenerationStore((s) => s.isGenerating);

  // Listen for 'gsd:generate' dispatched by ActionBar Generate/Regenerate button
  useEffect(() => {
    const onGenerate = () => handleGenerate();
    window.addEventListener('gsd:generate', onGenerate);
    return () => window.removeEventListener('gsd:generate', onGenerate);
  }, []);  // stable — handleGenerate reads store state via getState()

  async function handleSuggest() {
    const { concept: currentConcept, pov: currentPov } = useGenerationStore.getState();
    if (!currentConcept.trim()) {
      setConceptError('Enter a theme or idea first, then click Suggest.');
      return;
    }
    const apiKey = configStore.get('api.text.apiKey');
    const baseUrl = configStore.get('api.text.baseUrl');
    if (!apiKey || !baseUrl) {
      setSuggestError('API not configured. Open Settings to enter your API key and base URL.');
      return;
    }
    setConceptError('');
    setSuggestError('');
    setSuggestions([]);
    setSuggesting(true);
    try {
      const results = await apiHandler.suggestConcepts(currentConcept.trim(), 4, currentPov);
      setSuggestions(results);
    } catch (err) {
      console.error('Suggest failed:', err);
      setSuggestError('Suggestions failed. Check your API settings and try again.');
    } finally {
      setSuggesting(false);
    }
  }

  function handlePickSuggestion(concept) {
    useGenerationStore.getState().setConcept(concept);
    setSuggestions([]);
    // Focus the concept textarea so the user can edit before generating
    setTimeout(() => {
      const textarea = document.querySelector('textarea[aria-label="Character Concept"], .mentions textarea, #concept-input');
      if (textarea) textarea.focus();
    }, 50);
  }

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
        <div className={styles.conceptActions}>
          <button
            type="button"
            className={`btn-small ${styles.suggestBtn}`}
            onClick={handleSuggest}
            disabled={isGenerating || suggesting}
          >
            {suggesting ? 'Thinking…' : '✦ Suggest'}
          </button>
        </div>
        {conceptError && (
          <span className={styles.inlineError}>{conceptError}</span>
        )}
        {suggestError && (
          <span className={styles.inlineError}>{suggestError}</span>
        )}
        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            <div className={styles.suggestionsLabel}>Pick a concept — it'll fill in the box above for you to edit</div>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className={styles.suggestionCard}
                onClick={() => handlePickSuggestion(s.concept)}
              >
                <span className={styles.suggestionTitle}>{s.title}</span>
                <span className={styles.suggestionConcept}>{s.concept}</span>
              </button>
            ))}
          </div>
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
