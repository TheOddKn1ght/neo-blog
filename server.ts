import { join, extname, normalize, relative } from "node:path";

const ROOT = import.meta.dir;
const DIST = process.env.DIST_DIR ?? join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 3000);


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

export async function staticRequest(req: Request, dist = DIST): Promise<Response> {
      const url = new URL(req.url);

      if (url.pathname === "/message") {
        if (req.method !== "POST") {
          return new Response("method not allowed", {
            status: 405,
            headers: { Allow: "POST" },
          });
        }
        const upstream = process.env.MESSAGE_UPSTREAM;
        if (!upstream) return json(503, { error: "message endpoint unavailable" });
        try { return await fetch(new URL("/message", upstream), {method:"POST",headers:{"Content-Type":"application/json"},body:await req.arrayBuffer(),signal:AbortSignal.timeout(12_000)}); }
        catch { return json(502, {error:"message endpoint unavailable"}); }
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
      let filePath = join(dist, safe);
      if (relative(dist, filePath).startsWith("..")) return new Response("forbidden", { status: 403, headers: SECURITY_HEADERS });

      if (safe.endsWith("/")) filePath = join(filePath, "index.html");

      const direct = await tryFile(filePath, req);
      if (direct) return direct;

      if (!extname(safe)) {
        const fallback = await tryFile(join(filePath, "index.html"), req);
        if (fallback) return fallback;
      }

      const missing = await tryFile(join(dist, "404.html"), req);
      return new Response(missing?.body ?? "not found", {status:404,headers:missing?.headers ?? SECURITY_HEADERS});
}

if (import.meta.main) {
  const server = Bun.serve({hostname:"127.0.0.1",port:PORT,maxRequestBodySize:1 << 14,fetch:(req) => staticRequest(req)});
  console.log(`Listening on http://localhost:${server.port}`);
}
