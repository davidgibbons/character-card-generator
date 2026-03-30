import { useState } from 'react';
import ProgressBar from '../common/ProgressBar';
import useGenerationStore from '../../stores/useGenerationStore';
import { apiHandler } from '../../services/api';
import { storageClient } from '../../services/storage';
import { pngEncoder } from '../../services/pngEncoder';
import styles from './ActionBar.module.css';

/**
 * uiPhase state machine:
 *   'idle'          — no character, not generating
 *   'generating'    — isGenerating=true (generate, evaluate, or revise in progress)
 *   'has-character' — character present, not generating, no eval feedback
 *   'has-eval'      — character present, evalFeedback present
 */
function deriveUiPhase(isGenerating, character, evalFeedback) {
  if (isGenerating) return 'generating';
  if (evalFeedback) return 'has-eval';
  if (character) return 'has-character';
  return 'idle';
}

export default function ActionBar() {
  const isGenerating = useGenerationStore((s) => s.isGenerating);
  const character = useGenerationStore((s) => s.character);
  const evalFeedback = useGenerationStore((s) => s.evalFeedback);
  const reviseInstruction = useGenerationStore((s) => s.reviseInstruction);
  const [evalError, setEvalError] = useState('');
  const [reviseError, setReviseError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [saveError, setSaveError] = useState('');

  const uiPhase = deriveUiPhase(isGenerating, character, evalFeedback);

  async function createBlankPng() {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 400);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async function handleStop() {
    apiHandler.stopGeneration();
    useGenerationStore.getState().abort();
  }

  async function handleEvaluate() {
    const char = useGenerationStore.getState().character;
    if (!char) return;
    setEvalError('');

    useGenerationStore.getState().setGenerating(true, null);
    try {
      const feedback = await apiHandler.evaluateCard(char);
      useGenerationStore.getState().setEvalFeedback(feedback);
      useGenerationStore.getState().setGenerating(false, null);
    } catch (err) {
      console.error('Evaluation failed:', err);
      setEvalError('Evaluation failed. Check your API settings and try again.');
      useGenerationStore.getState().setGenerating(false, null);
    }
  }

  async function handleRevise() {
    const store = useGenerationStore.getState();
    const current = store.character;
    const instruction = store.reviseInstruction;
    const locked = store.lockedFields;  // { fieldKey: boolean }

    if (!current) return;
    setReviseError('');

    // Mask locked fields before sending to reviseCharacter
    const charForRevision = { ...current };
    Object.keys(locked).forEach((field) => {
      if (locked[field]) charForRevision[field] = '[LOCKED - DO NOT MODIFY]';
    });

    store.setGenerating(true, null);
    // Clear eval feedback before revise
    store.setEvalFeedback(null);

    try {
      // reviseCharacter is NON-STREAMING — waits for full JSON response
      const revised = await apiHandler.reviseCharacter(charForRevision, instruction);

      // Merge: only update non-locked fields
      const merged = { ...current };
      Object.keys(revised).forEach((field) => {
        if (!locked[field]) {
          merged[field] = revised[field];
        }
      });
      store.setCharacter(merged);
    } catch (err) {
      console.error('Revision failed:', err);
      setReviseError('Generation failed. Check your API settings and try again.');
      store.setGenerating(false, null);
    }
  }

  function handleReviseInstructionChange(e) {
    useGenerationStore.getState().setReviseInstruction(e.target.value);
  }

  async function handleSave() {
    const char = useGenerationStore.getState().character;
    if (!char) return;
    setSaveError('');
    setSaveStatus('saving');
    try {
      await storageClient.saveCard({
        characterName: char.name,
        character: char,
        imageBlob: useGenerationStore.getState().imageBlob,
      });
      useGenerationStore.getState().setDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setSaveError('Save failed. Check the server connection and try again.');
    }
  }

  function handleDownloadJson() {
    const char = useGenerationStore.getState().character;
    if (!char) return;
    const json = JSON.stringify(char, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${char.name || 'character'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async function handleDownloadPng() {
    const char = useGenerationStore.getState().character;
    if (!char) return;
    try {
      let blob = useGenerationStore.getState().imageBlob;
      if (!blob) {
        blob = await createBlankPng();
      }
      const pngBlob = await pngEncoder.createCharacterCard(blob, char);
      pngEncoder.downloadCharacterCard(pngBlob, char.name || 'character');
    } catch (err) {
      console.error('PNG download failed:', err);
    }
  }

  const hasCharacter = character !== null;
  const firstGeneration = !hasCharacter;

  return (
    <div className={styles.actionBar}>
      <div className={styles.mainRow}>
        <div className={styles.btnGroup}>
          {/* Generate / Regenerate button — hidden during generating */}
          {uiPhase !== 'generating' && (
            <button
              className={hasCharacter ? `btn-outline ${styles.btn}` : `btn-primary ${styles.btn}`}
              onClick={() => window.dispatchEvent(new CustomEvent('gsd:generate'))}
            >
              {firstGeneration ? 'Generate Character' : 'Regenerate'}
            </button>
          )}

          {/* Stop button — only during generating */}
          {uiPhase === 'generating' && (
            <button
              className={`btn-stop ${styles.btn} ${styles.stopBtn}`}
              onClick={handleStop}
            >
              Stop
            </button>
          )}

          {/* Evaluate button — hidden during generating */}
          {uiPhase !== 'generating' && (
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={handleEvaluate}
              disabled={!hasCharacter}
              style={{ opacity: !hasCharacter ? 0.64 : 1, cursor: !hasCharacter ? 'not-allowed' : 'pointer' }}
            >
              Evaluate
            </button>
          )}

          {/* Revise button — hidden during generating */}
          {uiPhase !== 'generating' && (
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={handleRevise}
              disabled={!hasCharacter}
              style={{ opacity: !hasCharacter ? 0.64 : 1, cursor: !hasCharacter ? 'not-allowed' : 'pointer' }}
            >
              Revise
            </button>
          )}
        </div>

        {/* Export button group — only when not streaming */}
        {uiPhase !== 'generating' && (
          <div className={`${styles.btnGroup} ${styles.exportGroup}`}>
            <button
              className={`btn-primary ${styles.btn} ${saveStatus === 'saved' ? styles.saveSuccess : ''}`}
              onClick={handleSave}
              disabled={!hasCharacter}
              style={{ opacity: !hasCharacter ? 0.64 : 1, cursor: !hasCharacter ? 'not-allowed' : 'pointer' }}
            >
              {saveStatus === 'saving' ? 'Saving\u2026' : saveStatus === 'saved' ? 'Saved' : 'Save Card'}
            </button>
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={handleDownloadJson}
              disabled={!hasCharacter}
              style={{ opacity: !hasCharacter ? 0.64 : 1, cursor: !hasCharacter ? 'not-allowed' : 'pointer' }}
            >
              Download JSON
            </button>
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={handleDownloadPng}
              disabled={!hasCharacter}
              style={{ opacity: !hasCharacter ? 0.64 : 1, cursor: !hasCharacter ? 'not-allowed' : 'pointer' }}
            >
              Download PNG
            </button>
          </div>
        )}

        <ProgressBar active={isGenerating} />
      </div>

      {/* Revision instruction textarea — visible after evaluate */}
      {(uiPhase === 'has-eval') && (
        <div className={styles.reviseRow}>
          <label className={styles.reviseLabel}>Revision instruction</label>
          <textarea
            className={`textarea ${styles.reviseTextarea}`}
            value={reviseInstruction}
            onChange={handleReviseInstructionChange}
            placeholder="Describe what to change… (pre-filled from evaluation)"
          />
        </div>
      )}

      {/* Error display */}
      {(evalError || reviseError || saveError) && (
        <div className={styles.errorMsg}>{evalError || reviseError || saveError}</div>
      )}
    </div>
  );
}
