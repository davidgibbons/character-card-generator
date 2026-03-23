// Server-backed storage for character cards and prompt templates.
// Uses git-versioned REST APIs on the Express server (always same-origin).

class ServerBackedStorage {
  async init() {
    // Server is always available (same process serves the page)
  }

  // ── Prompts — REST API ─────────────────────────────────────────────────────

  async savePrompt(promptRecord) {
    const fingerprint = promptRecord.fingerprint || "";
    const slug = _promptSlug(promptRecord.characterName, fingerprint);

    const { id: _id, ...promptForServer } = promptRecord;

    try {
      const res = await fetch(`/api/prompts/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptForServer }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return slug;
    } catch (error) {
      console.error("savePrompt failed:", error);
      throw error;
    }
  }

  async listPrompts() {
    try {
      const res = await fetch("/api/prompts");
      if (!res.ok) return [];
      const prompts = await res.json();
      return prompts.map((p) => ({
        id: p.slug,
        characterName: p.characterName,
        pov: p.pov,
        updatedAt: p.updatedAt,
        fingerprint: p.fingerprint,
      }));
    } catch (error) {
      console.error("listPrompts failed:", error);
      return [];
    }
  }

  async getPrompt(slug) {
    try {
      const res = await fetch(`/api/prompts/${slug}`);
      if (!res.ok) return null;
      const { prompt } = await res.json();
      return { id: slug, ...prompt };
    } catch (error) {
      console.error("getPrompt failed:", error);
      return null;
    }
  }

  async deletePrompt(slug) {
    try {
      await fetch(`/api/prompts/${slug}`, { method: "DELETE" });
    } catch (error) {
      console.error("deletePrompt failed:", error);
    }
  }

  // ── Cards — REST API ───────────────────────────────────────────────────────

  async saveCard({ characterName, character, imageBlob, steeringInput } = {}) {
    const name = characterName || character?.name || "Unnamed";
    const slug = slugifyName(name);

    let avatarDataUrl = null;
    if (imageBlob instanceof Blob) {
      try {
        avatarDataUrl = await blobToDataUrl(imageBlob);
      } catch (e) {
        console.warn("Failed to convert image blob for upload:", e.message);
      }
    }

    try {
      const res = await fetch(`/api/cards/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: character, steeringInput, avatarDataUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return slug;
    } catch (error) {
      console.error("saveCard failed:", error);
    }
  }

  async listCards() {
    try {
      const res = await fetch("/api/cards");
      if (!res.ok) return [];
      const cards = await res.json();
      return cards.map((c) => ({
        id: c.slug,
        characterName: c.name,
        updatedAt: c.updatedAt,
        commitCount: c.commitCount,
        qualityScore: c.qualityScore ?? null,
      }));
    } catch (error) {
      console.error("listCards failed:", error);
      return [];
    }
  }

  async getCard(slug) {
    try {
      const res = await fetch(`/api/cards/${slug}`);
      if (!res.ok) return null;
      const { card, avatarUrl } = await res.json();
      return {
        id: slug,
        characterName: card.name || slug,
        character: card,
        avatarUrl: avatarUrl || null,
        imageBlob: null,
      };
    } catch (error) {
      console.error("getCard failed:", error);
      return null;
    }
  }

  async deleteCard(slug) {
    try {
      await fetch(`/api/cards/${slug}`, { method: "DELETE" });
    } catch (error) {
      console.error("deleteCard failed:", error);
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function slugifyName(name) {
  return (
    (name || "unnamed")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "unnamed"
  );
}

function _promptSlug(characterName, fingerprint) {
  let h = 5381;
  const str = fingerprint || characterName || "prompt";
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) | 0;
  }
  const hash = (h >>> 0).toString(36).padStart(7, "0");
  return slugifyName(characterName || "prompt") + "-" + hash;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

window.characterStorage = new ServerBackedStorage();
