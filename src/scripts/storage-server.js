// Server-backed storage for character cards and prompt templates.
// Both use git-versioned REST APIs on the proxy server.
//
// Interface is compatible with CharacterStorage so main.js needs no changes
// beyond swapping window.characterStorage.

class ServerBackedStorage {
  constructor() {
    // Keep IndexedDB available only for one-time migration of legacy data
    this._idb = new CharacterStorage();
    this._proxyBase = ""; // same origin — proxy is always local
    this._serverAvailable = true; // set false if server unreachable
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async init() {
    // Always init IndexedDB so migration helpers work
    await this._idb.init();

    // Probe server availability (covers both cards and prompts)
    try {
      const res = await fetch(`${this._proxyBase}/api/cards`, {
        signal: AbortSignal.timeout(3000),
      });
      this._serverAvailable = res.ok;
    } catch {
      this._serverAvailable = false;
      console.warn(
        "⚠️  Storage server unreachable — card and prompt library unavailable until proxy is running.",
      );
    }
  }

  // ── Prompts — REST API ─────────────────────────────────────────────────────

  async savePrompt(promptRecord) {
    if (!this._serverAvailable) {
      // Fall back to IndexedDB if server is down
      return this._idb.savePrompt(promptRecord);
    }

    const fingerprint = promptRecord.fingerprint || "";
    const slug = _promptSlug(promptRecord.characterName, fingerprint);

    // Strip IDB-specific `id` field before sending to server
    const { id: _id, ...promptForServer } = promptRecord;

    try {
      const res = await fetch(`${this._proxyBase}/api/prompts/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptForServer }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return slug;
    } catch (error) {
      console.error("savePrompt failed:", error);
      throw error; // let main.js handle the error and show notification
    }
  }

  async listPrompts() {
    if (!this._serverAvailable) return this._idb.listPrompts();
    try {
      const res = await fetch(`${this._proxyBase}/api/prompts`);
      if (!res.ok) return [];
      const prompts = await res.json();
      // Map to the shape expected by main.js (id, characterName, updatedAt, pov)
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
    if (!this._serverAvailable) return this._idb.getPrompt(slug);
    try {
      const res = await fetch(`${this._proxyBase}/api/prompts/${slug}`);
      if (!res.ok) return null;
      const { prompt } = await res.json();
      return { id: slug, ...prompt };
    } catch (error) {
      console.error("getPrompt failed:", error);
      return null;
    }
  }

  async deletePrompt(slug) {
    if (!this._serverAvailable) return this._idb.deletePrompt(slug);
    try {
      await fetch(`${this._proxyBase}/api/prompts/${slug}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("deletePrompt failed:", error);
    }
  }

  // ── Cards — REST API ───────────────────────────────────────────────────────

  async saveCard({ characterName, character, imageBlob, steeringInput } = {}) {
    if (!this._serverAvailable) return;

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
      const res = await fetch(`${this._proxyBase}/api/cards/${slug}`, {
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
    if (!this._serverAvailable) return [];
    try {
      const res = await fetch(`${this._proxyBase}/api/cards`);
      if (!res.ok) return [];
      const cards = await res.json();
      // Map to the shape expected by main.js (id, characterName, updatedAt)
      return cards.map((c) => ({
        id: c.slug, // string slug used as id
        characterName: c.name,
        updatedAt: c.updatedAt,
        commitCount: c.commitCount,
      }));
    } catch (error) {
      console.error("listCards failed:", error);
      return [];
    }
  }

  async getCard(slug) {
    if (!this._serverAvailable) return null;
    try {
      const res = await fetch(`${this._proxyBase}/api/cards/${slug}`);
      if (!res.ok) return null;
      const { card, avatarUrl } = await res.json();
      return {
        id: slug,
        characterName: card.name || slug,
        character: card,
        avatarUrl: avatarUrl || null,
        imageBlob: null, // blobs not stored in server response
      };
    } catch (error) {
      console.error("getCard failed:", error);
      return null;
    }
  }

  async deleteCard(slug) {
    if (!this._serverAvailable) return;
    try {
      await fetch(`${this._proxyBase}/api/cards/${slug}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("deleteCard failed:", error);
    }
  }

  // ── Migration helpers — IndexedDB → server ─────────────────────────────────

  /** Read all cards currently in IndexedDB (for one-time migration). */
  async listIndexedDBCards() {
    try {
      return await this._idb.listCards();
    } catch {
      return [];
    }
  }

  /** Read a single card from IndexedDB by numeric id. */
  async getIndexedDBCard(id) {
    return this._idb.getCard(id);
  }

  /** Delete a single card from IndexedDB by numeric id. */
  async deleteIndexedDBCard(id) {
    return this._idb.deleteCard(id);
  }

  /** Read all prompts currently in IndexedDB (for one-time migration). */
  async listIndexedDBPrompts() {
    try {
      return await this._idb.listPrompts();
    } catch {
      return [];
    }
  }

  /** Read a single prompt from IndexedDB by numeric id. */
  async getIndexedDBPrompt(id) {
    return this._idb.getPrompt(id);
  }

  /** Delete a single prompt from IndexedDB by numeric id. */
  async deleteIndexedDBPrompt(id) {
    return this._idb.deletePrompt(id);
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

/**
 * Compute a stable, URL-safe slug for a prompt from its fingerprint.
 * Uses a djb2-style hash so the same fingerprint always maps to the same slug.
 * Format: "{slugifiedName}-{7-char-base36-hash}"
 */
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

// Replace the default window.characterStorage with the server-backed version.
// CharacterStorage (from storage.js, loaded before this file) is still
// available and used internally for migration helpers.
window.characterStorage = new ServerBackedStorage();
