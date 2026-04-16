import OpenAI from "openai";
import { callTool, parseMcpContent } from "./mcp.js";

// DeepSeek is OpenAI-API-compatible. We point the OpenAI SDK at their endpoint.
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat"; // V3 — supports function calling

// OpenAI's function-calling spec disallows hyphens in some client versions,
// so we use underscores in the LLM-facing names and map back to the real
// trivago MCP tool names when calling the MCP server.
const TOOL_NAME_MAP = {
  trivago_search_suggestions: "trivago-search-suggestions",
  trivago_accommodation_search: "trivago-accommodation-search",
  trivago_accommodation_radius_search: "trivago-accommodation-radius-search",
};

export const TRIVAGO_TOOLS = [
  {
    type: "function",
    function: {
      name: "trivago_search_suggestions",
      description:
        "Resolve a free-text destination (city, neighborhood, landmark, or country) into structured suggestions. Returns an array where each item has `id` and `ns` that identify a location. ALWAYS call this first before `trivago_accommodation_search` to get a valid id/ns pair.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Destination text, e.g. 'Paris', 'Shibuya Tokyo', 'Berlin'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trivago_accommodation_search",
      description:
        "Search hotels for a resolved location. Requires `id` and `ns` from a prior `trivago_search_suggestions` call. Returns an `accommodations` array with name, price, rating, images, and booking URLs.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Location id from search-suggestions." },
          ns: { type: "number", description: "Location namespace from search-suggestions." },
          arrival: { type: "string", description: "Check-in date in YYYY-MM-DD format." },
          departure: { type: "string", description: "Check-out date in YYYY-MM-DD format." },
          adults: { type: "number", description: "Number of adults (default 2)." },
          rooms: { type: "number", description: "Number of rooms (default 1)." },
          children_ages: {
            type: "array",
            items: { type: "number" },
            description: "Ages of children, e.g. [6, 10]. Omit if no children.",
          },
        },
        required: ["id", "ns", "arrival", "departure"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trivago_accommodation_radius_search",
      description:
        "Search hotels near a latitude/longitude within a radius in meters. Use this for landmark-based queries like 'near the Eiffel Tower' or 'near Etihad Stadium' — you decide the coordinates of the landmark. Returns an `accommodations` array.",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number", description: "Latitude in decimal degrees." },
          longitude: { type: "number", description: "Longitude in decimal degrees." },
          radius: {
            type: "number",
            description: "Search radius in meters (1000-50000). Default 5000.",
          },
          arrival: { type: "string", description: "Check-in date YYYY-MM-DD." },
          departure: { type: "string", description: "Check-out date YYYY-MM-DD." },
          adults: { type: "number", description: "Number of adults (default 2)." },
          rooms: { type: "number", description: "Number of rooms (default 1)." },
          children_ages: {
            type: "array",
            items: { type: "number" },
            description: "Ages of children. Omit if none.",
          },
        },
        required: ["latitude", "longitude", "arrival", "departure"],
      },
    },
  },
];

function systemPrompt() {
  const today = new Date().toISOString().split("T")[0];
  return `You are a friendly, concise travel assistant built on trivago's MCP server. Today's date is ${today}.

Your job: turn the user's request into calls to the trivago tools and present the results cleanly.

Rules:
- For city/destination searches: call \`trivago_search_suggestions\` first, then \`trivago_accommodation_search\` with the returned id/ns.
- For "near a landmark" searches (Eiffel Tower, Etihad Stadium, etc.): use \`trivago_accommodation_radius_search\` with the landmark's lat/lng that you know. Default radius 3000m for precise landmarks, 5000m otherwise.
- For multi-city itineraries (e.g. "Tokyo and Osaka for 2 weeks"): split the stay sensibly across cities, call the tools for each leg, and summarize per-city.
- If dates are fuzzy ("next Friday", "January 2026"), pick concrete YYYY-MM-DD dates and mention them in your reply.
- Defaults: 2 adults, 1 room, 3-night stay if no length given.
- After tool calls, write a short natural-language summary (2-4 sentences). DO NOT repeat full hotel lists in prose — the UI renders hotel cards separately. Just highlight a couple of standouts (e.g. "The top pick is X at EUR Y/night with an 8.5 rating").
- If the user's request is off-topic (not about hotels/travel), politely steer them back.`;
}

