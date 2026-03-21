// Mention Autocomplete — @mention references to library cards
// Uses Tribute.js on contenteditable divs for styled pill insertion.
class MentionAutocomplete {
  constructor(textareaId, storage) {
    this.textareaId = textareaId;
    this.storage = storage;
    this.element = null; // the contenteditable div that replaces the textarea
    this.tribute = null;
    this._cache = null;
    this._cacheTime = 0;
  }

  attach() {
    if (typeof Tribute === "undefined") return;

    this.element = this._replaceWithEditable(this.textareaId);
    if (!this.element) return;

    const self = this;
    this.tribute = new Tribute({
      trigger: "@",
      allowSpaces: true,
      menuShowMinLength: 0,
      noMatchTemplate: '<li class="mention-no-match">No matching cards</li>',
      selectTemplate(item) {
        return `<span class="mention-pill" contenteditable="false">@${item.original.value}</span>&nbsp;`;
      },
      menuItemTemplate(item) {
        return item.string;
      },
      values(query, cb) {
        self._lookup(query).then(cb);
      },
    });

    this.tribute.attach(this.element);
  }

  // Replace a <textarea> with a contenteditable <div> that mirrors its
  // appearance and exposes a .value getter/setter for compatibility.
  _replaceWithEditable(id) {
    const ta = document.getElementById(id);
    if (!ta) return null;

    const div = document.createElement("div");
    div.id = id;
    div.contentEditable = "true";
    div.dataset.placeholder = ta.placeholder || "";

    // Copy classes and relevant attributes
    div.className = ta.className + " mention-editable";
    div.setAttribute("role", "textbox");
    div.setAttribute("aria-multiline", "true");
    if (ta.rows) {
      // Approximate min-height from rows
      const lineHeight = 1.5; // em
      div.style.minHeight = (ta.rows * lineHeight) + "em";
    }

    // Bridge .value for existing code compatibility
    Object.defineProperty(div, "value", {
      get() {
        return div.textContent || "";
      },
      set(val) {
        div.textContent = val;
      },
    });

    ta.parentNode.replaceChild(div, ta);
    return div;
  }

  async _lookup(query) {
    let cards;
    try {
      cards = await this._fetchCards();
    } catch {
      return [];
    }
    return cards.map((c) => ({ key: c.characterName, value: c.characterName }));
  }

  async _fetchCards() {
    const now = Date.now();
    if (this._cache && now - this._cacheTime < 60000) {
      return this._cache;
    }
    if (!this.storage) return [];
    const cards = await this.storage.listCards();
    this._cache = cards;
    this._cacheTime = now;
    return cards;
  }

  invalidateCache() {
    this._cache = null;
    this._cacheTime = 0;
  }
}

// Expand @CardName mentions into referenced card context.
async function expandMentions(text, storage) {
  if (!storage || !text.includes("@")) return text;

  let cards;
  try {
    cards = await storage.listCards();
  } catch {
    return text;
  }
  if (!cards || cards.length === 0) return text;

  // Sort longest name first so "Sir Khissa" matches before "Sir"
  const sorted = [...cards].sort((a, b) => b.characterName.length - a.characterName.length);

  let result = text;
  for (const card of sorted) {
    const name = card.characterName;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`@${escaped}(?=\\s|[.,;!?]|$)`, "gi");

    if (!regex.test(result)) continue;
    regex.lastIndex = 0;

    let cardData;
    try {
      cardData = await storage.getCard(card.id);
    } catch {
      continue;
    }
    if (!cardData || !cardData.character) continue;

    const c = cardData.character;
    let block = `\n--- Referenced Character: ${c.name || name} ---\n`;
    if (c.description) block += `Description: ${c.description}\n`;
    if (c.personality) block += `Personality: ${c.personality}\n`;
    if (c.scenario) block += `Scenario: ${c.scenario}\n`;
    block += `--- End Reference ---\n`;

    result = result.replace(regex, block);
  }

  return result;
}

window.MentionAutocomplete = MentionAutocomplete;
window.expandMentions = expandMentions;
