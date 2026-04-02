import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const LOCAL_STORAGE_KEY = 'charGeneratorConfig';

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

      // Save config -- triggers persist middleware to write to localStorage
      saveConfig: () => {
        set((state) => ({ ...state }));
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

      // Clear all stored config
      clearStoredConfig: () => {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
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
        const { api, app, prompts } = state;
        const sanitizedApi = JSON.parse(JSON.stringify(api));
        // Only persist API keys when the user has opted in via "Persist API Keys"
        if (!app.persistApiKeys) {
          sanitizedApi.text.apiKey = '';
          sanitizedApi.image.apiKey = '';
          sanitizedApi.sillytavern.password = '';
        }
        return { api: sanitizedApi, app, prompts };
      },
    },
  ),
);

// Non-React accessor for service modules
export const configStore = {
  get: (path) => useConfigStore.getState().get(path),
  set: (path, value) => useConfigStore.getState().set(path, value),
  getState: () => useConfigStore.getState(),
};

export { useConfigStore };
export default useConfigStore;