const MAX_TOOL_ITERATIONS = 5;
// Caps the final assistant text. The system prompt already instructs the
// model to keep replies to 2-4 sentences, so 800 tokens is generous headroom
// while cutting tail latency vs. the default (4096).
const MAX_OUTPUT_TOKENS = 800;

export async function runChat(messages, { apiKey, model = DEFAULT_MODEL } = {}) {
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured on the server.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });

  const conversation = [
    { role: "system", content: systemPrompt() },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const toolsUsed = [];
  const hotelsByLabel = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model,
      messages: conversation,
      tools: TRIVAGO_TOOLS,
      tool_choice: "auto",
      max_tokens: MAX_OUTPUT_TOKENS,
    });

    const choice = response.choices?.[0];
    if (!choice) throw new Error("Empty response from DeepSeek");

    const assistantMsg = choice.message;

    // Push the assistant message (with any tool_calls) into conversation history
    // so DeepSeek can see its own tool_calls when we feed tool results back.
    conversation.push({
      role: "assistant",
      content: assistantMsg.content ?? "",
      ...(assistantMsg.tool_calls ? { tool_calls: assistantMsg.tool_calls } : {}),
    });

    // No more tool calls requested — we're done.
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return {
        text: (assistantMsg.content || "").trim(),
        hotelsByLabel,
        toolsUsed,
      };
    }

    // Execute each tool call in parallel and feed the results back.
    const toolResultMessages = await Promise.all(
      assistantMsg.tool_calls.map(async (call) => {
        const llmToolName = call.function?.name;
        const mcpToolName = TOOL_NAME_MAP[llmToolName] || llmToolName;
        toolsUsed.push(mcpToolName);

        let args = {};
        try {
          args = call.function?.arguments
            ? JSON.parse(call.function.arguments)
            : {};
        } catch {
          return {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "Invalid JSON arguments" }),
          };
        }

        try {
          const mcpResponse = await callTool(mcpToolName, args);
          const parsed = parseMcpContent(mcpResponse);

          if (Array.isArray(parsed?.accommodations) && parsed.accommodations.length) {
            let label = null;
            if (mcpToolName === "trivago-accommodation-search") {
              label = parsed?.location_label || `Search #${hotelsByLabel.length + 1}`;
            } else if (mcpToolName === "trivago-accommodation-radius-search") {
              label = `Near ${args.latitude}, ${args.longitude}`;
            }
            if (label) {
              hotelsByLabel.push({ label, hotels: parsed.accommodations.slice(0, 12) });
            }
          }

          return {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(compactForLlm(mcpToolName, parsed)),
          };
        } catch (err) {
          return {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: err.message || String(err) }),
          };
        }
      })
    );

    conversation.push(...toolResultMessages);
  }

  // Hit iteration cap — ask for a summary without more tools.
  const finalResponse = await client.chat.completions.create({
    model,
    messages: [
      ...conversation,
      {
        role: "user",
        content:
          "You've reached the tool-call limit. Summarize what you found so far for the user in 2-3 sentences.",
      },
    ],
    max_tokens: MAX_OUTPUT_TOKENS,
  });

  const text = finalResponse.choices?.[0]?.message?.content?.trim() || "";
  return { text, hotelsByLabel, toolsUsed };
}

// Trim tool results before feeding them back to the LLM — saves tokens and
// keeps response latency low. The full result is already collected for the UI.
function compactForLlm(toolName, parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;

  if (toolName === "trivago-search-suggestions") {
    const suggestions = (parsed.suggestions || []).slice(0, 5).map((s) => ({
      id: s.id,
      ns: s.ns,
      location: s.location,
      location_label: s.location_label,
      location_type: s.location_type,
    }));
    return { suggestions };
  }

  if (
    toolName === "trivago-accommodation-search" ||
    toolName === "trivago-accommodation-radius-search"
  ) {
    const accommodations = (parsed.accommodations || []).slice(0, 6).map((a) => ({
      name: a.accommodation_name || a.name,
      stars: a.hotel_rating,
      review_rating: a.review_rating,
      review_count: a.review_count,
      price_per_night: a.price_per_night,
      price_per_stay: a.price_per_stay,
      currency: a.currency,
      location: a.country_city || a.address,
      distance_to_center: a.distance_to_city_center,
    }));
    return {
      count: parsed.accommodations?.length || 0,
      accommodations,
      error: parsed.error || null,
    };
  }

  return parsed;
}
