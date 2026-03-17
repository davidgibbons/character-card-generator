const express = require("express");
const path = require("path");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");
require("dotenv").config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 2426;

// Enable CORS
app.use(cors());

// Serve static frontend files
const staticRoot = process.env.STATIC_ROOT || path.join(__dirname, "..");
app.use(express.static(staticRoot));

// Increase payload limits for vision requests that include base64 images.
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Proxy endpoint for text API
app.post("/api/text/chat/completions", async (req, res) => {
  try {
    const { model, messages, max_tokens, temperature, stream } = req.body;

    const apiKey = req.headers["x-api-key"];
    const apiUrl = req.headers["x-api-url"];

    if (!apiKey) {
      console.error("Missing API key in request headers");
      return res.status(401).json({
        error: {
          code: "401",
          message: "API key required",
          details: "Please configure your Text API key in the settings",
        },
      });
    }

    if (!apiUrl) {
      console.error("Missing API URL in request headers");
      return res.status(400).json({
        error: {
          code: "400",
          message: "API URL required",
          details: "Please configure your Text API Base URL in the settings",
        },
      });
    }

    // Append the endpoint path if not already present
    const fullTextUrl = apiUrl.endsWith("/chat/completions")
      ? apiUrl
      : `${apiUrl}/chat/completions`;

    console.log("Proxying text request to:", fullTextUrl);
    console.log("Model:", model);
    console.log("Messages count:", messages?.length || 0);

    // Add OpenRouter-specific headers if using OpenRouter
    const isOpenRouter = apiUrl.includes("openrouter.ai");
    const additionalHeaders = isOpenRouter
      ? {
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:2427",
          "X-Title": "SillyTavern Character Generator",
        }
      : {};

    const requestBody = {
      model,
      messages,
      max_tokens: max_tokens || 1000,
      temperature: temperature || 0.7,
      stream: stream || false,
    };

    // Try Bearer auth first (most common)
    let response = await fetch(fullTextUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...additionalHeaders,
      },
      body: JSON.stringify(requestBody),
    });

    // If Bearer fails with 401, try X-API-Key
    if (response.status === 401) {
      console.log("Bearer auth failed, trying X-API-Key...");
      response = await fetch(fullTextUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          ...additionalHeaders,
        },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Text API error:", response.status, errorText);
      return res.status(response.status).json({
        error: {
          code: response.status.toString(),
          message: `API Error: ${response.statusText}`,
          details: errorText,
        },
      });
    }

    if (stream) {
      // Handle streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      response.body.on("data", (chunk) => {
        res.write(chunk);
      });

      response.body.on("end", () => {
        res.end();
      });
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({
      error: {
        code: "500",
        message: "Internal server error in proxy",
        details: error.message,
      },
    });
  }
});

// Proxy endpoint for image API
app.post("/api/image/generations", async (req, res) => {
  try {
    const { model, prompt, size } = req.body;

    const apiKey = req.headers["x-api-key"];
    const apiUrl = req.headers["x-api-url"];

    if (!apiKey) {
      console.error("Missing API key in request headers");
      return res.status(401).json({
        error: {
          code: "401",
          message: "Image API key required",
          details: "Please configure your Image API key in the settings",
        },
      });
    }

    if (!apiUrl) {
      console.error("Missing API URL in request headers");
      return res.status(400).json({
        error: {
          code: "400",
          message: "Image API URL required",
          details: "Please configure your Image API Base URL in the settings",
        },
      });
    }

    // Append the endpoint path if not already present
    const fullImageUrl = apiUrl.endsWith("/images/generations")
      ? apiUrl
      : `${apiUrl}/images/generations`;

    console.log("Proxying image request to:", fullImageUrl);
    console.log("Model:", model);
    console.log("Prompt length:", prompt?.length || 0);

    // Use simplified format for all models, but forward all parameters
    // This supports APIs like NanoGPT that need n, response_format, etc.
    const requestBody = {
      ...req.body,
    };

    // Ensure model is set (should be from req.body, but just in case)
    if (!requestBody.model) requestBody.model = model;
    if (!requestBody.prompt) requestBody.prompt = prompt;

    // Add size only if provided by the client and not already in body
    if (size && !requestBody.size) {
      requestBody.size = size;
    }

    // Add OpenRouter-specific headers if using OpenRouter
    const isOpenRouter = apiUrl.includes("openrouter.ai");
    const additionalHeaders = isOpenRouter
      ? {
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:2427",
          "X-Title": "SillyTavern Character Generator",
        }
      : {};

    // Try Bearer auth first (most common for image APIs)
    let response = await fetch(fullImageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...additionalHeaders,
      },
      body: JSON.stringify(requestBody),
    });

    // If Bearer fails with 401, try X-API-Key
    if (response.status === 401) {
      console.log("Bearer auth failed for image API, trying X-API-Key...");
      response = await fetch(fullImageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          ...additionalHeaders,
        },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image API error:", response.status, errorText);
      return res.status(response.status).json({
        error: {
          code: response.status.toString(),
          message: `Image API Error: ${response.statusText}`,
          details: errorText,
        },
      });
    }

    const data = await response.json();

    // Handle different response formats flexibly
    // Just pass through whatever the image API returns
    res.json(data);
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).json({
      error: {
        code: "500",
        message: "Internal server error in image proxy",
        details: error.message,
      },
    });
  }
});

