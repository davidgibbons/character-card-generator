import { useState, useRef } from 'react';
import FieldRow from './FieldRow';
import EvalFeedback from './EvalFeedback';
import ImageSlot from './ImageSlot';
import useGenerationStore from '../../stores/useGenerationStore';
import { imageGenerator } from '../../services/imageGenerator';
import styles from './CharacterEditor.module.css';

const FIELD_LABELS = {
  name: 'Name',
  personality: 'Personality',
  description: 'Description',
  scenario: 'Scenario',
  firstMessage: 'First Message',
  tags: 'Tags',
  mesExample: 'Message Example',
  systemPrompt: 'System Prompt',
  creatorNotes: 'Creator Notes',
};

// Single-value fields get smaller min-height
const SINGLE_VALUE_FIELDS = new Set(['name', 'tags']);

// Header compact fields: name, tags, creatorNotes
const HEADER_FIELDS = ['name', 'tags', 'creatorNotes'];
// Body prose fields: description, personality, scenario, firstMessage, mesExample
const BODY_FIELDS = ['description', 'personality', 'scenario', 'firstMessage', 'mesExample'];
// Advanced: systemPrompt
const ADVANCED_FIELDS = ['systemPrompt'];

export default function CharacterEditor() {
  const character = useGenerationStore((s) => s.character);
  const updateField = useGenerationStore((s) => s.updateField);
  const evalFeedback = useGenerationStore((s) => s.evalFeedback);
  const imageDisplayUrl = useGenerationStore((s) => s.imageDisplayUrl);
  const isImageGenerating = useGenerationStore((s) => s.isImageGenerating);
  const [subtab, setSubtab] = useState('character');
  const fileInputRef = useRef(null);

  async function handleGenerateImage() {
    const char = useGenerationStore.getState().character;
    if (!char) return;
    const store = useGenerationStore.getState();
    store.setImageGenerating(true);
    // Revoke old display URL before generating new one
    if (store.imageDisplayUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(store.imageDisplayUrl);
    }
    store.clearImage();
    try {
      const url = await imageGenerator.generateCharacterImage(char.description, char.name);
      const blob = await imageGenerator.convertToBlob(url);
      const displayUrl = URL.createObjectURL(blob);
      store.setImage(blob, displayUrl);
    } catch (err) {
      console.error('Image generation failed:', err);
    } finally {
      useGenerationStore.getState().setImageGenerating(false);
    }
  }

  async function handleUploadImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      imageGenerator.validateImageFile(file); // throws if invalid
      const store = useGenerationStore.getState();
      if (store.imageDisplayUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(store.imageDisplayUrl);
      }
      const displayUrl = URL.createObjectURL(file);
      store.setImage(file, displayUrl); // File is Blob subtype — works with pngEncoder
    } catch (err) {
      console.error('Upload validation failed:', err);
    }
  }

  if (!character) {
    return (
      <div className={styles.emptyState}>
        <h3 className={styles.emptyHeading}>No character yet</h3>
        <p className={styles.emptyBody}>
          Enter a concept on the left and click Generate Character to create your first character.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      {/* ── Header section: two-column ─────────────────── */}
      <div className={styles.header}>
        {/* Left column: compact fields + image buttons */}
        <div className={styles.headerLeft}>
          {HEADER_FIELDS.map((fieldKey) => (
            <FieldRow
              key={fieldKey}
              fieldKey={fieldKey}
              label={FIELD_LABELS[fieldKey]}
              value={character[fieldKey] ?? ''}
              onChange={updateField}
              isProseField={!SINGLE_VALUE_FIELDS.has(fieldKey)}
            />
          ))}
          <div className={styles.imgBtns}>
            {/* Hidden file input for upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadImage}
            />
            <button
              type="button"
              className="btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImageGenerating}
            >
              Upload Image
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={handleGenerateImage}
              disabled={isImageGenerating}
            >
              {imageDisplayUrl ? 'Regenerate Image' : 'Generate Image'}
            </button>
          </div>
        </div>
        {/* Right column: portrait slot */}
        <div className={styles.headerRight}>
          <ImageSlot />
        </div>
      </div>

      {/* ── Subtab bar: Character / Lorebook ────────────── */}
      <div className={styles.subtabBar}>
        <button
          className={`${styles.subtabBtn} ${subtab === 'character' ? styles.subtabActive : ''}`}
          onClick={() => setSubtab('character')}
        >
          Character
        </button>
        <button
          className={`${styles.subtabBtn} ${subtab === 'lorebook' ? styles.subtabActive : ''}`}
          onClick={() => setSubtab('lorebook')}
        >
          Lorebook
        </button>
      </div>

      {/* ── Body: Character tab ──────────────────────────── */}
      {subtab === 'character' && (
        <>
          <div className={styles.bodyFields}>
            {BODY_FIELDS.map((fieldKey) => (
              <FieldRow
                key={fieldKey}
                fieldKey={fieldKey}
                label={FIELD_LABELS[fieldKey]}
                value={character[fieldKey] ?? ''}
                onChange={updateField}
                isProseField={true}
              />
            ))}
          </div>

          {/* Advanced Settings collapsible */}
          <details className={styles.advanced}>
            <summary className={styles.advancedSummary}>Advanced Settings</summary>
            <div className={styles.advancedBody}>
              {ADVANCED_FIELDS.map((fieldKey) => (
                <FieldRow
                  key={fieldKey}
                  fieldKey={fieldKey}
                  label={FIELD_LABELS[fieldKey]}
                  value={character[fieldKey] ?? ''}
                  onChange={updateField}
                  isProseField={true}
                />
              ))}
            </div>
          </details>

          {/* EvalFeedback below advanced settings */}
          {evalFeedback && (
            <div className={styles.evalSeparator}>
              <EvalFeedback />
            </div>
          )}
        </>
      )}

      {/* ── Body: Lorebook tab ──────────────────────────── */}
      {subtab === 'lorebook' && (
        <div className={styles.lorebookPlaceholder}>
          {/* Plan 05 replaces this with <LorebookTab /> */}
          <p>Lorebook editor coming in next plan.</p>
        </div>
      )}
    </div>
  );
}
