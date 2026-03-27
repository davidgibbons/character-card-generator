# Code Conventions

**Analysis Date:** 2026-03-26

## Naming Conventions

### Files
- **Lowercase with hyphens**: `character-generator.js`, `storage-server.js`, `mention-autocomplete.js`
- **Single-word where possible**: `config.js`, `prompts.js`

### JavaScript
- **Classes**: PascalCase — `CharacterGenerator`, `APIHandler`, `ServerBackedStorage`, `PNGEncoder`
- **Methods/Functions**: camelCase — `generateCharacter()`, `parseCharacterData()`, `makeRequest()`
- **Constants**: SCREAMING_SNAKE_CASE — `LOCAL_STORAGE_KEY`, `SESSION_STORAGE_KEYS`, `PROMPT_REGISTRY`, `CARDS_DIR`
- **Private-ish methods**: underscore prefix — `_promptSlug()`, `_replaceWithEditable()`, `_cache`, `_cacheTime`
- **Boolean variables**: `is`/`has` prefix or descriptive — `isGenerating`, `isImageRequest`, `storageReady`, `userStopRequested`
- **DOM element references**: named after their element ID — `const textBaseUrl = document.getElementById("text-api-base")`

### CSS
- **Classes**: lowercase with hyphens — `.tab-btn`, `.character-section`, `.mention-pill`, `.split-pane`
- **CSS custom properties**: `--var-name` pattern — standard CSS custom property conventions
- **IDs**: lowercase with hyphens — `#text-api-base`, `#character-concept`, `#persist-api-keys`

### HTML
- **IDs**: lowercase with hyphens, descriptive — `text-api-base`, `character-concept`, `enable-image-generation`
- **Data attributes**: `data-tab`, `data-subtab`

## Code Style Patterns

### Module Pattern
Every frontend JS file follows the same pattern:
```javascript
class ClassName {
  constructor() {
    // Initialize properties
    this.config = window.config;
    // ...
  }
  // Methods...
}
window.globalName = new ClassName();
```

### Lazy Dependencies
Circular dependency avoidance via lazy getters:
```javascript
get apiHandlerInstance() {
  if (!this.apiHandler) {
    this.apiHandler = window.apiHandler;
  }
  return this.apiHandler;
}
```

### Config Access
Dot-path string access pattern:
```javascript
this.config.get("api.text.baseUrl")
this.config.set("app.debugMode", true)
```

### DOM Interaction
Direct `document.getElementById()` and `document.querySelector()` calls. No abstraction layer:
```javascript
const textBaseUrl = document.getElementById("text-api-base")?.value?.trim();
```

### Error Handling
- `try/catch` around all async operations
- Errors logged with `console.error()` and re-thrown
- User-facing errors displayed via status elements or alert-style UI
- No global error boundary

### Async Patterns
- `async/await` throughout (no raw Promises or callbacks)
- `AbortController` for cancellable requests
- `setTimeout` for DOM readiness delays

## Comment Patterns
- Section separators: `// ── Section Name ──────────────────────`
- Inline explanatory comments for non-obvious logic
- JSDoc-style `/** */` used sparingly (mostly on `api.js` methods)
- No comprehensive JSDoc documentation

## Import Patterns

### Frontend
- No imports — all dependencies via `window` globals
- CDN libraries loaded via `<script>` tags in `index.html`

### Backend (Node.js)
- CommonJS `require()` — `const express = require("express")`
- Destructured imports where applicable — `const { router: cardsRouter, initGit } = require("./cards")`

## Error Response Format (Backend)
Consistent error JSON structure:
```json
{
  "error": {
    "code": "400",
    "message": "Human-readable message",
    "details": "Technical details or upstream error text"
  }
}
```

---

*Conventions analysis: 2026-03-26*
