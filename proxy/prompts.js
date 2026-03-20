// Prompts REST API — git-backed server storage
//
// Prompts are stored inside the same git repo as cards (CARDS_DIR/.git),
// under a "prompts/" subdirectory so they share the volume and history.
//
// Layout:
//   CARDS_DIR/prompts/{slug}/prompt.json
//
// The slug is computed client-side as slugifiedName + '-' + hash(fingerprint),
// making it deterministic so the same prompt template always maps to the same URL.

const express = require("express");
const path = require("path");
const fs = require("fs");
const { getGit, CARDS_DIR } = require("./cards");

const router = express.Router();

const PROMPTS_DIR = path.join(CARDS_DIR, "prompts");

async function ensurePromptDir(slug) {
  const dir = path.join(PROMPTS_DIR, slug);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

// Create the prompts/ subdirectory on startup (idempotent).
async function initPrompts() {
  await fs.promises.mkdir(PROMPTS_DIR, { recursive: true });
  console.log("📁 Prompt storage ready at", PROMPTS_DIR);
}

// ── GET /api/prompts ────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    await fs.promises.mkdir(PROMPTS_DIR, { recursive: true });
    const entries = await fs.promises.readdir(PROMPTS_DIR, {
      withFileTypes: true,
    });
    const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const prompts = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const promptPath = path.join(PROMPTS_DIR, slug, "prompt.json");
          const raw = await fs.promises.readFile(promptPath, "utf-8");
          const prompt = JSON.parse(raw);
          const stat = await fs.promises.stat(promptPath);
          return {
            slug,
            characterName: prompt.characterName || slug,
            pov: prompt.pov || "first",
            concept: prompt.concept || "",
            fingerprint: prompt.fingerprint || "",
            updatedAt: stat.mtime.toISOString(),
          };
        } catch {
          return null;
        }
      }),
    );

    res.json(
      prompts
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    );
  } catch (error) {
    console.error("GET /api/prompts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/prompts/:slug ──────────────────────────────────────────────────

router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const promptPath = path.join(PROMPTS_DIR, slug, "prompt.json");
    const raw = await fs.promises.readFile(promptPath, "utf-8");
    const prompt = JSON.parse(raw);
    res.json({ slug, prompt });
  } catch (error) {
    if (error.code === "ENOENT")
      return res.status(404).json({ error: "Prompt not found" });
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/prompts/:slug ─────────────────────────────────────────────────

router.post("/:slug", express.json({ limit: "50mb" }), async (req, res) => {
  const { slug } = req.params;
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    const dir = await ensurePromptDir(slug);

    await fs.promises.writeFile(
      path.join(dir, "prompt.json"),
      JSON.stringify(prompt, null, 2),
      "utf-8",
    );

    const g = getGit();
    const relPath = path.join("prompts", slug, "prompt.json");
    await g.add(relPath);

    const name = prompt.characterName || slug;
    const pov = prompt.pov || "first";
    const msg = `Save prompt: ${name} (${pov})`;

    const status = await g.status();
    let committed = false;
    if (status.staged.length > 0) {
      await g.commit(msg);
      committed = true;
    }

    res.json({ slug, committed, message: msg });
  } catch (error) {
    console.error(`POST /api/prompts/${slug} error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/prompts/:slug ───────────────────────────────────────────────

router.delete("/:slug", async (req, res) => {
  const { slug } = req.params;
  const dir = path.join(PROMPTS_DIR, slug);

  try {
    await fs.promises.access(dir);
  } catch {
    return res.status(404).json({ error: "Prompt not found" });
  }

  try {
    const g = getGit();
    const relPath = path.join("prompts", slug);
    await g.rm(["-r", relPath]);
    await g.commit(`Delete prompt: ${slug}`);
    res.json({ slug, deleted: true });
  } catch {
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch {}
    res.json({ slug, deleted: true });
  }
});

module.exports = { router, initPrompts };
