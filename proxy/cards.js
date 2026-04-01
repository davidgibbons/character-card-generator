// Cards REST API — git-backed server storage
//
// Layout (all under CARDS_DIR = proxy/cards/):
//   proxy/cards/.git/           ← git repo lives here (inside the volume)
//   proxy/cards/.gitignore      ← ignores avatar.png per-card
//   proxy/cards/{slug}/card.json
//   proxy/cards/{slug}/avatar.png  (not committed by default)
//
// Because the git repo is rooted at CARDS_DIR, history persists when
// CARDS_DIR is a Docker named volume.

const express = require("express");
const path = require("path");
const fs = require("fs");
const { simpleGit } = require("simple-git");

const router = express.Router();

// All data (cards + git repo) lives here.
// Override with DATA_DIR env var (e.g. /data in Docker, a mounted volume path elsewhere).
const CARDS_DIR = process.env.DATA_DIR || path.join(__dirname, "cards");

let _git = null;
function getGit() {
  if (!_git) _git = simpleGit(CARDS_DIR);
  return _git;
}

async function ensureCardDir(slug) {
  const dir = path.join(CARDS_DIR, slug);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

// Initialize the git repo inside CARDS_DIR on server startup.
// Idempotent — safe to call multiple times.
async function initGit() {
  await fs.promises.mkdir(CARDS_DIR, { recursive: true });

  const g = getGit();
  const dotGit = path.join(CARDS_DIR, ".git");
  let isRepo = false;
  try {
    await fs.promises.access(dotGit);
    isRepo = true;
  } catch {}

  if (!isRepo) {
    await g.init();
    await g.addConfig(
      "user.email",
      process.env.GIT_AUTHOR_EMAIL || "cards@character-generator.local",
    );
    await g.addConfig(
      "user.name",
      process.env.GIT_AUTHOR_NAME || "Character Generator",
    );
    console.log("📦 Initialized git repo for card storage at", CARDS_DIR);
  }

  // Ensure .gitignore ignores avatar files (keeps the repo lean)
  const gitignorePath = path.join(CARDS_DIR, ".gitignore");
  try {
    await fs.promises.access(gitignorePath);
  } catch {
    await fs.promises.writeFile(gitignorePath, "avatar.png\n");
    await g.add(".gitignore");
    const status = await g.status();
    if (status.staged.length > 0) {
      await g.commit("chore: init cards store");
    }
    console.log("📁 Created cards/.gitignore");
  }
}

// ── GET /api/cards ─────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    await fs.promises.mkdir(CARDS_DIR, { recursive: true });
    const entries = await fs.promises.readdir(CARDS_DIR, {
      withFileTypes: true,
    });
    const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const cards = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const cardPath = path.join(CARDS_DIR, slug, "card.json");
          const raw = await fs.promises.readFile(cardPath, "utf-8");
          const card = JSON.parse(raw);
          const stat = await fs.promises.stat(cardPath);

          let commitCount = 0;
          try {
            const log = await getGit().log({
              file: path.join(slug, "card.json"),
              "--": null,
            });
            commitCount = log.total;
          } catch {}

          return {
            slug,
            name: card.name || slug,
            updatedAt: stat.mtime.toISOString(),
            commitCount,
            qualityScore: card.qualityScore ?? null,
          };
        } catch {
          return null;
        }
      }),
    );

    res.json(
      cards
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    );
  } catch (error) {
    console.error("GET /api/cards error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/cards/:slug ───────────────────────────────────────────────────

router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const cardPath = path.join(CARDS_DIR, slug, "card.json");
    const raw = await fs.promises.readFile(cardPath, "utf-8");
    const card = JSON.parse(raw);

    let hasAvatar = false;
    try {
      await fs.promises.access(path.join(CARDS_DIR, slug, "avatar.png"));
      hasAvatar = true;
    } catch {}

    res.json({
      slug,
      card,
      avatarUrl: hasAvatar ? `/api/cards/${slug}/avatar` : null,
    });
  } catch (error) {
    if (error.code === "ENOENT")
      return res.status(404).json({ error: "Card not found" });
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/cards/:slug/avatar ────────────────────────────────────────────

router.get("/:slug/avatar", (req, res) => {
  const { slug } = req.params;
  res.sendFile(path.join(CARDS_DIR, slug, "avatar.png"), (err) => {
    if (err) res.status(404).json({ error: "Avatar not found" });
  });
});

// ── POST /api/cards/:slug ──────────────────────────────────────────────────

router.post("/:slug", express.json({ limit: "50mb" }), async (req, res) => {
  const { slug } = req.params;
  const { card, steeringInput, avatarDataUrl } = req.body;

  if (!card) return res.status(400).json({ error: "card is required" });

  try {
    const dir = await ensureCardDir(slug);

    await fs.promises.writeFile(
      path.join(dir, "card.json"),
      JSON.stringify(card, null, 2),
      "utf-8",
    );

    if (avatarDataUrl) {
      const b64 = avatarDataUrl.replace(/^data:image\/\w+;base64,/, "");
      await fs.promises.writeFile(
        path.join(dir, "avatar.png"),
        Buffer.from(b64, "base64"),
      );
    }

    const g = getGit();
    // Path relative to CARDS_DIR (the git root)
    await g.add(path.join(slug, "card.json"));

    const name = card.name || slug;
    const msg = steeringInput
      ? `${name}: ${steeringInput.trim().slice(0, 72)}`
      : `Save ${name}`;

    const status = await g.status();
    let committed = false;
    if (status.staged.length > 0) {
      await g.commit(msg);
      committed = true;
    }

    res.json({ slug, committed, message: msg });
  } catch (error) {
    console.error(`POST /api/cards/${slug} error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/cards/:slug ────────────────────────────────────────────────

router.delete("/:slug", async (req, res) => {
  const { slug } = req.params;
  const dir = path.join(CARDS_DIR, slug);

  try {
    await fs.promises.access(dir);
  } catch {
    return res.status(404).json({ error: "Card not found" });
  }

  try {
    const g = getGit();
    await g.rm(["-r", slug]);
    await g.commit(`Delete ${slug}`);
    res.json({ slug, deleted: true });
  } catch {
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch {}
    res.json({ slug, deleted: true });
  }
});

// ── GET /api/cards/:slug/version/:hash ────────────────────────────────────

router.get("/:slug/version/:hash", async (req, res) => {
  const { slug, hash } = req.params;
  const relPath = path.join(slug, "card.json");
  try {
    const raw = await getGit().show([`${hash}:${relPath}`]);
    res.json({ slug, hash, card: JSON.parse(raw) });
  } catch (error) {
    res
      .status(404)
      .json({ error: "Version not found", details: error.message });
  }
});

// ── GET /api/cards/:slug/history ───────────────────────────────────────────

router.get("/:slug/history", async (req, res) => {
  const { slug } = req.params;
  try {
    const log = await getGit().log({
      file: path.join(slug, "card.json"),
      "--": null,
    });
    res.json(
      log.all.map((c) => ({
        hash: c.hash,
        timestamp: c.date,
        message: c.message,
        steeringInput: extractSteeringInput(c.message),
      })),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/cards/:slug/diff/:commitA/:commitB ────────────────────────────

// Canonical field list — covers camelCase (current) and snake_case (legacy saves)
const DIFF_FIELDS = [
  ["name",        "name"],
  ["description", "description"],
  ["personality", "personality"],
  ["scenario",    "scenario"],
  ["firstMessage","first_mes"],     // camelCase current / snake_case legacy
  ["mesExample",  "mes_example"],   // camelCase current / snake_case legacy
  ["systemPrompt","system_prompt"],
  ["creatorNotes","creator_notes"],
  ["tags",        "tags"],
];

/** Read a field from a card object, trying camelCase then snake_case key. */
function readField(card, camel, snake) {
  return camel in card ? card[camel] : (snake in card ? card[snake] : undefined);
}

/** Normalise a field value to a comparable string for diff. */
function normalise(val) {
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

router.get("/:slug/diff/:commitA/:commitB", async (req, res) => {
  const { slug, commitA, commitB } = req.params;
  const relPath = path.join(slug, "card.json");
  try {
    const g = getGit();
    const [rawA, rawB] = await Promise.all([
      g.show([`${commitA}:${relPath}`]),
      g.show([`${commitB}:${relPath}`]),
    ]);

    const cardA = JSON.parse(rawA);
    const cardB = JSON.parse(rawB);

    const diff = {};
    for (const [camel, snake] of DIFF_FIELDS) {
      const a = normalise(readField(cardA, camel, snake));
      const b = normalise(readField(cardB, camel, snake));
      if (a !== b) {
        diff[camel] = { before: a, after: b };
      }
    }

    res.json({ commitA, commitB, diff });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function extractSteeringInput(message) {
  const colonIdx = message.indexOf(": ");
  return colonIdx !== -1 ? message.slice(colonIdx + 2) : null;
}

module.exports = { router, initGit, getGit, CARDS_DIR };
