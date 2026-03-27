# Project Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
character-card-generator/
├── index.html                    # Single-page application (all HTML + inline styles)
├── favicon.png                   # App icon
├── package.json                  # Root package — dev tools (http-server, concurrently)
├── package-lock.json
├── Dockerfile                    # Production image (node:20-alpine)
├── docker-compose.yml            # Single-container deployment
├── .env.example                  # Documented environment variables
├── README.md                     # Project documentation
├── IDEAS.md                      # Feature ideas/backlog
├── AGENTS.md                     # AI agent instructions
│
├── src/
│   ├── scripts/
│   │   ├── config.js             # Settings management (localStorage/sessionStorage)
│   │   ├── api.js                # HTTP client for proxy, streaming, abort control
│   │   ├── character-generator.js # Character generation + response parsing
│   │   ├── image-generator.js    # Image generation (LLM prompt → image API)
│   │   ├── png-encoder.js        # PNG metadata embedding for V2 character cards
│   │   ├── storage-server.js     # REST client for card/prompt CRUD
│   │   ├── prompts.js            # Prompt template registry (all LLM prompts)
│   │   ├── mention-autocomplete.js # @mention autocomplete (Tribute.js wrapper)
│   │   └── main.js               # Main controller (~1500+ lines) — all UI logic
│   └── styles/
│       └── main.css              # All application styles
│
├── proxy/
│   ├── package.json              # Backend dependencies (express, simple-git, etc.)
│   ├── package-lock.json
│   ├── server.js                 # Express server — API proxy + static files
│   ├── cards.js                  # Card CRUD REST API (git-backed)
│   └── prompts.js                # Prompt CRUD REST API (git-backed)
│
└── .claude/                      # Claude Code settings
    └── settings.local.json
```

## Key Files and Their Roles

### Entry Points
- **`index.html`** — The entire SPA. Contains all HTML structure, inline SVG icons, script tags loading order, and CDN imports (diff.js, Tribute.js, Google Fonts).
- **`proxy/server.js`** — Express server entry point. In production, serves both the API and static frontend files.

### Frontend Core (src/scripts/)
- **`main.js`** — The largest file. Contains `CharacterGeneratorApp` class with all UI event binding, tab management, generation flow, card editing, library drawer, lorebook management, SillyTavern sync, theme switching, and split-pane resizing.
- **`api.js`** — `APIHandler` class. Handles all HTTP communication with the proxy server, including streaming SSE responses, abort control, retry logic, and content-policy prefix injection.
- **`character-generator.js`** — `CharacterGenerator` class. Orchestrates character generation calls and parses raw LLM text output into structured character fields using regex.
- **`prompts.js`** — `PROMPT_REGISTRY` object containing all system/user prompt templates for character generation (1st person, 3rd person, scenario), evaluation, revision, image prompts, and lorebook generation.

### Backend Core (proxy/)
- **`cards.js`** — Express router for `/api/cards`. CRUD operations on card JSON files with git versioning via `simple-git`. Supports listing, saving, deleting, history, and diff.
- **`prompts.js`** — Express router for `/api/prompts`. CRUD operations on prompt template JSON files with git versioning.

### Build/Deploy
- **`Dockerfile`** — `node:20-alpine` base, copies proxy + frontend, runs `node proxy/server.js`
- **`docker-compose.yml`** — Single service with `cards-data` named volume for persistence
- No CI/CD configuration files

## Script Loading Order

Scripts are loaded sequentially in `index.html`. Order matters due to window-global dependencies:
1. `config.js` (no deps)
2. `prompts.js` (no deps)
3. `api.js` (depends on config, prompts)
4. `character-generator.js` (depends on apiHandler)
5. `image-generator.js` (depends on apiHandler, config)
6. `png-encoder.js` (depends on config)
7. `storage-server.js` (no deps)
8. `mention-autocomplete.js` (depends on Tribute.js CDN)
9. `main.js` (depends on all above)

---

*Structure analysis: 2026-03-26*
