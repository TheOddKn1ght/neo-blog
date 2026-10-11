const messageConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN ?? "",
  chat: process.env.TELEGRAM_CHAT_ID ?? "",
};
const MAX_MESSAGE_BYTES = 1 << 14;
function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}
export async function handleMessage(
  req: Request,
  config = messageConfig,
  send: typeof fetch = fetch,
): Promise<Response> {
  const TG_TOKEN = config.token;
  const TG_CHAT = config.chat;
  if (!TG_TOKEN || !TG_CHAT) {
    console.warn("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is empty");
    return json(500, { error: "server misconfigured" });
  }
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_MESSAGE_BYTES) return json(413, { error: "payload too large" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid json" });
  }
  const message =
    body &&
    typeof body === "object" &&
    typeof (body as Record<string, unknown>).message === "string"
      ? (body as Record<string, string>).message.trim()
      : "";
  if (!message) return json(400, { error: "missing 'message' field" });

  try {
    const tg = await send(
      `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TG_CHAT, text: message }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (tg.ok) return json(200, { ok: true });
    const detail = await tg.text().catch(() => "");
    console.error("telegram error:", tg.status, detail.slice(0, 500));
    return json(502, { error: "telegram error" });
  } catch (err) {
    console.error("telegram request failed:", err);
    return json(502, { error: "telegram error" });
  }
}

export function messageRequest(req: Request): Promise<Response> | Response {
  if (new URL(req.url).pathname !== "/message")
    return new Response("not found", { status: 404 });
  if (req.method !== "POST")
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  return handleMessage(req);
}
if (import.meta.main) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: Number(process.env.MESSAGE_PORT ?? 3001),
    maxRequestBodySize: MAX_MESSAGE_BYTES,
    fetch: messageRequest,
  });
  console.log(`Message endpoint: http://127.0.0.1:${server.port}/message`);
}
