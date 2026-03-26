<!-- GSD:project-start source:PROJECT.md -->
## Project

**Character Card Generator — Code Quality Refactor**

A self-hosted web app for generating SillyTavern-compatible AI character cards using LLM APIs. Users describe a character concept, the app generates structured character profiles via streaming LLM calls, supports image generation, and exports cards as V2-spec PNG files with embedded metadata. Includes a git-backed card/prompt library and SillyTavern push/pull sync.

**Core Value:** Modernize the frontend architecture to React + Vite so the codebase is maintainable, extensible, and uses established libraries instead of hand-rolled solutions.

### Constraints

- **Feature parity**: Every existing capability must work after migration — no regressions
- **Deployment model**: Single Docker container serving both API and static assets
- **Backend unchanged**: Express proxy server (`proxy/`) stays CommonJS Node.js — only frontend migrates
- **No new features**: This is a refactor milestone, not a feature milestone
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES6+ classes, async/await) - Used for both frontend and backend
- HTML5 - Single-page application UI (`index.html`)
- CSS3 - Custom properties, modern layout (`src/styles/main.css`)
## Runtime
- Node.js >= 18.0.0 (specified in `package.json` engines field)
- Docker image uses `node:20-alpine` (`Dockerfile`)
- npm
- Lockfile: `package-lock.json` present at root and `proxy/package-lock.json`
## Frameworks
- Express ^4.18.2 - Backend proxy server (`proxy/server.js`)
- No frontend framework - Vanilla JS with class-based modules loaded via `<script>` tags
- http-server ^14.1.1 - Static file serving for development (`package.json` devDependencies)
- concurrently ^8.2.2 - Runs proxy server and frontend dev server in parallel (`package.json` devDependencies)
- nodemon ^3.0.1 - Auto-restart proxy server during development (`proxy/package.json` devDependencies)
- None detected - No test framework, no test files, no test scripts
## Key Dependencies
- `express` ^4.18.2 - HTTP server and API routing
- `cors` ^2.8.5 - Cross-origin resource sharing middleware
- `compression` ^1.8.1 - Gzip response compression
- `dotenv` ^16.3.1 - Environment variable loading from `.env`
- `form-data` ^4.0.0 - Multipart form construction for SillyTavern uploads
- `simple-git` ^3.33.0 - Git operations for version-controlled card/prompt storage
- `diff` 7.0.0 - Text diffing library loaded from jsDelivr CDN (`index.html` line 820)
- `tributejs` 5.1.3 - @mention autocomplete library loaded from jsDelivr CDN (`index.html` lines 821-822)
- Fetch API - All HTTP requests (no axios/other HTTP client)
- Canvas API - Image processing in `src/scripts/image-generator.js`
- localStorage/sessionStorage - Config and API key persistence (`src/scripts/config.js`)
- TextEncoder/btoa - PNG metadata encoding (`src/scripts/png-encoder.js`)
## Configuration
- `.env.example` present with documented variables
- `dotenv` loads `.env` from project root in proxy server
- Config class in `src/scripts/config.js` manages all frontend settings via localStorage/sessionStorage
- `PORT` - Server port (default: 2426)
- `DATA_DIR` - Persistent storage directory (default: `/data` in Docker, `proxy/cards/` locally)
- `GIT_AUTHOR_NAME` - Git identity for card version history
- `GIT_AUTHOR_EMAIL` - Git identity for card version history
- No build process - Static site with vanilla JS (`"build": "echo 'No build process needed for this static site'"`)
- Cache-busting via manual query string versioning on script/CSS tags (e.g., `?v=20260325a`)
## Platform Requirements
- Node.js >= 18.0.0
- npm
- Git (for card storage versioning)
- Run `npm start` to launch both proxy (port 2426) and frontend dev server (port 2427)
- Or `npm run dev` for auto-restart with nodemon
- Docker with `docker-compose.yml`
- Single container: `node:20-alpine` base image
- Single port: 2426 (proxy serves both API and static files)
- Named volume `cards-data` for persistent card/prompt storage at `/data`
- Health check: `GET /health` endpoint
## Architecture Notes
- **No build step, no bundler, no transpiler** - All JS is served as-is to the browser
- **No TypeScript** - Pure JavaScript throughout
- **No frontend framework** - DOM manipulation via `document.getElementById()` and innerHTML
- **Class-based module pattern** - Each JS file exports a singleton via `window.moduleName = new ClassName()`
- **Script loading order matters** - Scripts loaded sequentially in `index.html` (lines 398-824)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

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
### Lazy Dependencies
### Config Access
### DOM Interaction
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
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Overall Pattern
```
```
## Module System
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
## Data Flow
### Character Generation
### Card Persistence
### Image Generation
## Backend Architecture
- Static file serving (frontend)
- API proxy routes (text, image, SillyTavern)
- Card CRUD router (`proxy/cards.js`) — git-backed filesystem
- Prompt CRUD router (`proxy/prompts.js`) — git-backed filesystem
- Security headers middleware
- CORS + compression middleware
## Key Design Decisions
## Component Boundaries
- **Frontend knows nothing about external APIs** — all requests go through the local proxy
- **Proxy knows nothing about character card format** — it stores/retrieves opaque JSON
- **Config lives entirely in browser** — localStorage for settings, sessionStorage for API keys (opt-in localStorage persistence)
- **Prompts are client-side** — `src/scripts/prompts.js` contains all LLM prompt templates; server stores user prompt overrides
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
