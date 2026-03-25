const express = require("express");
const path = require("path");
const cors = require("cors");
const compression = require("compression");
// Native FormData and Blob used for multipart uploads (Node 18+)
require("dotenv").config({ path: "../.env" });
const { router: cardsRouter, initGit } = require("./cards");
const { router: promptsRouter, initPrompts } = require("./prompts");

const app = express();
const PORT = process.env.PORT || 2426;

// ── SD API (A1111 / KoboldCpp) helpers ───────────────────────────────────────

function normalizeBase(url) {
  return (url || "").trim().replace(/\/+$/, "");
}

function isLikelyLocalUrl(url) {
  try {
    if (!url || typeof url !== "string") return false;
    const withScheme = /^https?:\/\//i.test(url.trim()) ? url.trim() : `http://${url.trim()}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
    const m = host.match(/^172\.(\d+)\./);
    if (m) { const n = parseInt(m[1], 10); if (n >= 16 && n <= 31) return true; }
    return false;
  } catch { return false; }
}

// KoboldCpp exposes an A1111-compatible SD API at /sdapi/v1/...
function looksLikeSdApi(url) {
  const u = (url || "").toLowerCase();
  return u.includes("/sdapi") || u.endsWith(":5001") || u.includes(":5001/");
}

function parseSize(sizeStr) {
  const m = (sizeStr || "").toLowerCase().match(/(\d+)\s*x\s*(\d+)/);
  if (!m) return { width: 1024, height: 1024 };
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

function normalizeDimension(value, fallback = 1024) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.round(Math.min(2048, Math.max(64, parsed)) / 64) * 64;
}

function buildSdTxt2ImgUrl(apiUrl) {
  let base = normalizeBase(apiUrl);
  if (base.endsWith("/sdapi/v1/txt2img")) return base;
  if (base.endsWith("/sdapi/v1")) return `${base}/txt2img`;
  if (base.endsWith("/v1")) base = base.slice(0, -3);
  if (base.includes("/sdapi/")) base = base.split("/sdapi/")[0];
  return `${base}/sdapi/v1/txt2img`;
}

function buildSdSamplersUrl(apiUrl) {
  let base = normalizeBase(apiUrl);
  if (base.endsWith("/sdapi/v1/samplers")) return base;
  if (base.endsWith("/sdapi/v1")) return `${base}/samplers`;
  if (base.endsWith("/v1")) base = base.slice(0, -3);
  if (base.includes("/sdapi/")) base = base.split("/sdapi/")[0];
  return `${base}/sdapi/v1/samplers`;
}

// ─────────────────────────────────────────────────────────────────────────────

// Enable CORS and gzip compression
app.use(cors());
app.use(compression());

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' http: https: data: blob: 'unsafe-inline'",
  );
  next();
});

