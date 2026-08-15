import { join, extname, normalize, relative } from "node:path";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 3000);
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID ?? "";
const MAX_MESSAGE_BYTES = 1 << 14;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cacheControl(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".html" || ext === ".json") return "no-cache";
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg", ".ico", ".ttf", ".woff", ".woff2"].includes(ext)) {
    return "public, max-age=604800, stale-while-revalidate=86400";
  }
  return "public, max-age=3600, must-revalidate";
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Frame-Options": "DENY",
};

async function tryFile(path: string, req: Request): Promise<Response | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  const type = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  const etag = `W/\"${file.size}-${file.lastModified}\"`;
  const headers = {
    ...SECURITY_HEADERS,
    "Content-Type": type,
    "Cache-Control": cacheControl(path),
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(req.method === "HEAD" ? null : file, { headers });
}

async function handleMessage(req: Request): Promise<Response> {
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
    body && typeof body === "object" && typeof (body as Record<string, unknown>).message === "string"
      ? ((body as Record<string, string>).message).trim()
      : "";
  if (!message) return json(400, { error: "missing 'message' field" });

  try {
    const tg = await fetch(
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

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/message") {
      if (req.method !== "POST") {
        return new Response("method not allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleMessage(req);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("method not allowed", { status: 405 });
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("bad request", { status: 400, headers: SECURITY_HEADERS });
    }
    if (pathname.includes("\0")) return new Response("bad request", { status: 400 });

    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "/");
    let filePath = join(DIST, safe);
    if (relative(DIST, filePath).startsWith("..")) return new Response("forbidden", { status: 403, headers: SECURITY_HEADERS });

    if (safe.endsWith("/")) filePath = join(filePath, "index.html");

    const direct = await tryFile(filePath, req);
    if (direct) return direct;

    if (!extname(safe)) {
      const fallback = await tryFile(join(DIST, "index.html"), req);
      if (fallback) return fallback;
    }

    return new Response("not found", { status: 404, headers: SECURITY_HEADERS });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
