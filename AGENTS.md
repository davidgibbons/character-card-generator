# Agent Guide

Guidance for AI agents working in this repository.

## Repo Context

This is a derivative of the original character-card-generator by Tremontaine:
https://codeberg.org/Tremontaine/character-card-generator

Additional inspiration from ewizza's fork (A1111/SD API support):
https://github.com/ewizza/character-card-generator

We are not tracking any upstream. `origin/main` is the authoritative working branch.

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Authoritative working branch — all changes live here |
| `feature/*` | Feature branches; merge to `main` when done |

Use worktrees for feature work to keep `main` clean:
```bash
git worktree add .claude/worktrees/<feature-name> -b feature/<feature-name> main
# work, commit, then from repo root:
git merge feature/<feature-name>
git worktree remove .claude/worktrees/<feature-name>
```

## Running Locally

```bash
# Docker (recommended) — proxy + frontend, full stack
docker compose up -d
docker compose up -d --build   # after code changes

# Frontend served at localhost:2427
# Proxy API at localhost:2426
```

Card data (git-backed) lives in a Docker named volume `character-generator-cards` mounted at `/data` inside the proxy container. Override with `DATA_DIR=` in `.env`.

## Key Files

| File | Purpose |
|------|---------|
| `src/scripts/api.js` | LLM API calls, streaming, connection test |
| `src/scripts/character-generator.js` | Generation pipeline; `rawCharacterData` holds last raw AI response |
| `src/scripts/main.js` | App controller — event binding, UI logic, library, ST browser |
| `src/scripts/storage.js` | IndexedDB storage class (`CharacterStorage`) — used for prompts |
| `src/scripts/storage-server.js` | Server-backed storage (`ServerBackedStorage`) — cards via REST, prompts via IndexedDB |
| `src/styles/main.css` | All styles |
| `proxy/server.js` | Express proxy — LLM, image, ST, and cards API |
| `proxy/cards.js` | Cards REST router + git operations (`/api/cards/*`) |
| `index.html` | Single-page app shell + all modals |

## Shipped Features

| Feature | Phase | Description |
|---------|-------|-------------|
| SillyTavern integration | — | Pull characters from ST, push cards back |
| Debug response viewer | — | Bug icon in footer shows raw AI output |
| Dark mode | — | Moon/sun toggle in footer, persists via localStorage |
| API settings modal scroll | — | Fixed `overflow: hidden` cutting off fields |
| ST character browser tags | — | Fixed tag measurement and +N badge clipping |
| A1111/SD API image support | — | Auto-detects KoboldCpp/A1111, `/api/image/samplers` endpoint |
| Generation progress bar | 1a | Animated bar while streaming; Generate button disabled to prevent double-fire |
| Field change highlighting | 1b | `.field-changed` accent border on fields that changed since last generation |
| Git-backed card storage | 2a | `proxy/cards.js` REST API; each save = git commit with steering input in message |
| Server storage client | 2b | `storage-server.js` replaces IndexedDB for cards; prompts stay in IndexedDB |
| IndexedDB migration banner | 2c | One-time banner offers to migrate existing browser cards to server |
| Version history modal | 3a | "History" button on library cards; lists commits, previews any version, restore |
| Regeneration diff modal | 3b | "Show what changed" link after generation; side-by-side field diff |
| ST example message push | 4 | "Push to SillyTavern" button after generating example messages |

## API Endpoints (Proxy)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/text/chat/completions` | Proxy to configured LLM |
| POST | `/api/image/generations` | Proxy to image API (OpenAI or SD/A1111) |
| GET | `/api/image/samplers` | SD API sampler list |
| GET | `/api/proxy-image` | CORS-bypass image fetch |
| POST | `/api/st/characters` | List ST characters |
| POST | `/api/st/push` | Push character PNG to ST |
| POST | `/api/st/push-examples` | Push character PNG with updated mes_example to ST |
| POST | `/api/st/pull` | Export character from ST as JSON |
| GET | `/api/cards` | List all saved cards |
| GET | `/api/cards/:slug` | Get latest card + avatar URL |
| GET | `/api/cards/:slug/avatar` | Serve avatar image |
| POST | `/api/cards/:slug` | Save card (commits to git) |
| DELETE | `/api/cards/:slug` | Delete card (git rm + commit) |
| GET | `/api/cards/:slug/history` | Git log for a card |
| GET | `/api/cards/:slug/version/:hash` | Card JSON at a specific commit |
| GET | `/api/cards/:slug/diff/:a/:b` | Field diff between two commits |

## Current Status (2026-03-19)

Phases 1–4 shipped and running via docker-compose. Focus is now on iterating/testing these phases before moving to Phase 5 (prompt server persistence). See IDEAS.md for known gaps.
