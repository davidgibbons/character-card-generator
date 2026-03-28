/**
 * Parse LLM output with ## Section Name headers into a keyed object.
 * Returns { _raw: text } if no ## sections are found (LLM deviated from template).
 */
export function parseSections(text) {
  const sections = {};
  const blocks = text.split(/^##\s+/m);
  if (blocks.length <= 1) {
    // No ## sections found — return raw fallback
    return { _raw: text };
  }
  for (const block of blocks.slice(1)) {
    const nl = block.indexOf('\n');
    if (nl === -1) continue;
    const key = block.slice(0, nl).trim().toLowerCase();
    sections[key] = block.slice(nl + 1).trim();
  }
  return sections;
}

/**
 * Map parsed section keys to the character object shape.
 * Keys from parseSections() use lowercase with spaces (e.g. "first message").
 * Character object uses camelCase (e.g. firstMessage).
 */
export function sectionsToCharacter(sections, rawText = '') {
  if (sections._raw) {
    // Fallback: no structured sections found
    return {
      name: '',
      description: sections._raw,
      personality: '',
      scenario: '',
      firstMessage: '',
      tags: [],
      mesExample: '',
      systemPrompt: '',
      creatorNotes: '',
      _raw: rawText,
    };
  }

  // Parse tags: "tag1, tag2, tag3" or "- tag1\n- tag2"
  const rawTags = sections['tags'] || '';
  const tags = rawTags
    ? rawTags
        .split(/[\n,]+/)
        .map((t) => t.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    : [];

  return {
    name: sections['name'] || '',
    personality: sections['personality'] || '',
    description: sections['description'] || '',
    scenario: sections['scenario'] || '',
    firstMessage: sections['first message'] || sections['firstmessage'] || '',
    tags,
    mesExample: sections['message example'] || sections['example messages'] || sections['mes example'] || '',
    systemPrompt: sections['system prompt'] || sections['systemprompt'] || '',
    creatorNotes: sections['creator notes'] || sections['creatornotes'] || '',
  };
}
