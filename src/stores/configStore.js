import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const LOCAL_STORAGE_KEY = 'charGeneratorConfig';
const SESSION_STORAGE_KEYS = {
  textApiKey: 'charGeneratorConfig:textApiKey',
  imageApiKey: 'charGeneratorConfig:imageApiKey',
  stPassword: 'charGeneratorConfig:stPassword',
};

function getDefaultConfig() {
  return {
    api: {
      text: { baseUrl: '', apiKey: '', model: '', visionModel: '', timeout: 180000 },
      image: { baseUrl: '', apiKey: '', model: '', size: '', timeout: 180000 },
      sillytavern: { url: '', password: '' },
    },
    app: { maxRetries: 3, retryDelay: 1000, debugMode: false, persistApiKeys: false, enableImageGeneration: true },
    prompts: { contentPolicyPrefix: false, overrides: {} },
  };
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, key) => o && o[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((o, key) => {
    if (!o[key]) o[key] = {};
    return o[key];
  }, obj);
  target[lastKey] = value;
}

// ── Session/localStorage helpers for sensitive values ──────────────────────

function persistSessionValue(key, value) {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('Unable to persist sensitive config to sessionStorage:', error);
  }
}

function persistLocalStorageValue(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('Unable to persist sensitive config to localStorage:', error);
  }
}

function getSessionValue(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    console.warn('Unable to read sensitive config from sessionStorage:', error);
    return null;
  }
}

function getLocalStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('Unable to read sensitive config from localStorage:', error);
    return null;
  }
}

// ── Zustand store ──────────────────────────────────────────────────────────

