import { callTool, parseMcpContent } from "./_lib/mcp.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    const topSuggestion = suggestions[0];
    const id = topSuggestion.id;
    const ns = topSuggestion.ns;

    if (id == null || ns == null) {
      return res.status(404).json({
        error: "Destination found but missing location ID",
        suggestion: topSuggestion,
      });
    }

    // Step 2: Search accommodations
    const searchResult = await callTool("trivago-accommodation-search", {
      id: Number(id),
      ns: Number(ns),
      arrival: checkIn,
      departure: checkOut,
      adults: adults || 2,
      rooms: 1,
    });

    const searchParsed = parseMcpContent(searchResult);

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
}
