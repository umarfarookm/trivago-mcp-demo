import express from "express";
import cors from "cors";
import { runChat } from "../api/_lib/chat.js";

const app = express();
const PORT = 3001;
const MCP_ENDPOINT = "https://mcp.trivago.com/mcp";

app.use(cors());
app.use(express.json());

// --- MCP Session Management ---

let sessionId = null;
let sessionReady = false;
let initPromise = null;

async function initSession() {
  const initBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "trivago-hotel-finder", version: "1.0.0" },
    },
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(initBody),
  });

  sessionId = res.headers.get("mcp-session-id");
  await res.json();

  // Send initialized notification
  await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });

  sessionReady = true;
  console.log("MCP session initialized:", sessionId);
}

async function ensureSession() {
  if (sessionReady && sessionId) return;
  if (!initPromise) {
    initPromise = initSession().catch((err) => {
      initPromise = null;
      sessionReady = false;
      sessionId = null;
      throw err;
    });
  }
  await initPromise;
}

async function callMcp(method, params = {}) {
  await ensureSession();

  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify(body),
  });

  // If session expired, reinitialize and retry once
  if (res.status === 400 || res.status === 404) {
    const text = await res.text();
    if (text.includes("Invalid session") || text.includes("session")) {
      console.log("Session expired, reinitializing...");
      sessionReady = false;
      sessionId = null;
      initPromise = null;
      await ensureSession();

      const retryRes = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify(body),
      });
      return parseResponse(retryRes);
    }
    throw new Error(text);
  }

  return parseResponse(res);
}

async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n");
    let lastData = null;
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          lastData = JSON.parse(line.slice(6));
        } catch {
          // skip
        }
      }
    }
    if (lastData) return lastData;
    throw new Error("No valid JSON in SSE response");
  }

  return res.json();
}

async function callTool(toolName, args = {}) {
  return callMcp("tools/call", { name: toolName, arguments: args });
}

function parseMcpContent(response) {
  // Prefer structuredContent (machine-readable) over text content
  if (response?.result?.structuredContent) {
    return response.result.structuredContent;
  }
  if (response?.result?.content) {
    const text = response.result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return response?.result || response;
}

// --- API Routes ---

app.get("/api/tools", async (_req, res) => {
  try {
    const result = await callMcp("tools/list");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/suggestions", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "query is required" });

  try {
    const result = await callTool("trivago-search-suggestions", { query });
    const parsed = parseMcpContent(result);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/search", async (req, res) => {
  const { query, checkIn, checkOut, adults } = req.body;

  if (!checkIn || !checkOut) {
    return res.status(400).json({ error: "checkIn and checkOut are required" });
  }

  try {
    // Step 1: Resolve destination via search suggestions
    const sugResult = await callTool("trivago-search-suggestions", { query });
    const sugParsed = parseMcpContent(sugResult);

    const suggestions = sugParsed?.suggestions || [];
    if (suggestions.length === 0) {
      return res.status(404).json({ error: "No destination found for: " + query });
    }

    // Pick the first suggestion — it has `id` and `ns` fields
    const topSuggestion = suggestions[0];
    const id = topSuggestion.id;
    const ns = topSuggestion.ns;

    if (id == null || ns == null) {
      return res.status(404).json({
        error: "Destination found but missing location ID",
        suggestion: topSuggestion,
      });
    }

    // Step 2: Search accommodations using correct MCP parameter names
    const searchArgs = {
      id: Number(id),
      ns: Number(ns),
      arrival: checkIn,
      departure: checkOut,
      adults: adults || 2,
      rooms: 1,
    };

    const searchResult = await callTool("trivago-accommodation-search", searchArgs);
    const searchParsed = parseMcpContent(searchResult);

    // Return accommodations array + metadata
    const destLabel = topSuggestion.location_label
      ? `${topSuggestion.location}, ${topSuggestion.location_label}`
      : topSuggestion.location || query;

    res.json({
      destination: destLabel,
      accommodations: searchParsed?.accommodations || [],
      error: searchParsed?.error || null,
      validation_errors: searchParsed?.validation_errors || null,
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/radius-search", async (req, res) => {
  const { latitude, longitude, checkIn, checkOut, adults, radius } = req.body;

  if (!latitude || !longitude || !checkIn || !checkOut) {
    return res.status(400).json({
      error: "latitude, longitude, checkIn, and checkOut are required",
    });
  }

  try {
    const result = await callTool("trivago-accommodation-radius-search", {
      latitude,
      longitude,
      arrival: checkIn,
      departure: checkOut,
      adults: adults || 2,
      radius: radius || 5000,
      rooms: 1,
    });

    const parsed = parseMcpContent(result);
    res.json({
      accommodations: parsed?.accommodations || [],
      error: parsed?.error || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const sanitized = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
    }))
    .filter((m) => m.content.trim().length > 0);

  if (sanitized.length === 0) {
    return res.status(400).json({ error: "messages must contain non-empty text" });
  }

  try {
    const result = await runChat(sanitized, {
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
    res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message || "Chat failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend proxy running on http://localhost:${PORT}`);
});
