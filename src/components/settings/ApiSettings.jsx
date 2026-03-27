import styles from './ApiSettings.module.css';

export default function ApiSettings({ draft, updateDraft }) {
  if (!draft) return null;

  return (
    <div>
      {/* Text API Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeading}>Text API</div>

        <div className={styles.field}>
          <label className={styles.label}>Base URL</label>
          <input
            type="text"
            className={styles.input}
            value={draft.api.text.baseUrl}
            onChange={(e) => updateDraft('api.text.baseUrl', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>API Key</label>
          <input
            type="password"
            className={styles.input}
            value={draft.api.text.apiKey}
            onChange={(e) => updateDraft('api.text.apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Model</label>
          <input
            type="text"
            className={styles.input}
            value={draft.api.text.model}
            onChange={(e) => updateDraft('api.text.model', e.target.value)}
            placeholder="gpt-4o"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Vision Model</label>
          <input
            type="text"
            className={styles.input}
            value={draft.api.text.visionModel}
            onChange={(e) => updateDraft('api.text.visionModel', e.target.value)}
            placeholder="gpt-4o"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Timeout (ms)</label>
          <input
            type="number"
            className={styles.input}
            value={draft.api.text.timeout}
            onChange={(e) => updateDraft('api.text.timeout', parseInt(e.target.value) || 180000)}
          />
        </div>
      </div>

      {/* Image API Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeading}>Image API</div>

        <div className={styles.field}>
          <label className={styles.label}>Base URL</label>
          <input
            type="text"
            className={styles.input}
            value={draft.api.image.baseUrl}
            onChange={(e) => updateDraft('api.image.baseUrl', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>API Key</label>
          <input
            type="password"
            className={styles.input}
            value={draft.api.image.apiKey}
            onChange={(e) => updateDraft('api.image.apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Model</label>
          <input
            type="text"
            className={styles.input}
            value={draft.api.image.model}
            onChange={(e) => updateDraft('api.image.model', e.target.value)}
            placeholder="dall-e-3"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Size</label>
          <input
            type="text"
            className={styles.input}
            value={draft.api.image.size}
            onChange={(e) => updateDraft('api.image.size', e.target.value)}
            placeholder="1024x1024"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Timeout (ms)</label>
          <input
            type="number"
            className={styles.input}
            value={draft.api.image.timeout}
            onChange={(e) => updateDraft('api.image.timeout', parseInt(e.target.value) || 180000)}
          />
        </div>
      </div>

      {/* SillyTavern Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeading}>SillyTavern</div>

        <div className={styles.field}>
          <label className={styles.label}>URL</label>
          <input
            type="text"
            className={styles.input}
            value={draft.api.sillytavern.url}
            onChange={(e) => updateDraft('api.sillytavern.url', e.target.value)}
            placeholder="http://localhost:8000"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <input
            type="password"
            className={styles.input}
            value={draft.api.sillytavern.password}
            onChange={(e) => updateDraft('api.sillytavern.password', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
