import { useState, useEffect } from 'react';
import styles from './ApiSettings.module.css';
import apiHandler from '../../services/api';

export default function ApiSettings({ draft, updateDraft }) {
  if (!draft) return null;

  const [textTimeoutEdit, setTextTimeoutEdit] = useState(
    draft.api.text.timeout != null ? String(draft.api.text.timeout / 1000) : ''
  );
  const [imageTimeoutEdit, setImageTimeoutEdit] = useState(
    draft.api.image.timeout != null ? String(draft.api.image.timeout / 1000) : ''
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [envConfig, setEnvConfig] = useState({
    textApiKey: false, textApiUrl: false, imageApiKey: false, imageApiUrl: false,
  });

  useEffect(() => {
    fetch('/api/env-config')
      .then((r) => r.json())
      .then((data) => setEnvConfig(data))
      .catch(() => {}); // non-fatal — env config is optional
  }, []);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const result = await apiHandler.testConnection({
      baseUrl: draft.api.text.baseUrl,
      apiKey: draft.api.text.apiKey,
      model: draft.api.text.model,
    });
    setTestResult(result);
    setTesting(false);
  }

  function EnvBadge() {
    return <span className={styles.envBadge} title="Set via environment variable">ENV</span>;
  }

  function envInput(value, onChange, placeholder, type = 'text', isEnv = false) {
    if (isEnv) {
      return (
        <div className={styles.envField}>
          <input type={type} className={`${styles.input} ${styles.inputLocked}`}
            value="••••••••••••" readOnly placeholder={placeholder} />
          <EnvBadge />
        </div>
      );
    }
    return (
      <input type={type} autoComplete={type === 'password' ? 'off' : undefined}
        className={styles.input} value={value} onChange={onChange} placeholder={placeholder} />
    );
  }

  return (
    <div>
      {/* Text API Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeading}>Text API</div>

        <div className={styles.field}>
          <label className={styles.label}>Base URL</label>
          {envInput(
            draft.api.text.baseUrl,
            (e) => updateDraft('api.text.baseUrl', e.target.value),
            'https://api.openai.com/v1',
            'text',
            envConfig.textApiUrl,
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>API Key</label>
          {envInput(
            draft.api.text.apiKey,
            (e) => updateDraft('api.text.apiKey', e.target.value),
            'sk-…',
            'password',
            envConfig.textApiKey,
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Model</label>
          <input type="text" className={styles.input}
            value={draft.api.text.model}
            onChange={(e) => updateDraft('api.text.model', e.target.value)}
            placeholder="gpt-4o" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Vision Model</label>
          <input type="text" className={styles.input}
            value={draft.api.text.visionModel}
            onChange={(e) => updateDraft('api.text.visionModel', e.target.value)}
            placeholder="gpt-4o" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Timeout (seconds)</label>
          <input type="number" className={styles.input} value={textTimeoutEdit} min={1}
            onChange={(e) => {
              setTextTimeoutEdit(e.target.value);
              const secs = parseInt(e.target.value, 10);
              if (!isNaN(secs) && secs > 0) updateDraft('api.text.timeout', secs * 1000);
            }}
            onBlur={() => {
              const secs = parseInt(textTimeoutEdit, 10);
              if (isNaN(secs) || secs <= 0) setTextTimeoutEdit(String(draft.api.text.timeout / 1000));
            }} />
        </div>

        <div className={styles.testRow}>
          <button type="button" className={styles.testButton}
            onClick={handleTestConnection} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {testResult && (
            <span className={testResult.success ? styles.testSuccess : styles.testError}>
              {testResult.success
                ? testResult.authMethod ? '✓ Connected (alternative auth)' : '✓ Connected'
                : `✗ ${testResult.error}`}
            </span>
          )}
        </div>
      </div>

      {/* Image API Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeading}>Image API</div>

        <div className={styles.field}>
          <label className={styles.label}>Base URL</label>
          {envInput(
            draft.api.image.baseUrl,
            (e) => updateDraft('api.image.baseUrl', e.target.value),
            'https://api.openai.com/v1',
            'text',
            envConfig.imageApiUrl,
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>API Key</label>
          {envInput(
            draft.api.image.apiKey,
            (e) => updateDraft('api.image.apiKey', e.target.value),
            'sk-…',
            'password',
            envConfig.imageApiKey,
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Model</label>
          <input type="text" className={styles.input}
            value={draft.api.image.model}
            onChange={(e) => updateDraft('api.image.model', e.target.value)}
            placeholder="dall-e-3" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Size</label>
          <input type="text" className={styles.input}
            value={draft.api.image.size}
            onChange={(e) => updateDraft('api.image.size', e.target.value)}
            placeholder="1024x1024" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Timeout (seconds)</label>
          <input type="number" className={styles.input} value={imageTimeoutEdit} min={1}
            onChange={(e) => {
              setImageTimeoutEdit(e.target.value);
              const secs = parseInt(e.target.value, 10);
              if (!isNaN(secs) && secs > 0) updateDraft('api.image.timeout', secs * 1000);
            }}
            onBlur={() => {
              const secs = parseInt(imageTimeoutEdit, 10);
              if (isNaN(secs) || secs <= 0) setImageTimeoutEdit(String(draft.api.image.timeout / 1000));
            }} />
        </div>
      </div>
    </div>
  );
}
