import { callTool, parseMcpContent } from "./_lib/mcp.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}
