// Character Generator Module
import { apiHandler } from './api';
import { parseSections, sectionsToCharacter } from '../utils/parseSections.js';

class CharacterGenerator {
  constructor() {
    this.rawCharacterData = "";
    this.parsedCharacter = null;
  }

  async generateCharacter(concept, characterName, onStream = null, pov = "first", lorebook = null) {
    try {
      this.rawCharacterData = await apiHandler.generateCharacter(
        concept,
        characterName,
        onStream,
        pov,
        lorebook
      );
      this.parsedCharacter = pov === "scenario"
        ? this.parseScenarioData(this.rawCharacterData)
        : this.parseCharacterData(this.rawCharacterData);
      return this.parsedCharacter;
    } catch (error) {
      console.error("Error generating character:", error);
      throw error;
    }
  }

  // Parse character data using parseSections() — delegates to section-header parser
  parseCharacterData(rawData) {
    const sections = parseSections(rawData);
    return sectionsToCharacter(sections, rawData);
  }

  // Parse scenario card data using parseSections() — delegates to section-header parser
  parseScenarioData(rawData) {
    const sections = parseSections(rawData);
    return sectionsToCharacter(sections, rawData);
  }

  // Format character for display
  formatCharacterForDisplay(character) {
    return `
            <div class="character-section">
                <strong>Name:</strong> ${character.name}
            </div>
            <div class="character-section">
                <strong>Description:</strong><br>
                ${character.description.replace(/\n/g, "<br>")}
            </div>
            <div class="character-section">
                <strong>Personality:</strong><br>
                ${character.personality.replace(/\n/g, "<br>")}
            </div>
            <div class="character-section">
                <strong>Scenario:</strong><br>
                ${character.scenario.replace(/\n/g, "<br>")}
            </div>
            <div class="character-section">
                <strong>First Message:</strong><br>
                <div class="message-example">
                    ${character.firstMessage.replace(/\n/g, "<br>")}
                </div>
            </div>
        `;
  }

  // Convert to SillyTavern Spec V2 format
  toSpecV2Format(character) {
    const spec = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: character.name || "Unnamed Character",
        description: character.description || "",
        personality: character.personality || "",
        scenario: character.scenario || "",
        first_mes: character.firstMessage || "Hello!",
        mes_example: character.mesExample || "",
        tags: Array.isArray(character.tags) ? character.tags : [],
      },
    };
    if (character.systemPrompt) {
      spec.data.system_prompt = character.systemPrompt;
    }
    if (character.postHistoryInstructions) {
      spec.data.post_history_instructions = character.postHistoryInstructions;
    }
    if (character.characterBook && character.characterBook.entries?.length > 0) {
      spec.data.character_book = {
        name: character.characterBook.name || "",
        description: character.characterBook.description || "",
        scan_depth: character.characterBook.scan_depth ?? 2,
        token_budget: character.characterBook.token_budget ?? 2048,
        recursive_scanning: character.characterBook.recursive_scanning ?? false,
        extensions: {},
        entries: character.characterBook.entries.map((e) => this.normalizeLorebookEntry(e)),
      };
    }
    return spec;
  }

  normalizeLorebookEntry(entry) {
    return {
      name: entry.name || "",
      keys: Array.isArray(entry.keys) ? entry.keys : (entry.key || []),
      secondary_keys: Array.isArray(entry.secondary_keys) ? entry.secondary_keys : [],
      content: entry.content || "",
      enabled: entry.enabled !== false,
      insertion_order: entry.insertion_order ?? 0,
      case_sensitive: entry.case_sensitive ?? false,
      priority: entry.priority ?? 10,
      id: entry.id ?? Date.now() + Math.floor(Math.random() * 1000),
      comment: entry.comment || "",
      selective: entry.selective ?? false,
      constant: entry.constant ?? false,
      position: entry.position || "before_char",
      extensions: {
        depth: entry.extensions?.depth ?? 4,
        weight: entry.extensions?.weight ?? 10,
        probability: entry.extensions?.probability ?? 100,
        selectiveLogic: entry.extensions?.selectiveLogic ?? 0,
        useProbability: entry.extensions?.useProbability !== false,
      },
      probability: entry.probability ?? 100,
      selectiveLogic: entry.selectiveLogic ?? 0,
    };
  }
}

export const characterGenerator = new CharacterGenerator();
export default characterGenerator;
