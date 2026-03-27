# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**Text Generation (LLM):**
- Any OpenAI-compatible chat completions API (OpenAI, OpenRouter, local LLMs, etc.)
  - Endpoint: User-configured base URL + `/chat/completions`
  - Auth: Bearer token (falls back to X-API-Key header on 401)
  - Proxy route: `POST /api/text/chat/completions` in `proxy/server.js`
  - Supports streaming (SSE) and non-streaming responses
  - OpenRouter special handling: Adds `HTTP-Referer` and `X-Title` headers when URL contains `openrouter.ai` (`proxy/server.js` lines 150-155)

**Image Generation:**
- OpenAI-compatible image generation API
  - Endpoint: User-configured base URL + `/images/generations`
  - Auth: Bearer token (falls back to X-API-Key on 401)
  - Proxy route: `POST /api/image/generations` in `proxy/server.js`
- A1111 / KoboldCpp Stable Diffusion API (auto-detected)
  - Endpoint: Auto-constructed `/sdapi/v1/txt2img` from base URL
  - Auth: None required for local instances
  - Auto-detected when URL contains `/sdapi`, port 5001, or resolves to localhost/private IP
  - Sampler list: `GET /api/image/samplers` proxy route (`proxy/server.js` line 406)
  - Falls back to OpenAI-style endpoint if SD API returns 404/405/501

**Image Proxy (CORS bypass):**
- `GET /api/proxy-image?url=...` in `proxy/server.js` line 446
  - Fetches remote images server-side to avoid browser CORS restrictions
  - Used by `src/scripts/image-generator.js` for displaying generated images

**SillyTavern Integration:**
- Push/pull character cards to/from a running SillyTavern instance
  - List characters: `POST /api/st/characters` (`proxy/server.js` line 546)
  - Push card: `POST /api/st/push` (`proxy/server.js` line 582)
  - Pull card: `POST /api/st/pull` (`proxy/server.js` line 654)
  - Auth: Basic auth with `user:{password}` + CSRF token exchange
  - CSRF token fetched from `{stUrl}/csrf-token` before each operation
  - Character import uses multipart form upload to `{stUrl}/api/characters/import`
  - Character export via `{stUrl}/api/characters/export`

## Data Storage

**Card & Prompt Storage (git-backed filesystem):**
- Location: `DATA_DIR` env var (default: `proxy/cards/` locally, `/data` in Docker)
- Git repository initialized at `DATA_DIR/.git` via `simple-git` (`proxy/cards.js`)
- Card layout: `{DATA_DIR}/{slug}/card.json` + optional `avatar.png` (not committed)
- Prompt layout: `{DATA_DIR}/prompts/{slug}/prompt.json`
- REST API routes:
  - Cards: `proxy/cards.js` mounted at `/api/cards`
  - Prompts: `proxy/prompts.js` mounted at `/api/prompts`
- Frontend client: `src/scripts/storage-server.js` (ServerBackedStorage class)

**Client-side Storage:**
- localStorage: App configuration (non-sensitive settings) via key `charGeneratorConfig` (`src/scripts/config.js`)
- sessionStorage: API keys stored per-session by default (`src/scripts/config.js`)
- localStorage (opt-in): API keys persisted across sessions when "Persist API Keys" toggle is enabled

**File Storage:**
- Local filesystem only (no cloud storage)
- Docker named volume `cards-data` for persistence (`docker-compose.yml`)

**Caching:**
- None (no Redis, no in-memory cache)

## Authentication & Identity

**Auth Provider:**
- No user authentication for the app itself
- API keys passed through from browser to proxy to upstream APIs
- Proxy does NOT store API keys - they are forwarded per-request via `X-API-Key` and `X-API-URL` headers

**SillyTavern Auth:**
- Optional Basic auth: `user:{password}` base64 encoded
- CSRF token exchange required for all ST API calls
- Password stored in browser sessionStorage (or localStorage if persistence enabled)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, no external error tracking)

**Logs:**
- `console.log` / `console.error` in proxy server (stdout)
- Frontend debug logging controlled by `Config.debugMode` toggle (`src/scripts/config.js`)
- Sensitive data redacted in debug output via `Config.redactSensitiveData()` (`src/scripts/config.js` line 461)

## CI/CD & Deployment

**Hosting:**
- Self-hosted via Docker
- Single-container deployment (`docker-compose.yml`)
- `Dockerfile` based on `node:20-alpine`

**CI Pipeline:**
- None detected (no GitHub Actions, no CI config files)

## Environment Configuration

**Required env vars:**
- None strictly required - all have defaults

**Optional env vars:**
- `PORT` - Server listen port (default: 2426)
- `DATA_DIR` - Card/prompt storage directory (default: `/data` in Docker)
- `GIT_AUTHOR_NAME` - Git commit author (default: "Character Generator")
- `GIT_AUTHOR_EMAIL` - Git commit email (default: "cards@character-generator.local")
- `STATIC_ROOT` - Frontend static files root (default: parent of `proxy/`)
- `FRONTEND_URL` - Used in OpenRouter Referer header (default: "http://localhost:2427")
- `NODE_ENV` - Set to "production" in Docker

**Secrets location:**
- `.env` file at project root (loaded by `dotenv` in `proxy/server.js`)
- `.env.example` documents available variables
- API keys are NOT stored server-side; they live in the browser only

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## CDN Dependencies

**jsDelivr (loaded in `index.html`):**
- `diff@7.0.0` - Text diff library for comparing card versions
- `tributejs@5.1.3` - @mention autocomplete for referencing library cards

**Google Fonts:**
- IBM Plex Mono (400, 500)
- IBM Plex Sans (400, 500, 600)
- Sora (400, 500, 600, 700)

---

*Integration audit: 2026-03-26*
