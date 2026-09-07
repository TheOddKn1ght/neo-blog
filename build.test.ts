import { expect, test } from "bun:test";
import { cp, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { filesUnder, fingerprint } from "./build-cache";

test("incremental builds reuse, invalidate, remove, recover, and support -f", async () => {
  const root = await mkdtemp(join(tmpdir(), "neo-blog-build-test-"));
  const dist = join(root, "dist");
  async function put(path: string, value: string) { await writeFile(join(root, path), value); }
  async function run(...args: string[]) {
    const process = Bun.spawn([Bun.which("bun")!, "run", "build", ...args], {
      cwd: root, stdout: "pipe", stderr: "pipe",
    });
    const [status, stdout, stderr] = await Promise.all([
      process.exited, new Response(process.stdout).text(), new Response(process.stderr).text(),
    ]);
    return { status, output: stdout + stderr };
  }
  async function build(...args: string[]) {
    const result = await run(...args);
    expect(result.status, result.output).toBe(0);
    return result.output;
  }
  async function snapshot(): Promise<Record<string, { hash: string; mtime: number }>> {
    return Object.fromEntries(await Promise.all((await filesUnder(dist)).map(async (path) => [
      path.slice(dist.length), { hash: fingerprint(await readFile(path)), mtime: (await stat(path)).mtimeMs },
    ])));
  }
  const post = (title: string) => `+++\ntitle="${title}"\ndate="2026-01-01"\ndescription="Test"\n+++\nBody`;
  try {
    for (const name of ["build.ts", "build-cache.ts", "package.json", "bun.lock", "tsconfig.json"]) {
      await cp(join(import.meta.dir, name), join(root, name));
    }
    await symlink(join(import.meta.dir, "node_modules"), join(root, "node_modules"));
    for (const dir of ["src", "content/blog", "content/pages", "static/css", "static/gallery"]) {
      await mkdir(join(root, dir), { recursive: true });
    }
    await cp(join(import.meta.dir, "src/site.ts"), join(root, "src/site.ts"));
    await cp(join(import.meta.dir, "static/gallery/1.jpg"), join(root, "static/gallery/1.jpg"));
    await put("src/index.ts", 'document.body.onclick = () => import("./lazy");');
    await put("src/lazy.ts", 'export const value = "first"; console.log(value);');
    await put("static/css/style.css", "body { color: red; }");
    await put("static/example.txt", "asset");
    await put("content/blog/example.md", post("First"));

    expect(await build()).toContain("Clean build");
    const first = await snapshot();
    expect(await build()).toContain("0 rebuilt");
    expect(await snapshot()).toEqual(first);

    await put("content/blog/example.md", post("Second"));
    await build();
    const content = await snapshot();
    expect(content["/content/posts/example.json"]!.hash).not.toBe(first["/content/posts/example.json"]!.hash);
    expect(content["/index.js"]).toEqual(first["/index.js"]);
    expect(content["/gallery/thumbs/1.webp"]).toEqual(first["/gallery/thumbs/1.webp"]);

    await put("static/css/style.css", "body { color: blue; }");
    await build();
    expect((await snapshot())["/css/style.css"]!.hash).not.toBe(content["/css/style.css"]!.hash);
    expect((await snapshot())["/index.js"]).toEqual(content["/index.js"]);

    await put("src/lazy.ts", 'export const value = "second"; console.log(value);');
    await build();
    const client = await snapshot();
    expect(client["/index.js"]!.hash).not.toBe(first["/index.js"]!.hash);
    for (const name of Object.keys(first).filter((name) => name.startsWith("/chunk-") && !(name in client))) {
      expect(await Bun.file(join(dist, name)).exists()).toBe(false);
    }

    await cp(join(import.meta.dir, "static/gallery/2.jpg"), join(root, "static/gallery/1.jpg"));
    await build();
    const image = await snapshot();
    expect(image["/gallery/thumbs/1.webp"]!.hash).not.toBe(first["/gallery/thumbs/1.webp"]!.hash);
    expect(image["/index.js"]).toEqual(client["/index.js"]);

    await rm(join(root, "static/example.txt"));
    await rm(join(root, "content/blog/example.md"));
    await rm(join(root, "static/gallery/1.jpg"));
    await build();
    for (const path of ["example.txt", "content/posts/example.json", "gallery/1.jpg", "gallery/thumbs/1.webp"]) {
      expect(await Bun.file(join(dist, path)).exists()).toBe(false);
    }

    await rm(join(dist, "index.js"));
    await writeFile(join(dist, "css/style.css"), "damaged");
    await build();
    expect(await Bun.file(join(dist, "index.js")).exists()).toBe(true);
    expect(fingerprint(await readFile(join(dist, "css/style.css")))).toBe(client["/css/style.css"]!.hash);

    await put("content/blog/example.md", "invalid frontmatter");
    expect((await run()).status).not.toBe(0);
    expect(await Bun.file(join(root, ".build-cache.json")).exists()).toBe(false);
    await put("content/blog/example.md", post("Recovered"));
    expect(await build()).toContain("Clean build");
    const recovered = await snapshot();
    await writeFile(join(dist, "obsolete.txt"), "remove me");
    expect(await build("-f")).toContain("Clean build");
    expect(await Bun.file(join(dist, "obsolete.txt")).exists()).toBe(false);
    const forced = await snapshot();
    expect(Object.fromEntries(Object.entries(forced).map(([path, value]) => [path, value.hash])))
      .toEqual(Object.fromEntries(Object.entries(recovered).map(([path, value]) => [path, value.hash])));
    expect(await build()).toContain("0 rebuilt");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
