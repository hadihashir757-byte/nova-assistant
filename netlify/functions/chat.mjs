// NOVA AI brain: runs on Netlify and uses Netlify AI Gateway (no API key needed).
const SYSTEM = "You are NOVA, a friendly, smart personal voice assistant on a website. Answer any question clearly and accurately, including complex ones. Keep answers fairly short (under about 150 words) unless the user asks for detail, because replies are read aloud. Use simple formatting.";

export default async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return Response.json({ error: "No question" }, { status: 400 });

  const base = process.env.ANTHROPIC_BASE_URL, key = process.env.ANTHROPIC_API_KEY;
  if (!base || !key) return Response.json({ error: "AI Gateway is not enabled for this site" }, { status: 500 });

  const r = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 700, system: SYSTEM, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return Response.json({ error: data?.error?.message || `AI error ${r.status}` }, { status: 502 });
  const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  return Response.json({ text });
};

export const config = { path: "/api/chat" };
