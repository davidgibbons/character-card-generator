// Server-backed storage for character cards (git-versioned REST API)
// Prompts continue to use IndexedDB via the existing CharacterStorage class.
//
// Interface is compatible with CharacterStorage so main.js needs no changes
// beyond swapping window.characterStorage.

class ServerBackedStorage {
  constructor() {
    // Re-use the existing IndexedDB class (already on window) for prompts
    this._idb = new CharacterStorage();
    this._proxyBase = ""; // same origin — proxy is always local
    this._cardsAvailable = true; // set false if server unreachable
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async init() {
    // Always init IndexedDB for prompts
    await this._idb.init();

    // Probe card server availability
    try {
      const res = await fetch(`${this._proxyBase}/api/cards`, {
        signal: AbortSignal.timeout(3000),
      });
      this._cardsAvailable = res.ok;
    } catch {
      this._cardsAvailable = false;
      console.warn(
        "⚠️  Card server unreachable — card library will be unavailable until proxy is running.",
      );
    }
  }

  // ── Prompts — delegated to IndexedDB ──────────────────────────────────────

  async savePrompt(promptRecord) {
    return this._idb.savePrompt(promptRecord);
  }

  async listPrompts() {
    return this._idb.listPrompts();
  }

  async getPrompt(id) {
    return this._idb.getPrompt(id);
  }

  async deletePrompt(id) {
    return this._idb.deletePrompt(id);
  }

  // ── Cards — REST API ───────────────────────────────────────────────────────

  async saveCard({ characterName, character, imageBlob, steeringInput } = {}) {
    if (!this._cardsAvailable) return;

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
    if (!this._cardsAvailable) return [];
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
    if (!this._cardsAvailable) return null;
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
    if (!this._cardsAvailable) return;
    try {
      await fetch(`${this._proxyBase}/api/cards/${slug}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("deleteCard failed:", error);
    }
  }

  // ── Migration helpers ──────────────────────────────────────────────────────

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
// available and used internally for prompts.
window.characterStorage = new ServerBackedStorage();
