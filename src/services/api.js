// API Handler for OpenAI-compatible endpoints with streaming support
import { configStore } from '../stores/configStore';
import { getPrompt, renderTemplate } from './prompts';

const debugLog = (...args) => {
  if (configStore.getState().debugMode || configStore.getState().app?.debugMode) {
    console.log(...args);
  }
};

class APIHandler {
  constructor() {
    this.lastGeneratedImagePrompt = null;
    this.currentAbortController = null;
    this.currentReader = null;
    this.userStopRequested = false;
    this.lastRawResponse = null;
    this.lastDebugEntry = null; // { timestamp, endpoint, requestData, responseData, error }
  }

  /**
   * Apply message-level transforms (prefixes, etc.) before sending.
   */
  prepareMessages(messages) {
    if (!messages) return messages;

    if (configStore.get("prompts.contentPolicyPrefix")) {
      const prefix = getPrompt("content_policy_prefix").systemPrompt;
      if (prefix) {
        messages = messages.map((m) =>
          m.role === "system" ? { ...m, content: prefix + "\n\n" + m.content } : m,
        );
      }
    }

    return messages;
  }

  /**
   * Resolve endpoint, credentials, and timeout for a request type.
   */
  resolveRequestConfig(isImageRequest) {
    const kind = isImageRequest ? "image" : "text";
    return {
      endpoint: isImageRequest ? "/api/image/generations" : "/api/text/chat/completions",
      apiKey: configStore.get(`api.${kind}.apiKey`),
      apiUrl: configStore.get(`api.${kind}.baseUrl`),
      timeout: configStore.get(`api.${kind}.timeout`),
    };
  }

  async makeRequest(endpoint, data, isImageRequest = false, stream = false) {
    if (!isImageRequest && data.messages) {
      data = { ...data, messages: this.prepareMessages(data.messages) };
    }

    const reqConfig = this.resolveRequestConfig(isImageRequest);
    endpoint = reqConfig.endpoint;
    const { apiKey, apiUrl, timeout } = reqConfig;

    if (!apiKey) {
      throw new Error(
        "API key is required. Please configure your API settings.",
      );
    }

    if (!apiUrl) {
      throw new Error(
        "API URL is required. Please configure your API Base URL in settings.",
      );
    }

    const url = endpoint;
    // Proxy server handles authentication, pass API key and actual API URL in headers
    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "X-API-URL": apiUrl,
    };

    // Add streaming headers if needed
    if (stream) {
      headers.Accept = "text/event-stream";
    }

    const controller = new AbortController();
    this.userStopRequested = false;
    this.currentAbortController = controller;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    debugLog(`Making request to: ${url}`);
    debugLog(`Request data:`, data);
    debugLog(`Headers:`, headers);
    debugLog(`Using proxy endpoint: ${endpoint}`);
    debugLog(`API Key (first 10 chars): ${apiKey.substring(0, 10)}...`);
    debugLog(`API Key length: ${apiKey.length}`);

    debugLog("API Request:", {
      url,
      method: "POST",
      headers: {
        ...headers,
        Authorization: headers.Authorization
          ? "[REDACTED]"
          : headers["X-API-Key"]
            ? "[REDACTED]"
            : "NO AUTH",
      },
      dataKeys: Object.keys(data),
    });

    // Redact API key from debug entry
    const debugHeaders = { ...headers };
    if (debugHeaders['X-API-Key']) debugHeaders['X-API-Key'] = '[REDACTED]';
    if (debugHeaders['Authorization']) debugHeaders['Authorization'] = '[REDACTED]';
    const debugEntry = {
      timestamp: new Date().toISOString(),
      endpoint: url,
      requestData: { ...data, _headers: debugHeaders },
      responseData: null,
      error: null,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers, Authorization: "[REDACTED]" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      debugLog(`Response status: ${response.status}`);
      debugLog(`Response headers:`, [...response.headers.entries()]);

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData = {};
        try {
          const responseText = await response.text();
          console.error("API Error Response (raw):", responseText);
          errorData = JSON.parse(responseText);
          console.error("API Error Response (parsed):", errorData);
        } catch (e) {
          console.error("Failed to parse error response as JSON:", e);
        }

        const errorMessage =
          errorData.error?.message ||
          errorData.message ||
          errorData.detail ||
          errorData.error ||
          response.statusText;

        debugEntry.error = { status: response.status, message: errorMessage, body: errorData };
        this.lastDebugEntry = debugEntry;

        // Special handling for 401 errors
        if (response.status === 401) {
          throw new Error(`Authorization Error: ${errorMessage}

    Possible solutions:
    1. Check if API key is correct
    2. API key may be expired - generate a new one
    3. Try different authorization method (some APIs use X-API-Key header instead of Bearer)
    4. Ensure you're using the correct API endpoint`);
        }

        throw new Error(`API Error: ${response.status} - ${errorMessage}`);
      }