// Serve static frontend files with cache headers
const staticRoot = process.env.STATIC_ROOT || path.join(__dirname, "..");
app.use(
  express.static(staticRoot, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".js")) {
        // No caching for JS — always fetch fresh so updates take effect immediately
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (/\.(css|png|jpg|jpeg|gif|ico|svg)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

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

      // Node 18 fetch returns a web ReadableStream, pipe it via async iterator
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (streamErr) {
        console.error("Stream read error:", streamErr);
      }
      res.end();
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

// Proxy endpoint for image API (OpenAI-compatible + A1111/SD API)
app.post("/api/image/generations", async (req, res) => {
  try {
    const { model, prompt, size } = req.body;

    const apiKey = req.headers["x-api-key"];
    const apiUrl = req.headers["x-api-url"];

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

    const preferSdApi = looksLikeSdApi(apiUrl) || isLikelyLocalUrl(apiUrl);
    const imageKeyRequired = !isLikelyLocalUrl(apiUrl) && !preferSdApi;
    if (imageKeyRequired && !apiKey) {
      console.error("Missing API key in request headers");
      return res.status(401).json({
        error: {
          code: "401",
          message: "Image API key required",
          details: "Please configure your Image API key in the settings",
        },
      });
    }

    // ── A1111 / KoboldCpp SD API path ────────────────────────────────────────
    if (preferSdApi) {
      let width, height;
      if (req.body.width && req.body.height) {
        width = normalizeDimension(req.body.width);
        height = normalizeDimension(req.body.height);
      } else {
        const parsed = parseSize(req.body.size || size);
        width = normalizeDimension(parsed.width);
        height = normalizeDimension(parsed.height);
      }

      const payload = {
        prompt: prompt || req.body.prompt,
        negative_prompt: req.body.negative_prompt,
        width,
        height,
        steps: req.body.steps ?? 40,
        cfg_scale: req.body.cfg_scale ?? 5,
        sampler_name: req.body.sampler_name ?? "Euler",
        seed: req.body.seed,
        batch_size: Math.max(1, Number(req.body.n || 1)),
      };

      const sdUrl = buildSdTxt2ImgUrl(apiUrl);
      console.log("Proxying SD API image request to:", sdUrl);

      const sdResponse = await fetch(sdUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!sdResponse.ok) {
        // Fall through to OpenAI-style endpoint if SD API isn't present
        if ([404, 405, 501].includes(sdResponse.status)) {
          console.log(`SD API not available (HTTP ${sdResponse.status}), falling back to /images/generations`);
        } else {
          const errorText = await sdResponse.text();
          console.error("SD API error:", sdResponse.status, errorText);
          return res.status(sdResponse.status).json({
            error: {
              code: sdResponse.status.toString(),
              message: `SD API Error: ${sdResponse.statusText}`,
              details: errorText,
            },
          });
        }
      } else {
        const data = await sdResponse.json();
        const images = Array.isArray(data?.images) ? data.images : [];
        if (images.length === 0) {
          return res.status(500).json({
            error: { code: "500", message: "SD API returned no images", details: JSON.stringify(data) },
          });
        }
        // Return OpenAI-compatible format so the frontend needs no changes
        return res.json({
          data: images.slice(0, payload.batch_size).map((b64) => ({
            url: b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`,
          })),
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // OpenAI-compatible image API path
    const fullImageUrl = apiUrl.endsWith("/images/generations")
      ? apiUrl
      : `${apiUrl}/images/generations`;

    console.log("Proxying image request to:", fullImageUrl);
    console.log("Model:", model);
    console.log("Prompt length:", prompt?.length || 0);

    const requestBody = { ...req.body };
    if (!requestBody.model) requestBody.model = model;
    if (!requestBody.prompt) requestBody.prompt = prompt;
    if (size && !requestBody.size) requestBody.size = size;
    if (requestBody.width && requestBody.height && !requestBody.size) {
      requestBody.size = `${requestBody.width}x${requestBody.height}`;
    }

    const isOpenRouter = apiUrl.includes("openrouter.ai");
    const additionalHeaders = isOpenRouter
      ? {
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:2427",
          "X-Title": "SillyTavern Character Generator",
        }
      : {};

    // Try Bearer auth first, fall back to X-API-Key
    let response = await fetch(fullImageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...additionalHeaders,
      },
      body: JSON.stringify(requestBody),
    });

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

    res.json(await response.json());
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).json({
      error: { code: "500", message: "Internal server error in image proxy", details: error.message },
    });
  }
});

// Proxy endpoint for SD API sampler list
app.get("/api/image/samplers", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const apiUrl = req.headers["x-api-url"];

    if (!apiUrl) {
      return res.status(400).json({
        error: { code: "400", message: "Image API URL required" },
      });
    }

    const preferSdApi = looksLikeSdApi(apiUrl) || isLikelyLocalUrl(apiUrl);
    const samplerUrl = preferSdApi
      ? buildSdSamplersUrl(apiUrl)
      : `${normalizeBase(apiUrl)}/samplers`;

    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    let response = await fetch(samplerUrl, { method: "GET", headers });

    if (response.status === 401 && apiKey) {
      response = await fetch(samplerUrl, { method: "GET", headers: { "X-API-Key": apiKey } });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: { code: response.status.toString(), message: `Sampler list error: ${response.statusText}`, details: errorText },
      });
    }

    res.json(await response.json());
  } catch (error) {
    console.error("Image sampler proxy error:", error);
    res.status(500).json({
      error: { code: "500", message: "Internal server error in sampler proxy", details: error.message },
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
    const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    return { token: json.token || text, cookies };
  } catch {
    const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    return { token: text, cookies };
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

    const { imageBase64, characterJson, fileName } = req.body;
    if (!imageBase64 && !characterJson) {
      return res.status(400).json({
        error: { message: "imageBase64 or characterJson is required" },
      });
    }

    const { token, cookies } = await getSTCsrfToken(stUrl, stPassword);

    // Build multipart form data for ST import (native FormData for native fetch)
    const form = new FormData();
    if (imageBase64) {
      // PNG with character data embedded in metadata
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const imageBlob = new Blob([imageBuffer], { type: "image/png" });
      form.append("avatar", imageBlob, fileName || "character.png");
      form.append("file_type", "png");
    } else {
      // No image — import as JSON character card
      const jsonBlob = new Blob([JSON.stringify(characterJson)], { type: "application/json" });
      form.append("avatar", jsonBlob, fileName || "character.json");
      form.append("file_type", "json");
    }

    const headers = {
      "X-CSRF-Token": token,
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

app.use("/api/cards", cardsRouter);
app.use("/api/prompts", promptsRouter);

app.listen(PORT, async () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to proxy requests to configured APIs`);
  console.log(`🔑 API URLs will be provided via request headers`);

  try {
    await initGit();
    console.log("📦 Card storage (git-backed) initialized");
  } catch (err) {
    console.warn("⚠️  Card storage init failed:", err.message);
  }

  try {
    await initPrompts();
  } catch (err) {
    console.warn("⚠️  Prompt storage init failed:", err.message);
  }
});