const useConfigStore = create(
  persist(
    (set, get) => ({
      ...getDefaultConfig(),
      debugMode: false,

      // Dot-notation getter: configStore.get('api.text.baseUrl')
      get: (path) => {
        const state = get();
        return getNestedValue(state, path);
      },

      // Dot-notation setter: configStore.set('api.text.baseUrl', 'http://...')
      set: (path, value) => {
        set((state) => {
          const newState = JSON.parse(JSON.stringify({
            api: state.api,
            app: state.app,
            prompts: state.prompts,
            debugMode: state.debugMode,
          }));
          setNestedValue(newState, path, value);
          return newState;
        });
        // Persist sensitive values after any set
        const state = get();
        persistSensitiveValues(state);
      },

      // Validate config -- returns string[] of errors
      validateConfig: () => {
        const state = get();
        const errors = [];
        if (!state.api.text.baseUrl) errors.push('Text API base URL is required');
        if (!state.api.text.apiKey) errors.push('Text API key is required');
        if (!state.api.text.model) errors.push('Text model is required');
        return errors;
      },

      // Save config -- triggers persist and sensitive value storage
      saveConfig: () => {
        // Trigger a no-op state update to force persist middleware to write
        set((state) => ({ ...state }));
        const state = get();
        persistSensitiveValues(state);
      },

      // Set debug mode
      setDebugMode: (enabled) => {
        set({ debugMode: enabled, app: { ...get().app, debugMode: enabled } });
        console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
      },

      getDebugMode: () => {
        const state = get();
        return state.debugMode || state.app.debugMode || false;
      },

      log: (...args) => {
        if (get().debugMode || get().app.debugMode) {
          console.log(...args);
        }
      },

      // Persist sensitive values to session or localStorage
      persistSensitiveValues: () => {
        const state = get();
        persistSensitiveValues(state);
      },

      // Restore sensitive values from session or localStorage
      restoreSensitiveValues: () => {
        const state = get();
        const updates = {};
        let changed = false;

        if (state.app.persistApiKeys) {
          const textKey = getLocalStorageValue(SESSION_STORAGE_KEYS.textApiKey);
          const imageKey = getLocalStorageValue(SESSION_STORAGE_KEYS.imageApiKey);
          const stPwd = getLocalStorageValue(SESSION_STORAGE_KEYS.stPassword);

          if (textKey !== null) {
            updates.textApiKey = textKey;
            changed = true;
          }
          if (imageKey !== null) {
            updates.imageApiKey = imageKey;
            changed = true;
          }
          if (stPwd !== null) {
            updates.stPassword = stPwd;
            changed = true;
          }
        } else {
          const textKey = getSessionValue(SESSION_STORAGE_KEYS.textApiKey);
          const imageKey = getSessionValue(SESSION_STORAGE_KEYS.imageApiKey);
          const stPwd = getSessionValue(SESSION_STORAGE_KEYS.stPassword);

          if (textKey !== null) {
            updates.textApiKey = textKey;
            changed = true;
          }
          if (imageKey !== null) {
            updates.imageApiKey = imageKey;
            changed = true;
          }
          if (stPwd !== null) {
            updates.stPassword = stPwd;
            changed = true;
          }
        }

        if (changed) {
          set((state) => {
            const api = JSON.parse(JSON.stringify(state.api));
            if (updates.textApiKey !== undefined) api.text.apiKey = updates.textApiKey;
            if (updates.imageApiKey !== undefined) api.image.apiKey = updates.imageApiKey;
            if (updates.stPassword !== undefined) api.sillytavern.password = updates.stPassword;
            return { api };
          });
        }
      },

      // Update storage method when persistApiKeys changes
      updateStorageMethod: () => {
        const state = get();
        if (state.app.persistApiKeys) {
          // Move from sessionStorage to localStorage
          const textKey = getSessionValue(SESSION_STORAGE_KEYS.textApiKey);
          const imageKey = getSessionValue(SESSION_STORAGE_KEYS.imageApiKey);
          const stPwd = getSessionValue(SESSION_STORAGE_KEYS.stPassword);

          if (textKey) {
            persistLocalStorageValue(SESSION_STORAGE_KEYS.textApiKey, textKey);
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.textApiKey);
          }
          if (imageKey) {
            persistLocalStorageValue(SESSION_STORAGE_KEYS.imageApiKey, imageKey);
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.imageApiKey);
          }
          if (stPwd) {
            persistLocalStorageValue(SESSION_STORAGE_KEYS.stPassword, stPwd);
            sessionStorage.removeItem(SESSION_STORAGE_KEYS.stPassword);
          }
        } else {
          // Move from localStorage to sessionStorage
          const textKey = getLocalStorageValue(SESSION_STORAGE_KEYS.textApiKey);
          const imageKey = getLocalStorageValue(SESSION_STORAGE_KEYS.imageApiKey);
          const stPwd = getLocalStorageValue(SESSION_STORAGE_KEYS.stPassword);

          if (textKey) {
            persistSessionValue(SESSION_STORAGE_KEYS.textApiKey, textKey);
            localStorage.removeItem(SESSION_STORAGE_KEYS.textApiKey);
          }
          if (imageKey) {
            persistSessionValue(SESSION_STORAGE_KEYS.imageApiKey, imageKey);
            localStorage.removeItem(SESSION_STORAGE_KEYS.imageApiKey);
          }
          if (stPwd) {
            persistSessionValue(SESSION_STORAGE_KEYS.stPassword, stPwd);
            localStorage.removeItem(SESSION_STORAGE_KEYS.stPassword);
          }
        }
      },

      // Clear all stored config
      clearStoredConfig: () => {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        Object.values(SESSION_STORAGE_KEYS).forEach((key) => {
          try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
        });
        Object.values(SESSION_STORAGE_KEYS).forEach((key) => {
          try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        });
      },

      // Redact sensitive data for logging
      redactSensitiveData: (data) => {
        if (Array.isArray(data)) return data.map((item) => get().redactSensitiveData(item));
        if (!isObject(data)) return data;
        const redacted = {};
        Object.keys(data).forEach((key) => {
          if (key.toLowerCase().includes('apikey') || key === 'password') {
            redacted[key] = data[key] ? '[REDACTED]' : '';
          } else {
            redacted[key] = get().redactSensitiveData(data[key]);
          }
        });
        return redacted;
      },

      logRedacted: (message, data) => {
        if (get().getDebugMode()) {
          console.log(message, get().redactSensitiveData(data));
        }
      },
    }),
    {
      name: LOCAL_STORAGE_KEY,
      partialize: (state) => {
        // Exclude sensitive values and methods from localStorage persistence
        const { api, app, prompts } = state;
        const sanitizedApi = JSON.parse(JSON.stringify(api));
        // Strip sensitive values -- they are stored separately
        if (sanitizedApi.text) sanitizedApi.text.apiKey = '';
        if (sanitizedApi.image) sanitizedApi.image.apiKey = '';
        if (sanitizedApi.sillytavern) sanitizedApi.sillytavern.password = '';
        return { api: sanitizedApi, app, prompts };
      },
    },
  ),
);

// Standalone function for persisting sensitive values
function persistSensitiveValues(state) {
  if (state.app.persistApiKeys) {
    persistLocalStorageValue(SESSION_STORAGE_KEYS.textApiKey, state.api.text.apiKey);
    persistLocalStorageValue(SESSION_STORAGE_KEYS.imageApiKey, state.api.image.apiKey);
    persistLocalStorageValue(SESSION_STORAGE_KEYS.stPassword, state.api.sillytavern.password);
  } else {
    persistSessionValue(SESSION_STORAGE_KEYS.textApiKey, state.api.text.apiKey);
    persistSessionValue(SESSION_STORAGE_KEYS.imageApiKey, state.api.image.apiKey);
    persistSessionValue(SESSION_STORAGE_KEYS.stPassword, state.api.sillytavern.password);
  }
}

// Restore sensitive values after hydration from localStorage
// This runs once when the module is loaded in a browser environment
if (typeof window !== 'undefined') {
  // Use onFinishHydration to restore sensitive values after persist middleware loads
  useConfigStore.persist.onFinishHydration(() => {
    useConfigStore.getState().restoreSensitiveValues();
  });
}

// Non-React accessor for service modules
export const configStore = {
  get: (path) => useConfigStore.getState().get(path),
  getState: () => useConfigStore.getState(),
};

export { useConfigStore };
export default useConfigStore;
