import { callMcp } from "./_lib/mcp.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await callMcp("tools/list");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
