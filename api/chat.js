import { runChat } from "./_lib/chat.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // Only accept the roles/shape we expect, to avoid passing arbitrary
  // tool_use blocks from the client back into the LLM.
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
}
