// API Handler for OpenAI-compatible endpoints with streaming support
class APIHandler {
  constructor() {
    this.config = window.config;
    this.lastGeneratedImagePrompt = null; // Store the last generated prompt for display
    this.currentAbortController = null; // Store current abort controller for stopping generation
    this.currentReader = null; // Store current stream reader for cancellation
    this.userStopRequested = false;
    this.lastRawResponse = null; // Store last raw API response for debug modal
  }

  async makeRequest(endpoint, data, isImageRequest = false, stream = false) {
    // Use proxy server to bypass browser API restrictions
    // Both Nginx (prod/docker) and http-server (dev) are configured to proxy /api to the backend
    const baseUrl = "";
    const proxyEndpoint = isImageRequest
      ? "/api/image/generations"
      : "/api/text/chat/completions";
    endpoint = proxyEndpoint;

    const apiKey = isImageRequest
      ? this.config.get("api.image.apiKey")
      : this.config.get("api.text.apiKey");
    const apiUrl = isImageRequest
      ? this.config.get("api.image.baseUrl")
      : this.config.get("api.text.baseUrl");
    const timeout = isImageRequest
      ? this.config.get("api.image.timeout")
      : this.config.get("api.text.timeout");

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

    const url = `${baseUrl}${endpoint}`;
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

    this.config.log(`Making request to: ${url}`);
    this.config.log(`Request data:`, data);
    this.config.log(`Headers:`, headers);
    this.config.log(`Using proxy server: ${baseUrl}`);
    this.config.log(`API Key (first 10 chars): ${apiKey.substring(0, 10)}...`);
    this.config.log(`API Key length: ${apiKey.length}`);

    this.config.log("API Request:", {
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

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers, Authorization: "[REDACTED]" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      this.config.log(`Response status: ${response.status}`);
      this.config.log(`Response headers:`, [...response.headers.entries()]);

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

      if (stream) {
        return response;
      } else if (isImageRequest) {
        return response;
      } else {
        const result = await response.json();
        this.config.log("API Response:", result);
        return result;
      }
    } catch (error) {
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
    const model = this.config.get("api.text.model") || "glm-4-6"; // Fallback to your specified model

    this.config.log("Using text model:", model);
    this.config.log(
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
          this.config.log("Trying alternative auth methods...");
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

    const model = this.config.get("api.image.model");

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
    const imageSize = this.config.get("api.image.size");
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
    const model = this.config.get("api.text.model");
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
      `🔧 Image prompt too long (${prompt.length} chars). Using AI to shorten to ${MAX_LENGTH} chars...`,
    );

    // Use AI to intelligently shorten the prompt instead of mechanical truncation
    const model = this.config.get("api.text.model");

    // console.log(`🔍 DEBUG: Calling AI to shorten prompt`);
    // console.log(`🔍 DEBUG: Model: ${model}`);
    // console.log(`🔍 DEBUG: Original prompt length: ${prompt.length}`);

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
      // console.log(`🔍 DEBUG: Sending request to ${endpoint}`);
      const response = await this.makeRequest(endpoint, data, false, true);

      // console.log(`🔍 DEBUG: Got response, processing stream...`);
      const shortenedPrompt = await this.handleStreamResponse(
        response,
        (chunk, full) => {
          // console.log(`🔍 DEBUG: Stream chunk received, length: ${chunk.length}, total so far: ${full.length}`);
        },
      );

      // console.log(`🔍 DEBUG: Stream complete, raw shortened prompt: "${shortenedPrompt}"`);
      const finalPrompt = shortenedPrompt.trim();
      console.log(`✅ Shortened prompt to ${finalPrompt.length} characters`);

      // Check if AI returned empty content - fall back to mechanical truncation
      if (!finalPrompt || finalPrompt.length === 0) {
        console.warn(
          "⚠️ AI returned empty shortened prompt, using fallback truncation",
        );
        const truncated = prompt.substring(0, MAX_LENGTH - 3) + "...";
        console.log(`🔧 Fallback truncation to ${truncated.length} characters`);
        return truncated;
      }

      // Final safety check - if still too long, do mechanical truncation
      if (finalPrompt.length > MAX_LENGTH) {
        console.warn(
          "⚠️ AI shortened prompt still too long, applying final truncation",
        );
        return finalPrompt.substring(0, MAX_LENGTH - 3) + "...";
      }

      return finalPrompt;
    } catch (error) {
      console.error(
        "❌ AI shortening failed, falling back to mechanical truncation:",
        error,
      );

      // Fallback to simple truncation
      const truncated = prompt.substring(0, MAX_LENGTH - 3) + "...";
      console.log(`🔧 Fallback truncation to ${truncated.length} characters`);
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
    const promptId = pov === "third" ? "generate_third_person" : "generate_first_person";
    const prompt = getPrompt(promptId);

    // Handle Lorebook
    let lorebookContent = "";
    if (lorebook && lorebook.entries) {
      const entries = Object.values(lorebook.entries).filter(
        (e) => e.enabled !== false,
      );
      if (entries.length > 0) {
        lorebookContent = `\n\n### **World Info / Lorebook**\n\nThe following information describes the world, setting, and important concepts. Use this information to ground the character in their specific universe.\n\n`;
        entries.forEach((entry) => {
          lorebookContent += `**Keys:** ${entry.key.join(", ")}\n`;
          lorebookContent += `**Content:**\n${entry.content}\n\n---\n\n`;
        });
      }
    }

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      concept,
      characterName,
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
        this.config.log(`Trying auth method ${index + 1}...`);
        const response = await tryAuth();
        return this.processNormalResponse(response);
      } catch (error) {
        this.config.log(`Auth method ${index + 1} failed: `, error.message);
        if (index < altAuthMethods.length - 1) {
          continue; // Try next method
        }
        throw error; // All methods failed
      }
    }
  }

