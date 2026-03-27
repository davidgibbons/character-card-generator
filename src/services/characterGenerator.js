// Character Generator Module
import { apiHandler } from './api';

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

  // Parse character data using simple string splitting based on template
  parseCharacterData(rawData) {
    const character = {
      name: "",
      description: "",
      personality: "",
      scenario: "",
      firstMessage: "",
      tags: [],
    };

    // Extract character name from profile section
    // Try standard header format first: # Name's Profile
    const nameMatch = rawData.match(/^#\s*([^'\\]*(?:\\.[^'\\]*)*)'s Profile/i);
    if (nameMatch) {
      character.name = nameMatch[1].trim();
    } else {
      // Try to find name in text (First Person: "The name's Name")
      const nameTextMatch = rawData.match(/The name's\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
      if (nameTextMatch) {
        character.name = nameTextMatch[1].trim();
      } else {
        // Try Third Person: "Name is..." (at start of description)
        const thirdPersonMatch = rawData.match(/^(?:#\s*[^#\n]+\n+)?([A-Z][a-z]+(?: [A-Z][a-z]+)*)\s+is\b/m);
        if (thirdPersonMatch) {
          character.name = thirdPersonMatch[1].trim();
        }
      }
    }

    // Fallback if name is still missing but we have content
    if (!character.name) {
      console.warn("Could not extract character name. Using default.");
      character.name = "{{char}}";
    }

    // Extract description section (everything from start or # Profile to ## Personality)
    // More robust regex that doesn't strictly require the # Profile header
    const descriptionMatch = rawData.match(
      /(?:#\s*[^#]+?'s Profile[\s\S]*?)?([\s\S]*?)(?=##\s*(?:My\s+)?Personality)/i,
    );
    if (descriptionMatch) {
      // If we captured the header in the group, it's fine. If not, we prepend it if we have a name.
      let descContent = descriptionMatch[1].trim();

      // Clean up potential leading newlines or markdown artifacts
      descContent = descContent.replace(/^#\s*[^#\n]+\n+/, "").trim();

      if (character.name && character.name !== "Unknown Character") {
        character.description = `# ${character.name}'s Profile\n\n${descContent}`;
      } else {
        character.description = descContent;
      }
    }

    // Extract personality section (include the title)
    const personalityMatch = rawData.match(
      /(##\s*(?:My\s+)?Personality[\s\S]*?)(?=#\s*The Roleplay|$)/i,
    );
    if (personalityMatch) {
      character.personality = personalityMatch[1].trim();
    }

    // Extract scenario section (include the title)
    const scenarioMatch = rawData.match(
      /(#\s*The Roleplay's Setup[\s\S]*?)(?=#\s*First Message|$)/i,
    );
    if (scenarioMatch) {
      character.scenario = scenarioMatch[1].trim();
    } else {
      // Create a default scenario if not found
      character.scenario = `A roleplay featuring ${character.name}. The setting and circumstances evolve naturally through interaction between ${character.name} and {{user}}.`;
    }

    // Extract first message (content between # First Message and # Example Messages or end)
    const firstMessageMatch = rawData.match(
      /#\s*First Message\s*\n\n?([\s\S]+?)(?=#\s*Example Messages|$)/i,
    );
    if (firstMessageMatch) {
      character.firstMessage = firstMessageMatch[1].trim();
    }

    // Extract example messages
    const exampleMessagesMatch = rawData.match(
      /#\s*Example Messages\s*\n\n?([\s\S]+?)(?=#\s*Tags|$)/i,
    );
    if (exampleMessagesMatch) {
      character.mesExample = exampleMessagesMatch[1].trim();
    }

    // Extract tags
    const tagsMatch = rawData.match(/#\s*Tags\s*\n\n?([\s\S]+?)$/i);
    if (tagsMatch) {
      character.tags = tagsMatch[1]
        .split(/,/)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    return character;
  }

  // Parse scenario card data using section markers
  parseScenarioData(rawData) {
    const character = {
      name: "",
      description: "",
      personality: "",
      scenario: "",
      firstMessage: "",
      tags: [],
      systemPrompt: "",
      postHistoryInstructions: "",
    };

    // Extract name from # header
    const nameMatch = rawData.match(/^#\s+(.+?)$/m);
    if (nameMatch) {
      character.name = nameMatch[1].trim();
    }

    // Helper to extract content between ## sections
    const extractSection = (sectionName) => {
      const pattern = new RegExp(
        `##\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
        "i"
      );
      const match = rawData.match(pattern);
      return match ? match[1].trim() : "";
    };

    character.description = extractSection("Description");
    character.personality = extractSection("Personality");
    character.scenario = extractSection("Scenario");
    character.firstMessage = extractSection("First Message");
    character.mesExample = extractSection("Example Messages");
    character.systemPrompt = extractSection("System Prompt");
    character.postHistoryInstructions = extractSection("Post-History Instructions");

    // Extract tags (comma-separated)
    const tagsRaw = extractSection("Tags");
    if (tagsRaw) {
      character.tags = tagsRaw.split(/,/).map((t) => t.trim()).filter(Boolean);
    }

    if (!character.name) {
      console.warn("Could not extract scenario name. Using default.");
      character.name = "{{char}}";
    }

    return character;
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
