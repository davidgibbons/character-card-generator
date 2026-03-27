import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import ApiSettings from './ApiSettings';
import AppSettings from './AppSettings';
import useConfigStore from '../../stores/configStore';
import styles from './SettingsModal.module.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const state = useConfigStore.getState();
      setDraft({
        api: JSON.parse(JSON.stringify(state.api)),
        app: { ...state.app },
        prompts: { ...state.prompts },
      });
    }
  }, [isOpen]);

  function updateDraft(path, value) {
    setDraft((prev) => {
      const next = {
        api: JSON.parse(JSON.stringify(prev.api)),
        app: { ...prev.app },
        prompts: { ...prev.prompts },
      };
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => obj[key], next);
      target[lastKey] = value;
      return next;
    });
  }

  function handleSave() {
    const originalPersistApiKeys = useConfigStore.getState().app.persistApiKeys;
    const storeSet = useConfigStore.getState().set;

    // Text API fields
    storeSet('api.text.baseUrl', draft.api.text.baseUrl);
    storeSet('api.text.apiKey', draft.api.text.apiKey);
    storeSet('api.text.model', draft.api.text.model);
    storeSet('api.text.visionModel', draft.api.text.visionModel);
    storeSet('api.text.timeout', draft.api.text.timeout);

    // Image API fields
    storeSet('api.image.baseUrl', draft.api.image.baseUrl);
    storeSet('api.image.apiKey', draft.api.image.apiKey);
    storeSet('api.image.model', draft.api.image.model);
    storeSet('api.image.size', draft.api.image.size);
    storeSet('api.image.timeout', draft.api.image.timeout);

    // SillyTavern fields
    storeSet('api.sillytavern.url', draft.api.sillytavern.url);
    storeSet('api.sillytavern.password', draft.api.sillytavern.password);

    // App fields
    storeSet('app.debugMode', draft.app.debugMode);
    storeSet('app.persistApiKeys', draft.app.persistApiKeys);
    storeSet('app.enableImageGeneration', draft.app.enableImageGeneration);
    storeSet('app.maxRetries', draft.app.maxRetries);
    storeSet('app.retryDelay', draft.app.retryDelay);

    // Prompts fields
    storeSet('prompts.contentPolicyPrefix', draft.prompts.contentPolicyPrefix);

    // Persist all changes
    useConfigStore.getState().saveConfig();

    // If persistApiKeys changed, migrate keys between storage types
    if (draft.app.persistApiKeys !== originalPersistApiKeys) {
      useConfigStore.getState().updateStorageMethod();
    }

    onClose();
  }

  function handleCancel() {
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Settings">
      {draft && (
        <>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>API Configuration</div>
            <ApiSettings draft={draft} updateDraft={updateDraft} />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>App Settings</div>
            <AppSettings draft={draft} updateDraft={updateDraft} />
          </div>
          <div className={styles.footer}>
            <button className="btn-outline" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
