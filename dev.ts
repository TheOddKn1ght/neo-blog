import { watch } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "./build";
import { staticRequest } from "./server";

const workspace = await mkdtemp(join(tmpdir(), "neo-blog-dev-"));
const manifest = join(workspace, "cache.json");
let revision = 0;
let output = "";
let pending = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
function broadcast(value: { error?: string }): void {
  const data = new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);
  for (const client of clients) {
    try {
      client.enqueue(data);
    } catch {
      clients.delete(client);
    }
  }
}
async function generate(): Promise<void> {
  const next = join(workspace, String(++revision));
  try {
    if (output) await cp(output, next, { recursive: true });
    await build(false, next, manifest);
  } catch (error) {
    await rm(next, { recursive: true, force: true });
    throw error;
  }
  const previous = output;
  output = next;
  if (previous) await rm(previous, { recursive: true, force: true });
}
try {
  await generate();
} catch (error) {
  await rm(workspace, { recursive: true, force: true });
  throw error;
}
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: 1 << 14,
  idleTimeout: 0,
  async fetch(req) {
    if (new URL(req.url).pathname === "/__dev/events") {
      let controller: ReadableStreamDefaultController<Uint8Array>;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(value) {
            controller = value;
            clients.add(value);
            value.enqueue(new TextEncoder().encode(": connected\n\n"));
          },
          cancel() {
            clients.delete(controller);
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const response = await staticRequest(req, output);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.delete("ETag");
    if (
      req.method !== "HEAD" &&
      headers.get("Content-Type")?.startsWith("text/html")
    ) {
      const html = (await response.text()).replace(
        "</body>",
        `<script>new EventSource('/__dev/events').onmessage=function(e){var data=JSON.parse(e.data);if(!data.error){location.reload();return}var box=document.getElementById('dev-error');if(!box){box=document.createElement('pre');box.id='dev-error';box.style.cssText='position:fixed;inset:1rem;z-index:100000;overflow:auto;background:#222;color:#fff;padding:2rem;white-space:pre-wrap';document.body.append(box)}box.textContent=data.error;box.onclick=function(){box.remove()}};</script></body>`,
      );
      return new Response(html, { status: response.status, headers });
    }
    return new Response(response.body, { status: response.status, headers });
  },
});
async function rebuild(): Promise<void> {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  do {
    pending = false;
    try {
      await generate();
      if (!pending) broadcast({});
    } catch (error) {
      console.error(error);
      broadcast({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } while (pending);
  running = false;
}
function changed(): void {
  clearTimeout(timer);
  timer = setTimeout(() => void rebuild(), 150);
}
const watchers = ["src", "content", "templates", "static"].map((name) =>
  watch(join(import.meta.dir, name), { recursive: true }, changed),
);
watchers.push(watch(join(import.meta.dir, "zola.toml"), changed));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    watchers.forEach((watcher) => watcher.close());
    clearTimeout(timer);
    server.stop(true);
    // Let the active generator finish before deleting its workspace.
    while (running) await new Promise((resolve) => setTimeout(resolve, 20));
    await rm(workspace, { recursive: true, force: true });
    process.exit(0);
  });
console.log(
  `Development server: http://localhost:${server.port} (automatic reload)`,
);
console.log("Restart after editing build tooling, dependencies or server.ts.");