      if (stream || isImageRequest) {
        this.lastDebugEntry = debugEntry; // response captured later for streaming
        return response;
      } else {
        const result = await response.json();
        debugLog("API Response:", result);
        debugEntry.responseData = result;
        this.lastDebugEntry = debugEntry;
        return result;
      }
    } catch (error) {
      if (!debugEntry.error) debugEntry.error = { message: error.message };
      this.lastDebugEntry = debugEntry;
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        if (this.userStopRequested) {
          throw new Error("Generation stopped by user.");
        }
        throw new Error(
          "Request timed out or was interrupted. Consider increasing API timeout in settings.",
        );
      }

      console.error("API Request Failed:", error);
      throw error;
    } finally {
      this.currentAbortController = null;
    }
  }

  async handleStreamResponse(response, onStream) {
    const reader = response.body.getReader();
    this.currentReader = reader; // Store reader reference for cancellation
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";

              if (content) {
                fullContent += content;
                onStream(content, fullContent);
              }
            } catch (e) {
              console.warn("Failed to parse streaming data:", data);
            }
          }
        }
      }

      this.lastRawResponse = fullContent;
      return fullContent;
    } catch (error) {
      console.error("Stream processing error:", error);
      throw error;
    } finally {
      this.currentReader = null;
    }
  }

  async generateCharacter(
    prompt,
    characterName,
    onStream = null,
    pov = "first",
    lorebook = null,
  ) {
    const characterPrompt = this.buildCharacterPrompt(
      prompt,
      characterName,
      pov,
      lorebook,
    );
    const model = configStore.get("api.text.model") || "glm-4-6"; // Fallback to your specified model

    debugLog("Using text model:", model);
    debugLog(
      "Character name provided:",
      characterName || "(AI will generate)",
    );

    const data = {
      model: model,
      messages: [
        {
          role: "system",
          content: characterPrompt.systemPrompt,
        },
        {
          role: "user",
          content: characterPrompt.userPrompt,
        },
      ],
      temperature: characterPrompt.temperature ?? 0.8,
      max_tokens: characterPrompt.maxTokens ?? 8192,
      stream: !!onStream,
    };

    if (onStream) {
      // Handle streaming response
      const response = await this.makeRequest(
        "/chat/completions",
        data,
        false,
        true,
      );
      return this.handleStreamResponse(response, onStream);
    } else {
      // Handle regular response with retry for auth errors
      try {
        const response = await this.makeRequest(
          "/chat/completions",
          data,
          false,
          false,
        );
        return this.processNormalResponse(response);
      } catch (error) {
        if (
          error.message.includes("401") ||
          error.message.includes("Authorization")
        ) {
          debugLog("Trying alternative auth methods...");
          const response = await this.tryAlternativeAuth(
            "/chat/completions",
            data,
          );
          return this.processNormalResponse(response);
        }
        throw error;
      }
    }
  }

  async generateImage(
    characterDescription,
    characterName,
    customPrompt = null,
  ) {
    // Use custom prompt if provided, otherwise generate one from AI
    let imagePrompt;
    if (customPrompt) {
      imagePrompt = customPrompt;
      // Apply length limit to custom prompts as well
      imagePrompt = await this.truncateImagePrompt(imagePrompt);
    } else {
      // Use AI to generate a detailed natural language prompt
      console.log("=== GENERATING IMAGE PROMPT VIA TEXT API ===");
      console.log("Character name:", characterName);
      console.log(
        "Character description length:",
        characterDescription?.length || 0,
      );

      try {
        imagePrompt = await this.generateImagePrompt(
          characterDescription,
          characterName,
        );
      } catch (error) {
        console.error("Failed to generate image prompt:", error);
        throw new Error(`Failed to generate image prompt: ${error.message}`);
      }
    }

    // Validate that we have a prompt before proceeding
    if (
      !imagePrompt ||
      typeof imagePrompt !== "string" ||
      imagePrompt.trim().length === 0
    ) {
      console.error("=== IMAGE PROMPT VALIDATION FAILED ===");
      console.error("Image prompt value:", imagePrompt);
      console.error("Image prompt type:", typeof imagePrompt);
      throw new Error(
        "Image prompt is empty or invalid. Cannot generate image without a prompt. " +
          "This usually means the text API failed to generate a prompt description.",
      );
    }

    // Store the prompt so it can be accessed later
    this.lastGeneratedImagePrompt = imagePrompt;

    const model = configStore.get("api.image.model");

    console.log("=== SENDING TO IMAGE API ===");
    console.log("Using image model:", model);
    console.log("Using custom prompt:", !!customPrompt);
    console.log("Image prompt length:", imagePrompt.length);
    console.log("Full image prompt being sent:");
    console.log(imagePrompt);
    console.log("=== END PROMPT ===");

    // Use ImageRouter format with optional size parameter
    const data = {
      model: model,
      prompt: imagePrompt,
      n: 1,
      response_format: "url",
    };

    // Add size only if user has specified it
    const imageSize = configStore.get("api.image.size");
    if (imageSize && imageSize.trim() !== "") {
      data.size = imageSize.trim();
    }
    const endpoint = "/api/image/generations";

    const response = await this.makeRequest(endpoint, data, true);

    // Check if response is an error before parsing
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image API error response:", errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        throw new Error(`Image API Error (${response.status}): ${errorText}`);
      }
      const errorMessage =
        errorData.error?.message ||
        errorData.message ||
        errorData.error ||
        "Unknown error";
      throw new Error(`Image API Error (${response.status}): ${errorMessage}`);
    }

    const result = await response.json();

    // Check if response contains an error object
    if (result.error) {
      console.error("Image API returned error object:", result.error);
      const errorMsg =
        result.error.message || result.error.details || result.error;
      throw new Error(`Image API Error: ${errorMsg}`);
    }

    if (result.data && result.data.length > 0) {
      return result.data[0].url;
    } else if (result.image) {
      return result.image;
    } else if (result.url) {
      return result.url;
    } else {
      console.error(
        "Unexpected image API response format. Full response:",
        result,
      );
      throw new Error(
        "Unexpected image API response format: " + JSON.stringify(result),
      );
    }
  }

  async generateImagePrompt(characterDescription, characterName) {
    // Validate inputs
    if (!characterDescription || !characterName) {
      throw new Error(
        "Character description and name are required to generate an image prompt",
      );
    }

    // Build the meta-prompt that asks AI to create an image prompt
    const metaPrompt = this.buildImagePromptInstruction(
      characterDescription,
      characterName,
    );

    // Call the text API to generate the actual image prompt
    // Use streaming mode to avoid reasoning_content issue with GLM models
    const model = configStore.get("api.text.model");
    const imagePromptConfig = getPrompt("image_prompt");
    const data = {
      model: model,
      messages: [
        {
          role: "user",
          content: metaPrompt,
        },
      ],
      max_tokens: imagePromptConfig.maxTokens ?? 8192,
      temperature: imagePromptConfig.temperature ?? 0.7,
      stream: true, // Enable streaming to get only content, not reasoning
    };

    const endpoint = "/api/text/chat/completions";

    let response;
    try {
      response = await this.makeRequest(endpoint, data, false, true);
    } catch (error) {
      console.error("Text API request failed:", error);
      throw new Error(
        `Failed to call text API for image prompt generation: ${error.message}`,
      );
    }

    // Handle streaming response - collect all content
    const generatedPrompt = await this.handleStreamResponse(response, () => {});

    if (!generatedPrompt || generatedPrompt.trim().length === 0) {
      console.error("Text API returned empty prompt");
      throw new Error("Text API returned an empty image prompt");
    }

    // Ensure the prompt fits within 1000 character limit with smart truncation
    return await this.truncateImagePrompt(generatedPrompt.trim());
  }

  async truncateImagePrompt(prompt) {
    const MAX_LENGTH = 1000;

    if (prompt.length <= MAX_LENGTH) {
      return prompt;
    }

    console.log(
      `Image prompt too long (${prompt.length} chars). Using AI to shorten to ${MAX_LENGTH} chars...`,
    );

    // Use AI to intelligently shorten the prompt instead of mechanical truncation
    const model = configStore.get("api.text.model");

    const data = {
      model: model,
      messages: [
        {
          role: "user",
          content: `The following image generation prompt is too long. Shorten it to EXACTLY one paragraph (around 800-900 characters) while preserving all the key visual details, character features, and mood. Do NOT add explanations, just output the shortened prompt directly.

Original prompt:
${prompt}

Shortened prompt (one paragraph):`,
        },
      ],
      max_tokens: 8192, // High limit for thinking models (reasoning + output)
      temperature: 0.3,
      stream: true,
    };

    const endpoint = "/api/text/chat/completions";

    try {
      const response = await this.makeRequest(endpoint, data, false, true);

      const shortenedPrompt = await this.handleStreamResponse(
        response,
        (chunk, full) => {},
      );

      const finalPrompt = shortenedPrompt.trim();
      console.log(`Shortened prompt to ${finalPrompt.length} characters`);

      // Check if AI returned empty content - fall back to mechanical truncation
      if (!finalPrompt || finalPrompt.length === 0) {
        console.warn(
          "AI returned empty shortened prompt, using fallback truncation",
        );
        const truncated = prompt.substring(0, MAX_LENGTH - 3) + "...";
        console.log(`Fallback truncation to ${truncated.length} characters`);
        return truncated;
      }

      // Final safety check - if still too long, do mechanical truncation
      if (finalPrompt.length > MAX_LENGTH) {
        console.warn(
          "AI shortened prompt still too long, applying final truncation",
        );
        return finalPrompt.substring(0, MAX_LENGTH - 3) + "...";
      }

      return finalPrompt;
    } catch (error) {
      console.error(
        "AI shortening failed, falling back to mechanical truncation:",
        error,
      );

      // Fallback to simple truncation
      const truncated = prompt.substring(0, MAX_LENGTH - 3) + "...";
      console.log(`Fallback truncation to ${truncated.length} characters`);
      return truncated;
    }
  }

  buildDirectImagePrompt(characterDescription, characterName) {
    // Extract key information from character description
    const appearanceMatch = characterDescription.match(
      /\*\*Appearance:\*\*([\s\S]*?)(?=\*\*My Story:|\*\*How I Am|\*\*How I Operate|\n##)/i,
    );
    const appearanceText = appearanceMatch ? appearanceMatch[1].trim() : "";

    // Extract personality keywords for mood/expression
    const personalityTraits =
      this.extractPersonalityTraits(characterDescription);

    // Build a direct, detailed image prompt without meta-prompting
    let prompt = `A highly detailed portrait of ${characterName || "a character"}. `;

    if (appearanceText) {
      // Clean up the appearance text and make it more suitable for image generation
      const cleanedAppearance = appearanceText
        .replace(/\*\*/g, "") // Remove markdown bold
        .replace(/\n+/g, " ") // Replace newlines with spaces
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      prompt += cleanedAppearance + " ";
    }

    // Add personality-based mood and expression
    if (personalityTraits.length > 0) {
      const moodMap = {
        sarcastic: "with a slight smirk and knowing eyes",
        stoic: "with a calm, composed expression",
        cynical: "with a skeptical, world-weary gaze",
        optimistic: "with bright, hopeful eyes and a warm smile",
        shy: "with a gentle, reserved demeanor",
        confident: "with bold, self-assured posture",
        mysterious: "with an enigmatic expression",
        friendly: "with an approachable, warm expression",
        serious: "with focused, intense eyes",
        playful: "with a mischievous glint in their eyes",
      };

      const mood = moodMap[personalityTraits[0]] || "with an expressive face";
      prompt += mood + ". ";
    }

    // Add artistic style and quality tags
    prompt +=
      "Professional character portrait, detailed features, high quality, realistic style, " +
      "sharp focus, well-lit, cinematic lighting, depth of field, 4k, highly detailed. " +
      "Appropriate background that suits the character's setting and personality.";

    return prompt;
  }

  buildCharacterPrompt(concept, characterName, pov = "first", lorebook = null) {
    let promptId;
    if (pov === "scenario") {
      promptId = "generate_scenario";
    } else if (pov === "third") {
      promptId = "generate_third_person";
    } else {
      promptId = "generate_first_person";
    }
    const prompt = getPrompt(promptId);

    // Handle Lorebook -- support both legacy format and new characterBook format
    let lorebookContent = "";
    let lorebookEntries = [];
    if (lorebook) {
      if (Array.isArray(lorebook.entries)) {
        lorebookEntries = lorebook.entries.filter((e) => e.enabled !== false);
      } else if (lorebook.entries && typeof lorebook.entries === "object") {
        lorebookEntries = Object.values(lorebook.entries).filter(
          (e) => e.enabled !== false,
        );
      }
    }
    if (lorebookEntries.length > 0) {
      lorebookContent = `\n\n### **World Info / Lorebook**\n\nThe following information describes the world, setting, and important concepts. Use this information to ground the scenario in its specific universe.\n\n`;
      lorebookEntries.forEach((entry) => {
        const keys = entry.keys || entry.key || [];
        lorebookContent += `**Keys:** ${keys.join(", ")}\n`;
        lorebookContent += `**Content:**\n${entry.content}\n\n---\n\n`;
      });
    }

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      concept,
      characterName: pov === "scenario" ? "" : characterName,
      lorebookContent,
    });

    return {
      systemPrompt: prompt.systemPrompt,
      userPrompt: userPrompt,
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
    };
  }

  buildImagePromptInstruction(characterDescription, characterName) {
    const personalityTraits =
      this.extractPersonalityTraits(characterDescription);
    const prompt = getPrompt("image_prompt");

    return renderTemplate(prompt.systemPrompt, {
      characterName: characterName || "Unknown",
      characterDescription,
      personalityTraits,
    });
  }

  extractPersonalityTraits(text) {
    const traits = [];

    // Look for personality keywords
    if (text.toLowerCase().includes("sarcastic")) traits.push("sarcastic");
    if (
      text.toLowerCase().includes("stoic") ||
      text.toLowerCase().includes("stoicism")
    )
      traits.push("stoic");
    if (text.toLowerCase().includes("cynical")) traits.push("cynical");
    if (
      text.toLowerCase().includes("optimistic") ||
      text.toLowerCase().includes("optimism")
    )
      traits.push("optimistic");
    if (text.toLowerCase().includes("formal")) traits.push("formal");
    if (
      text.toLowerCase().includes("vulgar") ||
      text.toLowerCase().includes("crass")
    )
      traits.push("rough-speaking");
    if (
      text.toLowerCase().includes("quiet") ||
      text.toLowerCase().includes("reserved")
    )
      traits.push("reserved");
    if (text.toLowerCase().includes("graceful")) traits.push("graceful");
    if (text.toLowerCase().includes("clumsy")) traits.push("clumsy");
    if (text.toLowerCase().includes("restless")) traits.push("restless");
    if (
      text.toLowerCase().includes("menacing") ||
      text.toLowerCase().includes("intimidating")
    )
      traits.push("menacing");

    return traits.length > 0 ? traits.join(", ") : "complex personality";
  }

  async tryAlternativeAuth(endpoint, data) {
    const altAuthMethods = [
      () => this.makeRequestWithAuth(endpoint, data, "X-API-Key"),
      () => this.makeRequestWithAuth(endpoint, data, "api-key"),
      () => this.makeRequestWithAuth(endpoint, data, "Authorization", ""), // No Bearer prefix
      () => this.makeRequestWithAuth(endpoint, data, "Authorization", "Token "),
    ];

    for (const [index, tryAuth] of altAuthMethods.entries()) {
      try {
        debugLog(`Trying auth method ${index + 1}...`);
        const response = await tryAuth();
        return this.processNormalResponse(response);
      } catch (error) {
        debugLog(`Auth method ${index + 1} failed: `, error.message);
        if (index < altAuthMethods.length - 1) {
          continue; // Try next method
        }
        throw error; // All methods failed
      }
    }
  }

  async makeRequestWithAuth(endpoint, data, authHeader, prefix = "Bearer ") {
    const baseUrl = configStore.get("api.text.baseUrl");
    const apiKey = configStore.get("api.text.apiKey");
    const timeout = configStore.get("api.text.timeout");

    const headers = {
      "Content-Type": "application/json",
      [authHeader]: prefix ? `${prefix}${apiKey} ` : apiKey,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}${endpoint} `, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} `);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  processNormalResponse(response) {
    this.lastRawResponse = response;
    if (
      response.choices &&
      response.choices[0] &&
      response.choices[0].message
    ) {
      const message = response.choices[0].message;
      // Prefer content; fall back to reasoning_content only if content is null/undefined
      // (not empty string — some reasoning models return content="" legitimately)
      const text = message.content != null ? message.content : (message.reasoning_content ?? "");
      return text;
    } else if (
      response.data &&
      response.data.choices &&
      response.data.choices[0]
    ) {
      return (
        response.data.choices[0].message?.content ||
        response.data.choices[0].text
      );
    } else if (response.content) {
      return response.content;
    } else {
      console.error("Unexpected response format:", response);
      throw new Error("Unexpected API response format");
    }
  }

  async testConnection(overrides = {}) {
    try {
      const apiKey = overrides.apiKey || configStore.get("api.text.apiKey");
      if (!apiKey) {
        return { success: false, error: "No API key configured" };
      }

      const baseUrl = overrides.baseUrl || configStore.get("api.text.baseUrl");
      const model = overrides.model || configStore.get("api.text.model");

      // Test with exact same format as working curl command
      const data = {
        model,
        messages: [
          {
            role: "user",
            content: 'Respond with just "OK"',
          },
        ],
        max_tokens: 100,
      };

      // Build request manually with overrides (bypass resolveRequestConfig)
      const url = "/api/text/chat/completions";
      const headers = {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-API-URL": baseUrl,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`${resp.status}: ${errText.slice(0, 200)}`);
        }
        return { success: true };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  parseJsonFromModelOutput(output) {
    if (!output || typeof output !== "string") {
      throw new Error("Model output is empty");
    }

    let cleaned = output.trim();

    // Strip markdown code fences if present
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    // Try array first, then object — order matters for suggest which returns []
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);

    if (arrayMatch && objectMatch) {
      // Both present — pick whichever starts first in the string
      cleaned = arrayMatch.index < objectMatch.index ? arrayMatch[0] : objectMatch[0];
    } else if (arrayMatch) {
      cleaned = arrayMatch[0];
    } else if (objectMatch) {
      cleaned = objectMatch[0];
    }

    return JSON.parse(cleaned);
  }

  async reviseCharacter(currentCharacter, revisionInstruction, pov = "first") {
    if (!currentCharacter) {
      throw new Error("Character is required for revision");
    }
    if (!revisionInstruction || !revisionInstruction.trim()) {
      throw new Error("Revision instruction is required");
    }

    const model = configStore.get("api.text.model");
    const prompt = getPrompt("revise");

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      revisionInstruction,
      currentCharacterJson: JSON.stringify(currentCharacter, null, 2),
    });

    const data = {
      model,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: prompt.temperature ?? 0.7,
      max_tokens: prompt.maxTokens ?? 8192,
      stream: false,
    };

    const response = await this.makeRequest(
      "/chat/completions",
      data,
      false,
      false,
    );
    const output = this.processNormalResponse(response);
    const parsed = this.parseJsonFromModelOutput(output);

    const result = {
      name: parsed.name || currentCharacter.name || "Unnamed Character",
      description: parsed.description || currentCharacter.description || "",
      personality: parsed.personality || currentCharacter.personality || "",
      scenario: parsed.scenario || currentCharacter.scenario || "",
      firstMessage: parsed.firstMessage || currentCharacter.firstMessage || "",
    };

    // Preserve optional fields if they exist on the current character
    if ("systemPrompt" in currentCharacter) {
      result.systemPrompt = parsed.systemPrompt ?? currentCharacter.systemPrompt ?? "";
    }
    if ("postHistoryInstructions" in currentCharacter) {
      result.postHistoryInstructions = parsed.postHistoryInstructions ?? currentCharacter.postHistoryInstructions ?? "";
    }
    if ("mesExample" in currentCharacter) {
      result.mesExample = parsed.mesExample ?? currentCharacter.mesExample ?? "";
    }

    return result;
  }

  async suggestConcepts(idea, count = 4, pov = 'first') {
    if (!idea || !idea.trim()) {
      throw new Error('An idea or theme is required for suggestions.');
    }

    const model = configStore.get('api.text.model');
    const prompt = getPrompt('suggest_concepts');

    const povLabels = { first: 'first-person', third: 'third-person', scenario: 'scenario/setting' };
    const povNote = povLabels[pov] || pov;

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      idea: idea.trim(),
      count,
      povNote,
    });

    const data = {
      model,
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: prompt.temperature ?? 0.95,
      max_tokens: prompt.maxTokens ?? 1024,
      stream: false,
    };

    const response = await this.makeRequest('/chat/completions', data, false, false);
    const output = this.processNormalResponse(response);
    const suggestions = this.parseJsonFromModelOutput(output);

    if (!Array.isArray(suggestions)) {
      throw new Error('Unexpected response format from suggestions API.');
    }

    return suggestions.filter((s) => s && typeof s.title === 'string' && typeof s.concept === 'string');
  }

  async evaluateCard(character) {
    if (!character) {
      throw new Error("Character is required for evaluation");
    }

    const model = configStore.get("api.text.model");
    const prompt = getPrompt("evaluate");

    // Summarize lorebook entries for evaluation context
    const entries = character.characterBook?.entries || [];
    const lorebookSummary = entries.length > 0
      ? entries
          .filter((e) => e.enabled !== false)
          .map((e) => `- ${e.name || e.keys?.[0] || "unnamed"} [keys: ${(e.keys || []).join(", ")}]: ${(e.content || "").substring(0, 200)}${(e.content || "").length > 200 ? "\u2026" : ""}`)
          .join("\n")
      : "";

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      characterName: character.name || "(empty)",
      description: character.description || "(empty)",
      personality: character.personality || "(empty)",
      scenario: character.scenario || "(empty)",
      firstMessage: character.firstMessage || "(empty)",
      mesExample: character.mesExample || "(empty)",
      lorebookSummary,
    });

    const data = {
      model,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: prompt.temperature ?? 0.4,
      max_tokens: prompt.maxTokens ?? 4096,
      stream: false,
    };

    const response = await this.makeRequest("/chat/completions", data, false, false);
    const output = this.processNormalResponse(response);
    return this.parseJsonFromModelOutput(output);
  }

  async describeReferenceImage(imageDataUrl, manualHint = "") {
    if (!imageDataUrl) {
      throw new Error("Reference image is required");
    }

    const model =
      configStore.get("api.text.visionModel") ||
      configStore.get("api.text.model");
    if (!model) {
      throw new Error("No vision model or text model configured");
    }

    const prompt = getPrompt("image_describe");
    const userText = renderTemplate(prompt.userPromptTemplate, { manualHint });

    const data = {
      model,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: prompt.temperature ?? 0.3,
      max_tokens: prompt.maxTokens ?? 500,
      stream: false,
    };

    const response = await this.makeRequest(
      "/chat/completions",
      data,
      false,
      false,
    );

    return this.processNormalResponse(response).trim();
  }

  async extractLorebook(character) {
    if (!character) {
      throw new Error("Character is required for lorebook extraction");
    }

    const model = configStore.get("api.text.model");
    const prompt = getPrompt("extract_lorebook");

    // Build existing entries summary to avoid duplicates
    const existingEntries = character.characterBook?.entries?.length
      ? character.characterBook.entries
          .map((e) => `- ${e.name || e.keys?.[0] || "unnamed"}: ${e.keys?.join(", ")}`)
          .join("\n")
      : "";

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      characterName: character.name || "(unnamed)",
      description: character.description || "(empty)",
      personality: character.personality || "(empty)",
      scenario: character.scenario || "(empty)",
      existingEntries,
    });

    const data = {
      model,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: prompt.temperature ?? 0.6,
      max_tokens: prompt.maxTokens ?? 8192,
      stream: true,
    };

    const response = await this.makeRequest("/chat/completions", data, false, true);
    const output = await this.handleStreamResponse(response, () => {});
    return this.parseLorebookResponse(output);
  }

  async generateLorebook(character, existingEntries = [], guidance = "") {
    if (!character) {
      throw new Error("Character is required for lorebook generation");
    }

    const model = configStore.get("api.text.model");
    const prompt = getPrompt("generate_lorebook");

    // Build full card context -- this is the source of truth
    const cardParts = [];
    if (character.name) cardParts.push(`Name: ${character.name}`);
    if (character.description) cardParts.push(`Description:\n${character.description}`);
    if (character.personality) cardParts.push(`Personality:\n${character.personality}`);
    if (character.scenario) cardParts.push(`Scenario:\n${character.scenario}`);
    const cardContext = cardParts.join("\n\n");

    // Send full entry content so the AI can fix inconsistencies
    const existingEntriesSummary = existingEntries.length
      ? existingEntries
          .map((e) => {
            const name = e.name || e.keys?.[0] || "unnamed";
            const keys = (e.keys || []).join(", ");
            const content = e.content || "(empty)";
            const constant = e.constant ? " [constant]" : "";
            return `### ${name}${constant}\nKeys: ${keys}\n${content}`;
          })
          .join("\n\n")
      : "";

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      cardContext,
      existingEntries: existingEntriesSummary,
      guidance,
    });

    const data = {
      model,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: prompt.temperature ?? 0.8,
      max_tokens: prompt.maxTokens ?? 8192,
      stream: true,
    };

    const response = await this.makeRequest("/chat/completions", data, false, true);
    const output = await this.handleStreamResponse(response, () => {});
    return this.parseLorebookResponse(output);
  }

  parseLorebookResponse(output) {
    if (!output || typeof output !== "string") {
      throw new Error("Empty response from AI");
    }

    let cleaned = output.trim();

    // Strip markdown code fences anywhere in the output
    cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

    // Try to find a JSON array in the output (model may include prose before/after)
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      cleaned = arrayMatch[0];
    } else {
      console.error("No JSON array found in lorebook response:", output.substring(0, 500));
      // Show the model's actual response (truncated) so the user can see refusals etc.
      const preview = cleaned.substring(0, 150).replace(/\n/g, " ").trim();
      throw new Error(`AI did not return valid entries: "${preview}${cleaned.length > 150 ? "\u2026" : ""}"`);
    }

    const entries = JSON.parse(cleaned);
    if (!Array.isArray(entries)) {
      throw new Error("Expected JSON array of entries");
    }

    // Import characterGenerator inline to avoid circular dependency at module level
    // (characterGenerator imports apiHandler, apiHandler would import characterGenerator)
    return entries.map((entry) =>
      normalizeLorebookEntryStandalone(entry),
    );
  }

  // Method to stop current generation
  stopGeneration() {
    this.userStopRequested = true;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    if (this.currentReader) {
      this.currentReader.cancel();
      this.currentReader = null;
    }
  }
}

// Standalone lorebook entry normalizer to avoid circular dependency with characterGenerator
function normalizeLorebookEntryStandalone(entry) {
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

export const apiHandler = new APIHandler();
export default apiHandler;
