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

## Dev Server

```bash
npm start        # proxy (port 2426) + frontend (port 2427)
```

Frontend is at **localhost:2427**. The proxy at 2426 is backend-only.
Hard refresh via cmux: use `cmux browser <surface> navigate http://localhost:2427` instead of Cmd+Shift+R.

## Key Files

| File | Purpose |
|------|---------|
| `src/scripts/api.js` | LLM API calls, streaming, connection test |
| `src/scripts/character-generator.js` | Generation pipeline; `rawCharacterData` holds the last raw AI response |
| `src/scripts/main.js` | App entry, event binding, ST browser, UI logic |
| `src/styles/main.css` | All styles |
| `proxy/` | Express proxy server |
| `index.html` | Single-page app shell + all modals |

## Shipped Features (merged to main)

| Feature | Description |
|---------|-------------|
| SillyTavern integration | Pull characters from ST, push cards back |
| Debug response viewer | Bug icon button in footer shows raw AI output |
| Dark mode | Moon/sun toggle in footer, persists via localStorage |
| API settings modal scroll | Fixed `overflow: hidden` that cut off fields |
| ST character browser tags | Fixed tag measurement and +N badge clipping |
| A1111/SD API image support | Auto-detects KoboldCpp/A1111 endpoints, falls back to OpenAI; `/api/image/samplers` endpoint added |
