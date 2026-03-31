import { useState } from 'react';
import ProgressBar from '../common/ProgressBar';
import useGenerationStore from '../../stores/useGenerationStore';
import useConfigStore from '../../stores/configStore';
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

export default function ActionBar({ activeTab = 'create' }) {
  const isGenerating = useGenerationStore((s) => s.isGenerating);
  const character = useGenerationStore((s) => s.character);
  const evalFeedback = useGenerationStore((s) => s.evalFeedback);
  const reviseInstruction = useGenerationStore((s) => s.reviseInstruction);
  const [evalError, setEvalError] = useState('');
  const [reviseError, setReviseError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [saveError, setSaveError] = useState('');
  const [pushStatus, setPushStatus] = useState('idle'); // 'idle' | 'pushing' | 'done' | 'error'
  const [pushError, setPushError] = useState('');

  const uiPhase = deriveUiPhase(isGenerating, character, evalFeedback);

  async function blobToBase64(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

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
      const evalFeedbackState = useGenerationStore.getState().evalFeedback;
      const charToSave = evalFeedbackState?.overallScore != null
        ? { ...char, qualityScore: evalFeedbackState.overallScore }
        : char;
      await storageClient.saveCard({
        characterName: char.name,
        character: charToSave,
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

  async function handlePush() {
    const { character: char, imageBlob } = useGenerationStore.getState();
    if (!char) return;

    // Read ST URL and password from configStore (live, not from draft)
    const stUrl = useConfigStore.getState().get('api.sillytavern.url');
    const stPassword = useConfigStore.getState().get('api.sillytavern.password');

    if (!stUrl) {
      setPushError('SillyTavern URL not configured. Open Settings to set it.');
      return;
    }

    setPushError('');
    setPushStatus('pushing');
    try {
      const fileName = `${char.name || 'character'}.png`;
      let body;
      if (imageBlob) {
        const pngBlob = await pngEncoder.createCharacterCard(imageBlob, char);
        const imageBase64 = await blobToBase64(pngBlob);
        body = { imageBase64, fileName };
      } else {
        body = { characterJson: char, fileName };
      }
      const r = await fetch('/api/st/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ST-URL': stUrl,
          'X-ST-Password': stPassword || '',
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      setPushStatus('done');
      setTimeout(() => setPushStatus('idle'), 2000);
    } catch (err) {
      console.error('ST push failed:', err);
      setPushError('Push failed. Verify the SillyTavern URL in Settings and try again.');
      setPushStatus('idle');
    }
  }

  const hasCharacter = character !== null;
  const firstGeneration = !hasCharacter;

  return (
    <div className={styles.actionBar}>
      <div className={styles.mainRow}>
        <div className={styles.btnGroup}>
          {/* Stop button — only during generating (all tabs) */}
          {uiPhase === 'generating' && (
            <button
              className={`btn-stop ${styles.btn} ${styles.stopBtn}`}
              onClick={handleStop}
            >
              Stop
            </button>
          )}

          {/* Create tab: Generate Character (first gen) or Regenerate */}
          {uiPhase !== 'generating' && activeTab === 'create' && (
            <button
              className={hasCharacter ? `btn-outline ${styles.btn}` : `btn-primary ${styles.btn}`}
              onClick={() => window.dispatchEvent(new CustomEvent('gsd:generate'))}
            >
              {firstGeneration ? 'Generate Character' : 'Regenerate'}
            </button>
          )}

          {/* Edit tab: Regenerate only */}
          {uiPhase !== 'generating' && activeTab === 'edit' && (
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={() => window.dispatchEvent(new CustomEvent('gsd:generate'))}
              disabled={!hasCharacter}
              style={{ opacity: !hasCharacter ? 0.64 : 1, cursor: !hasCharacter ? 'not-allowed' : 'pointer' }}
            >
              Regenerate
            </button>
          )}

          {/* Evaluate tab: Evaluate button */}
          {uiPhase !== 'generating' && activeTab === 'evaluate' && (
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={handleEvaluate}
              disabled={!hasCharacter}
              style={{ opacity: !hasCharacter ? 0.64 : 1, cursor: !hasCharacter ? 'not-allowed' : 'pointer' }}
            >
              Evaluate
            </button>
          )}

          {/* Revise button — Edit and Evaluate tabs only */}
          {uiPhase !== 'generating' && (activeTab === 'edit' || activeTab === 'evaluate') && (
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

        {/* Export button group — always visible when character exists (any tab) */}
        {uiPhase !== 'generating' && hasCharacter && (
          <div className={`${styles.btnGroup} ${styles.exportGroup}`}>
            <button
              className={`btn-primary ${styles.btn} ${saveStatus === 'saved' ? styles.saveSuccess : ''}`}
              onClick={handleSave}
            >
              {saveStatus === 'saving' ? 'Saving\u2026' : saveStatus === 'saved' ? 'Saved' : 'Save Card'}
            </button>
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={handleDownloadJson}
            >
              Download JSON
            </button>
            <button
              className={`btn-outline ${styles.btn}`}
              onClick={handleDownloadPng}
            >
              Download PNG
            </button>
            <button
              className={`btn-outline ${styles.btn} ${pushStatus === 'done' ? styles.pushSuccess : ''}`}
              onClick={handlePush}
              disabled={pushStatus === 'pushing'}
              style={{ cursor: pushStatus === 'pushing' ? 'not-allowed' : 'pointer' }}
            >
              {pushStatus === 'pushing' ? 'Pushing\u2026' : pushStatus === 'done' ? 'Pushed \u2713' : 'Push to ST'}
            </button>
          </div>
        )}

        <ProgressBar active={isGenerating} />
      </div>

      {/* Revision instruction textarea — visible when has-eval phase, any tab */}
      {uiPhase === 'has-eval' && (
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
      {(evalError || reviseError || saveError || pushError) && (
        <div className={styles.errorMsg}>{evalError || reviseError || saveError || pushError}</div>
      )}
    </div>
  );
}
