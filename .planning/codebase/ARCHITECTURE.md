# Architecture

**Analysis Date:** 2026-03-26

## Overall Pattern

**Client-Server with Proxy Pattern.** The app is a vanilla JS single-page application served as static files, with an Express proxy server that forwards API requests to external LLM/image services. The proxy avoids CORS issues and keeps API keys out of direct browser-to-API traffic.

```
Browser (vanilla JS)  -->  Express Proxy (port 2426)  -->  External APIs (LLM, Image, SillyTavern)
                                  |
                           Filesystem (git-backed card/prompt storage)
```

## Module System

**Window-global singletons.** Each frontend JS file defines a class and attaches one instance to `window`:

| Module | Global | Role |
|--------|--------|------|
| `config.js` | `window.config` | Settings management (localStorage/sessionStorage) |
| `api.js` | `window.apiHandler` | HTTP client for proxy endpoints, streaming support |
| `character-generator.js` | `window.characterGenerator` | Character generation orchestration + parsing |
| `image-generator.js` | `window.imageGenerator` | Image generation via LLM or SD API |
| `png-encoder.js` | `window.pngEncoder` | PNG metadata embedding (V2 character cards) |
| `storage-server.js` | `window.characterStorage` | REST client for card/prompt CRUD |
| `prompts.js` | `window.getPrompt` (function) | Prompt template registry |
| `mention-autocomplete.js` | `MentionAutocomplete` (class) | @mention pills in textareas via Tribute.js |
| `main.js` | `window.app` | Main controller — UI events, tabs, generation flow |

Scripts are loaded via `<script>` tags in `index.html` in dependency order. No module bundler or import system.

## Data Flow

### Character Generation
1. User enters concept in UI textarea (may include @mentions to library cards)
2. `main.js` calls `characterGenerator.generateCharacter()` with concept + options
3. `character-generator.js` delegates to `apiHandler.generateCharacter()`
4. `api.js` sends POST to proxy `/api/text/chat/completions` with streaming
5. Proxy forwards to external LLM API (OpenAI-compatible)
6. Response streamed back, parsed into character fields by regex patterns
7. Character displayed in editable form, can be revised/evaluated

### Card Persistence
1. User saves card from UI
2. `main.js` calls `storage.saveCard()` via `ServerBackedStorage`
3. REST call to `/api/cards/{slug}`
4. `proxy/cards.js` writes `card.json` to filesystem and git-commits

### Image Generation
1. `api.js` generates an image prompt via LLM
2. Sends to `/api/image/generations` proxy endpoint
3. Proxy auto-detects SD API vs OpenAI-compatible endpoint
4. Returns image URL or base64 data

## Backend Architecture

**Express app** (`proxy/server.js`) with:
- Static file serving (frontend)
- API proxy routes (text, image, SillyTavern)
- Card CRUD router (`proxy/cards.js`) — git-backed filesystem
- Prompt CRUD router (`proxy/prompts.js`) — git-backed filesystem
- Security headers middleware
- CORS + compression middleware

## Key Design Decisions

1. **No build step** — All JS served as-is. Cache-busting via manual query string versioning.
2. **Proxy pattern** — Keeps API keys in browser only, forwarded per-request via headers. Server never stores them.
3. **Git-backed storage** — Card/prompt persistence uses `simple-git` for version history. Enables diff/history features.
4. **OpenAI-compatible API** — Works with any API following OpenAI's chat completions spec (OpenRouter, local LLMs, etc.).
5. **Dual image API** — Auto-detects A1111/KoboldCpp SD API vs OpenAI image API based on URL patterns.
6. **Single-container deployment** — One Docker container serves both proxy and static files.

## Component Boundaries

- **Frontend knows nothing about external APIs** — all requests go through the local proxy
- **Proxy knows nothing about character card format** — it stores/retrieves opaque JSON
- **Config lives entirely in browser** — localStorage for settings, sessionStorage for API keys (opt-in localStorage persistence)
- **Prompts are client-side** — `src/scripts/prompts.js` contains all LLM prompt templates; server stores user prompt overrides

---

*Architecture analysis: 2026-03-26*