// Proxy endpoint for fetching images (CORS bypass)
app.get("/api/proxy-image", async (req, res) => {
  try {
    const imageUrl = req.query.url;

    if (!imageUrl) {
      return res.status(400).json({
        error: {
          code: "400",
          message: "Image URL required",
          details: "Please provide a URL parameter with the image URL",
        },
      });
    }

    console.log("Proxying image request for:", imageUrl);

    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error(
        "Failed to fetch image:",
        response.status,
        response.statusText,
      );
      return res.status(response.status).json({
        error: {
          code: response.status.toString(),
          message: `Failed to fetch image: ${response.statusText}`,
          details: `Image URL: ${imageUrl}`,
        },
      });
    }

    // Get the image as a buffer
    const imageBuffer = await response.buffer();

    // Set appropriate headers
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000");

    // Send the image
    res.send(imageBuffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).json({
      error: {
        code: "500",
        message: "Internal server error in image proxy",
        details: error.message,
      },
    });
  }
});

// --- SillyTavern Integration Endpoints ---

// Helper: get a CSRF token from a SillyTavern instance
async function getSTCsrfToken(stUrl, stPassword) {
  const headers = {};
  if (stPassword) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`user:${stPassword}`).toString("base64");
  }
  const response = await fetch(`${stUrl}/csrf-token`, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to get CSRF token from SillyTavern (${response.status})`,
    );
  }
  // ST returns the token as a plain string or JSON depending on version
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return { token: json.token || text, cookies: response.headers.raw()["set-cookie"] || [] };
  } catch {
    return { token: text, cookies: response.headers.raw()["set-cookie"] || [] };
  }
}

// Build common ST request headers
function stHeaders(csrfToken, cookies, stPassword) {
  const headers = {
    "X-CSRF-Token": csrfToken,
    "Content-Type": "application/json",
  };
  if (cookies.length > 0) {
    headers["Cookie"] = cookies.map((c) => c.split(";")[0]).join("; ");
  }
  if (stPassword) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`user:${stPassword}`).toString("base64");
  }
  return headers;
}

// List all characters from SillyTavern
app.post("/api/st/characters", async (req, res) => {
  try {
    const stUrl = req.headers["x-st-url"];
    const stPassword = req.headers["x-st-password"] || "";

    if (!stUrl) {
      return res.status(400).json({
        error: { message: "SillyTavern URL required" },
      });
    }

    const { token, cookies } = await getSTCsrfToken(stUrl, stPassword);
    const response = await fetch(`${stUrl}/api/characters/all`, {
      method: "POST",
      headers: stHeaders(token, cookies, stPassword),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: { message: `SillyTavern API error: ${response.statusText}`, details: errorText },
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("ST list characters error:", error);
    res.status(500).json({
      error: { message: "Failed to list SillyTavern characters", details: error.message },
    });
  }
});

// Push a character card (PNG) to SillyTavern
app.post("/api/st/push", async (req, res) => {
  try {
    const stUrl = req.headers["x-st-url"];
    const stPassword = req.headers["x-st-password"] || "";

    if (!stUrl) {
      return res.status(400).json({
        error: { message: "SillyTavern URL required" },
      });
    }

    const { imageBase64, fileName } = req.body;
    if (!imageBase64) {
      return res.status(400).json({
        error: { message: "imageBase64 is required" },
      });
    }

    const { token, cookies } = await getSTCsrfToken(stUrl, stPassword);

    // Build multipart form data for ST import
    const form = new FormData();
    const imageBuffer = Buffer.from(imageBase64, "base64");
    form.append("avatar", imageBuffer, {
      filename: fileName || "character.png",
      contentType: "image/png",
    });
    form.append("file_type", "png");

    const headers = {
      "X-CSRF-Token": token,
      ...form.getHeaders(),
    };
    if (cookies.length > 0) {
      headers["Cookie"] = cookies.map((c) => c.split(";")[0]).join("; ");
    }
    if (stPassword) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`user:${stPassword}`).toString("base64");
    }

    const response = await fetch(`${stUrl}/api/characters/import`, {
      method: "POST",
      headers,
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: { message: `SillyTavern import error: ${response.statusText}`, details: errorText },
      });
    }

    const data = await response.json();
    console.log("Character pushed to SillyTavern:", data);
    res.json(data);
  } catch (error) {
    console.error("ST push error:", error);
    res.status(500).json({
      error: { message: "Failed to push character to SillyTavern", details: error.message },
    });
  }
});

// Pull a character from SillyTavern (export as JSON)
app.post("/api/st/pull", async (req, res) => {
  try {
    const stUrl = req.headers["x-st-url"];
    const stPassword = req.headers["x-st-password"] || "";

    if (!stUrl) {
      return res.status(400).json({
        error: { message: "SillyTavern URL required" },
      });
    }

    const { avatar_url } = req.body;
    if (!avatar_url) {
      return res.status(400).json({
        error: { message: "avatar_url is required" },
      });
    }

    const { token, cookies } = await getSTCsrfToken(stUrl, stPassword);
    const response = await fetch(`${stUrl}/api/characters/export`, {
      method: "POST",
      headers: stHeaders(token, cookies, stPassword),
      body: JSON.stringify({ avatar_url, format: "json" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: { message: `SillyTavern export error: ${response.statusText}`, details: errorText },
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("ST pull error:", error);
    res.status(500).json({
      error: { message: "Failed to pull character from SillyTavern", details: error.message },
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to proxy requests to configured APIs`);
  console.log(`🔑 API URLs will be provided via request headers`);
});