  async makeRequestWithAuth(endpoint, data, authHeader, prefix = "Bearer ") {
    const baseUrl = this.config.get("api.text.baseUrl");
    const apiKey = this.config.get("api.text.apiKey");
    const timeout = this.config.get("api.text.timeout");

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
    // Handle different response formats
    if (
      response.choices &&
      response.choices[0] &&
      response.choices[0].message
    ) {
      const message = response.choices[0].message;
      // Some models (like GLM) use reasoning_content instead of content
      return message.content || message.reasoning_content || "";
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

  async testConnection() {
    try {
      const apiKey = this.config.get("api.text.apiKey");
      if (!apiKey) {
        return { success: false, error: "No API key configured" };
      }

      // Test with exact same format as working curl command
      const data = {
        model: this.config.get("api.text.model"),
        messages: [
          {
            role: "user",
            content: 'Respond with just "OK"',
          },
        ],
        max_tokens: 100,
      };

      // Try with default auth first, then alternatives
      try {
        await this.makeRequest("/chat/completions", data);
        return { success: true };
      } catch (error) {
        if (error.message.includes("401")) {
          await this.tryAlternativeAuth("/chat/completions", data);
          return { success: true, authMethod: "alternative" };
        }
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

    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
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

    const model = this.config.get("api.text.model");
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

    return {
      name: parsed.name || currentCharacter.name || "Unnamed Character",
      description: parsed.description || currentCharacter.description || "",
      personality: parsed.personality || currentCharacter.personality || "",
      scenario: parsed.scenario || currentCharacter.scenario || "",
      firstMessage: parsed.firstMessage || currentCharacter.firstMessage || "",
    };
  }

  async evaluateCard(character) {
    if (!character) {
      throw new Error("Character is required for evaluation");
    }

    const model = this.config.get("api.text.model");
    const prompt = getPrompt("evaluate");

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      characterName: character.name || "(empty)",
      description: character.description || "(empty)",
      personality: character.personality || "(empty)",
      scenario: character.scenario || "(empty)",
      firstMessage: character.firstMessage || "(empty)",
      mesExample: character.mesExample || "(empty)",
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

  async generateExampleMessages(character, count = 3, pov = "first") {
    if (!character) {
      throw new Error("Character is required for example message generation");
    }

    const model = this.config.get("api.text.model");
    const povText = pov === "third" ? "third-person" : "first-person";
    const charName = character.name || "{{char}}";
    const prompt = getPrompt("example_messages");

    const systemPrompt = renderTemplate(prompt.systemPrompt, {
      povText,
      count: String(count),
    });

    const userPrompt = renderTemplate(prompt.userPromptTemplate, {
      charName,
      description: character.description || "No description provided",
      personality: character.personality || "No personality provided",
      firstMessage: character.firstMessage || "No first message provided",
      count: String(count),
      povText,
    });

    const data = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: prompt.temperature ?? 0.8,
      max_tokens: prompt.maxTokens ?? 4096,
      stream: false,
    };

    const response = await this.makeRequest(
      "/chat/completions",
      data,
      false,
      false,
    );
    const output = this.processNormalResponse(response);
    return output.trim();
  }

  async describeReferenceImage(imageDataUrl, manualHint = "") {
    if (!imageDataUrl) {
      throw new Error("Reference image is required");
    }

    const model =
      this.config.get("api.text.visionModel") ||
      this.config.get("api.text.model");
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

// Export singleton instance
window.apiHandler = new APIHandler();
