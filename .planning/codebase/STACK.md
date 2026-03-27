# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- JavaScript (ES6+ classes, async/await) - Used for both frontend and backend

**Secondary:**
- HTML5 - Single-page application UI (`index.html`)
- CSS3 - Custom properties, modern layout (`src/styles/main.css`)

## Runtime

**Environment:**
- Node.js >= 18.0.0 (specified in `package.json` engines field)
- Docker image uses `node:20-alpine` (`Dockerfile`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present at root and `proxy/package-lock.json`

## Frameworks

**Core:**
- Express ^4.18.2 - Backend proxy server (`proxy/server.js`)
- No frontend framework - Vanilla JS with class-based modules loaded via `<script>` tags

**Build/Dev:**
- http-server ^14.1.1 - Static file serving for development (`package.json` devDependencies)
- concurrently ^8.2.2 - Runs proxy server and frontend dev server in parallel (`package.json` devDependencies)
- nodemon ^3.0.1 - Auto-restart proxy server during development (`proxy/package.json` devDependencies)

**Testing:**
- None detected - No test framework, no test files, no test scripts

## Key Dependencies

**Backend (proxy/package.json):**
- `express` ^4.18.2 - HTTP server and API routing
- `cors` ^2.8.5 - Cross-origin resource sharing middleware
- `compression` ^1.8.1 - Gzip response compression
- `dotenv` ^16.3.1 - Environment variable loading from `.env`
- `form-data` ^4.0.0 - Multipart form construction for SillyTavern uploads
- `simple-git` ^3.33.0 - Git operations for version-controlled card/prompt storage

**Frontend (CDN):**
- `diff` 7.0.0 - Text diffing library loaded from jsDelivr CDN (`index.html` line 820)
- `tributejs` 5.1.3 - @mention autocomplete library loaded from jsDelivr CDN (`index.html` lines 821-822)

**Frontend (browser built-ins):**
- Fetch API - All HTTP requests (no axios/other HTTP client)
- Canvas API - Image processing in `src/scripts/image-generator.js`
- localStorage/sessionStorage - Config and API key persistence (`src/scripts/config.js`)
- TextEncoder/btoa - PNG metadata encoding (`src/scripts/png-encoder.js`)

## Configuration

**Environment:**
- `.env.example` present with documented variables
- `dotenv` loads `.env` from project root in proxy server
- Config class in `src/scripts/config.js` manages all frontend settings via localStorage/sessionStorage

**Key env vars (from `.env.example`):**
- `PORT` - Server port (default: 2426)
- `DATA_DIR` - Persistent storage directory (default: `/data` in Docker, `proxy/cards/` locally)
- `GIT_AUTHOR_NAME` - Git identity for card version history
- `GIT_AUTHOR_EMAIL` - Git identity for card version history

**Build:**
- No build process - Static site with vanilla JS (`"build": "echo 'No build process needed for this static site'"`)
- Cache-busting via manual query string versioning on script/CSS tags (e.g., `?v=20260325a`)

## Platform Requirements

**Development:**
- Node.js >= 18.0.0
- npm
- Git (for card storage versioning)
- Run `npm start` to launch both proxy (port 2426) and frontend dev server (port 2427)
- Or `npm run dev` for auto-restart with nodemon

**Production:**
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

---

*Stack analysis: 2026-03-26*
