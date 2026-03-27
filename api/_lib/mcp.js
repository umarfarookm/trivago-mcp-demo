const MCP_ENDPOINT = "https://mcp.trivago.com/mcp";

// Module-level cache for warm Vercel function reuse
let cachedSessionId = null;

async function initSession() {
  const initRes = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "trivago-hotel-finder", version: "1.0.0" },
      },
    }),
  });

  const sessionId = initRes.headers.get("mcp-session-id");
  await initRes.json();

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

  cachedSessionId = sessionId;
  return sessionId;
}

async function getSession() {
  if (cachedSessionId) return cachedSessionId;
  return initSession();
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
          // skip non-JSON
        }
      }
    }
    if (lastData) return lastData;
    throw new Error("No valid JSON in SSE response");
  }

  return res.json();
}

export async function callMcp(method, params = {}) {
  let sessionId = await getSession();

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

  // Session expired — reinit and retry once
  if (res.status === 400 || res.status === 404) {
    const text = await res.text();
    if (text.toLowerCase().includes("session")) {
      cachedSessionId = null;
      sessionId = await initSession();

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

export async function callTool(toolName, args = {}) {
  return callMcp("tools/call", { name: toolName, arguments: args });
}

export function parseMcpContent(response) {
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
