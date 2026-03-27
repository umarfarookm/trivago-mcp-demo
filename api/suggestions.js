import { callTool, parseMcpContent } from "./_lib/mcp.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const result = await callTool("trivago-search-suggestions", { query });
    const parsed = parseMcpContent(result);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
