// Cards REST API — git-backed server storage
const express = require("express");
const path = require("path");
const fs = require("fs");
const { simpleGit } = require("simple-git");

const router = express.Router();

// Cards are stored at proxy/cards/{slug}/card.json
const CARDS_DIR = path.join(__dirname, "cards");

// simple-git operates on the proxy/ directory
let _git = null;
function getGit() {
  if (!_git) _git = simpleGit(__dirname);
  return _git;
}

async function ensureCardDir(slug) {
  const dir = path.join(CARDS_DIR, slug);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

// Initialize git repo inside proxy/ on server startup
async function initGit() {
  const g = getGit();

  const dotGit = path.join(__dirname, ".git");
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
    console.log("📦 Initialized git repo for card storage");
  }

  // Ensure cards dir and .gitignore for avatars
  await fs.promises.mkdir(CARDS_DIR, { recursive: true });
  const gitignorePath = path.join(CARDS_DIR, ".gitignore");
  try {
    await fs.promises.access(gitignorePath);
  } catch {
    await fs.promises.writeFile(gitignorePath, "avatar.png\n");
    await g.add(path.join("cards", ".gitignore"));
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
              file: path.join("cards", slug, "card.json"),
              "--": null,
            });
            commitCount = log.total;
          } catch {}

          return {
            slug,
            name: card.name || slug,
            updatedAt: stat.mtime.toISOString(),
            commitCount,
          };
        } catch {
          return null;
        }
      }),
    );

    const result = cards
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(result);
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
  const avatarPath = path.join(CARDS_DIR, slug, "avatar.png");
  res.sendFile(avatarPath, (err) => {
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

    // Write card.json
    await fs.promises.writeFile(
      path.join(dir, "card.json"),
      JSON.stringify(card, null, 2),
      "utf-8",
    );

    // Write avatar.png if provided
    if (avatarDataUrl) {
      const b64 = avatarDataUrl.replace(/^data:image\/\w+;base64,/, "");
      await fs.promises.writeFile(
        path.join(dir, "avatar.png"),
        Buffer.from(b64, "base64"),
      );
    }

    // Stage and commit card.json (avatar is gitignored by default)
    const g = getGit();
    await g.add(path.join("cards", slug, "card.json"));

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
    await g.rm(["-r", path.join("cards", slug)]);
    await g.commit(`Delete ${slug}`);
    res.json({ slug, deleted: true });
  } catch (error) {
    // Fallback: remove directory even if git rm fails
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch {}
    res.json({ slug, deleted: true });
  }
});

// ── GET /api/cards/:slug/version/:hash ────────────────────────────────────

router.get("/:slug/version/:hash", async (req, res) => {
  const { slug, hash } = req.params;
  const relPath = path.join("cards", slug, "card.json");
  try {
    const raw = await getGit().show([`${hash}:${relPath}`]);
    res.json({ slug, hash, card: JSON.parse(raw) });
  } catch (error) {
    res.status(404).json({ error: "Version not found", details: error.message });
  }
});

// ── GET /api/cards/:slug/history ───────────────────────────────────────────

router.get("/:slug/history", async (req, res) => {
  const { slug } = req.params;
  try {
    const log = await getGit().log({
      file: path.join("cards", slug, "card.json"),
      "--": null,
    });
    const history = log.all.map((c) => ({
      hash: c.hash,
      timestamp: c.date,
      message: c.message,
      steeringInput: extractSteeringInput(c.message),
    }));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/cards/:slug/diff/:commitA/:commitB ────────────────────────────

router.get("/:slug/diff/:commitA/:commitB", async (req, res) => {
  const { slug, commitA, commitB } = req.params;
  const relPath = path.join("cards", slug, "card.json");
  try {
    const g = getGit();
    const [rawA, rawB] = await Promise.all([
      g.show([`${commitA}:${relPath}`]),
      g.show([`${commitB}:${relPath}`]),
    ]);

    const cardA = JSON.parse(rawA);
    const cardB = JSON.parse(rawB);

    const fields = [
      "name",
      "description",
      "personality",
      "scenario",
      "firstMessage",
      "mes_example",
    ];
    const diff = {};
    for (const f of fields) {
      if (cardA[f] !== cardB[f]) {
        diff[f] = { before: cardA[f], after: cardB[f] };
      }
    }

    res.json({ commitA, commitB, diff });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function extractSteeringInput(message) {
  const colonIdx = message.indexOf(": ");
  if (colonIdx !== -1) return message.slice(colonIdx + 2);
  return null;
}

module.exports = { router, initGit };
