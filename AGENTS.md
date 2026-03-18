# Agent Guide

Guidance for AI agents working in this repository.

## Repo Context

This is a fork of [Tremontaine/character-card-generator](https://github.com/Tremontaine/character-card-generator).
`origin/main` is the local working branch — it contains all fork-specific changes and diverges from upstream.
Upstream contributions are prepared on separate branches cut from `upstream/main`.

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Fork working branch — all local changes live here |
| `feature/*` cut from `upstream/main` | Clean PR candidates for upstream |
| `upstream/main` | Tremontaine's repo — do not commit here |

**We are not keeping `main` synced with `upstream/main`** — upstream PRs are built as isolated branches off `upstream/main` and merged back into `main` when done.

## Starting Upstream PR Work

```bash
# Add upstream remote if missing
git remote add upstream git@github.com:Tremontaine/character-card-generator.git
git fetch upstream

# Create a worktree so main is undisturbed
git worktree add .claude/worktrees/<feature-name> -b feature/<feature-name> upstream/main

# Work in the worktree, then merge back to main
git merge feature/<feature-name>

# Push for PR when upstream confirms they want contributions
git push origin feature/<feature-name>
gh pr create --repo Tremontaine/character-card-generator --head davidgibbons:feature/<feature-name>
```

Worktrees live in `.claude/worktrees/` (gitignored). Clean them up when done:
```bash
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

## PR Tracking

| Branch | Description | Status |
|--------|-------------|--------|
| `feature/debug-response` | Debug button in footer to inspect raw AI response | Ready — awaiting upstream interest |
| `main` (modal overflow fix, `0ddff7f`) | `overflow: hidden` → `auto` on API settings modal | In main only; cherry-pick candidate for upstream |
