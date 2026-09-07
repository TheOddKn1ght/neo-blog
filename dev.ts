import { svelte } from "@sveltejs/vite-plugin-svelte";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve } from "node:path";
import { createServer } from "vite";
import { generateContent, renderIndexHtml } from "./build";
import { handleMessage } from "./server";

const ROOT = import.meta.dir;
const CONTENT = join(ROOT, "content");
const STATIC = join(ROOT, "static");
const TEMP = await mkdtemp(join(tmpdir(), "neo-blog-dev-"));
let output = "";
let revision = 0;
let pending = false;
let refresh: Promise<void> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function within(root: string, path: string): boolean {
  const name = relative(root, path);
  return name === "" || (!name.startsWith("..") && !name.startsWith("/"));
}

async function generate(): Promise<void> {
  const next = join(TEMP, String(++revision));
  try {
    await generateContent(next);
  } catch (error) {
    await rm(next, { recursive: true, force: true });
    throw error;
  }
  const previous = output;
  output = next;
  if (previous) await rm(previous, { recursive: true, force: true });
}

const server = await createServer({
  root: ROOT,
  configFile: false,
  publicDir: false,
  appType: "custom",
  plugins: [
    svelte({ configFile: false }),
    {
      name: "blog-content",
      handleHotUpdate({ file }) {
        // These files are published together by the content watcher below.
        if (within(CONTENT, file) || (within(STATIC, file) && !within(join(STATIC, "css"), file))) {
          return [];
        }
      },
      configureServer(vite) {
        vite.watcher.add([CONTENT, STATIC]);
        vite.middlewares.use((_req, res, next) => {
          res.setHeader("Cache-Control", "no-store");
          next();
        });
        return () => {
          vite.middlewares.use(async (req, res, next) => {
            try {
              const url = new URL(req.url ?? "/", "http://localhost");
              if (url.pathname === "/message") {
                if (req.method !== "POST") {
                  res.writeHead(405, { Allow: "POST" }).end("method not allowed");
                  return;
                }
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of req) {
                  size += chunk.length;
                  if (size > 1 << 14) {
                    res.writeHead(413).end("payload too large");
                    return;
                  }
                  chunks.push(Buffer.from(chunk));
                }
                const response = await handleMessage(new Request(url, {
                  method: "POST",
                  body: Buffer.concat(chunks),
                }));
                res.writeHead(response.status, Object.fromEntries(response.headers));
                res.end(await response.text());
                return;
              }
              if (req.method !== "GET" && req.method !== "HEAD") {
                res.writeHead(405).end("method not allowed");
                return;
              }
              let pathname: string;
              try {
                pathname = decodeURIComponent(url.pathname);
              } catch {
                res.writeHead(400).end("bad request");
                return;
              }
              if (pathname.includes("\0")) {
                res.writeHead(400).end("bad request");
                return;
              }
              for (const root of [output, STATIC]) {
                const path = resolve(root, `.${pathname}`);
                if (!within(root, path)) continue;
                const file = Bun.file(path);
                if (!(await file.exists())) continue;
                res.setHeader("Content-Type", file.type);
                res.end(req.method === "HEAD" ? undefined : await file.arrayBuffer());
                return;
              }
              if (pathname === "/index.html" || !extname(pathname)) {
                const html = await vite.transformIndexHtml(url.pathname, renderIndexHtml(
                  "/src/index.ts", "/static/css/style.css",
                ));
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(req.method === "HEAD" ? undefined : html);
                return;
              }
              next();
            } catch (error) {
              next(error);
            }
          });
        };
      },
    },
  ],
  server: {
    port: Number(process.env.PORT ?? 3000),
    strictPort: true,
    watch: { ignored: ["**/dist/**"] },
  },
});

async function drainChanges(): Promise<void> {
  while (pending) {
    pending = false;
    try {
      await generate();
      if (!pending) server.ws.send({ type: "full-reload", path: "*" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[content] ${message}`);
      server.ws.send({ type: "error", err: { message, stack: "", plugin: "blog-content" } });
    }
  }
}

server.watcher.on("all", (event, file) => {
  if (!["add", "change", "unlink", "addDir", "unlinkDir"].includes(event)) return;
  if (!within(CONTENT, file) && !within(STATIC, file)) return;
  if (within(join(STATIC, "css"), file)) return;
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!refresh) refresh = drainChanges().finally(() => { refresh = undefined; });
  }, 100);
});

async function shutdown(): Promise<void> {
  clearTimeout(timer);
  await server.close();
  await refresh;
  await rm(TEMP, { recursive: true, force: true });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void shutdown().then(() => process.exit(0)); });
}

try {
  // Register the watcher before generating so edits during startup are queued.
  refresh = generate();
  await refresh;
  refresh = undefined;
  if (pending) {
    refresh = drainChanges();
    await refresh;
    refresh = undefined;
  }
  await server.listen();
  server.printUrls();
} catch (error) {
  refresh = undefined;
  await shutdown();
  throw error;
}
