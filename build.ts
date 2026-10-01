import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { minify } from "html-minifier-terser";
import {
  BuildCache,
  filesUnder,
  fingerprint,
  fingerprintFiles,
} from "./build-cache";

const ROOT = import.meta.dir;
const STATIC = join(ROOT, "static");
export type GalleryItem = { src: string; thumbnail?: string; alt: string };

export async function galleryItems(files: string[]): Promise<GalleryItem[]> {
  const images = files.filter(
    (file) =>
      dirname(file) === join(STATIC, "gallery") &&
      /\.(jpe?g|png|webp|gif|avif)$/i.test(file),
  );
  const altText: unknown = JSON.parse(
    await readFile(join(ROOT, "content/gallery.json"), "utf8"),
  );
  if (!altText || typeof altText !== "object" || Array.isArray(altText))
    throw new Error("content/gallery.json must be an object");
  const descriptions = altText as Record<string, unknown>;
  const names = new Set(images.map((file) => basename(file)));
  for (const [name, value] of Object.entries(descriptions)) {
    if (!names.has(name) || typeof value !== "string" || !value.trim())
      throw new Error(`Invalid gallery description: ${name}`);
  }
  const ids = new Set<number>();
  for (const file of images) {
    const numeric = /^(\d+)\./.exec(basename(file));
    if (numeric) {
      const id = Number(numeric[1]);
      if (ids.has(id)) throw new Error(`Duplicate gallery photo ID: ${id}`);
      ids.add(id);
    }
  }
  images.sort((a, b) => {
    const an = Number.parseInt(basename(a));
    const bn = Number.parseInt(basename(b));
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return bn - an;
    if (!Number.isNaN(an)) return -1;
    if (!Number.isNaN(bn)) return 1;
    return basename(a).localeCompare(basename(b));
  });
  return images.map((file) => {
    const name = basename(file);
    const stem = basename(file, extname(file));
    return {
      src: `/gallery/${name}`,
      ...(/\.(jpe?g|png)$/i.test(file)
        ? { thumbnail: `/gallery/thumbs/${stem}.webp` }
        : {}),
      alt:
        (descriptions[name] as string | undefined)?.trim() ??
        (/^\d+$/.test(stem)
          ? `Gallery photo ${Number(stem)}`
          : `Gallery image ${stem.replace(/[-_]+/g, " ").trim() || "untitled"}`),
    };
  });
}

export async function minifyHtml(html: string): Promise<string> {
  return minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    // Keep whitespace inside pre/code, and do not alter attribute semantics.
  });
}

async function command(args: string[], cwd = ROOT): Promise<string> {
  const process = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0)
    throw new Error(`${args.join(" ")} failed (${code})\n${stdout}\n${stderr}`);
  return stdout.trim();
}

async function renderSite(
  gallery: GalleryItem[],
  clientEntry: string,
  cssKey: string,
  DIST: string,
): Promise<string[]> {
  const workspace = await mkdtemp(join(tmpdir(), "neo-blog-zola-"));
  try {
    await cp(join(ROOT, "content"), join(workspace, "content"), {
      recursive: true,
    });
    await cp(join(ROOT, "templates"), join(workspace, "templates"), {
      recursive: true,
    });
    await cp(join(ROOT, "zola.toml"), join(workspace, "zola.toml"));
    await mkdir(join(workspace, "static"));
    await writeFile(
      join(workspace, "gallery-data.json"),
      JSON.stringify(gallery),
    );
    await command(["zola", "build"], workspace);
    const generated = join(workspace, "dist");
    const outputs: string[] = [];
    for (const file of await filesUnder(generated)) {
      let name = relative(generated, file);
      // robots.txt is preserved verbatim from static/.
      if (name === "robots.txt") continue;
      let contents = await readFile(file, "utf8");
      if (name.endsWith(".html")) {
        contents = await new HTMLRewriter()
          .on('script[type="module"]', {
            element(element) {
              element.setAttribute("src", clientEntry);
            },
          })
          .on('link[rel="stylesheet"]', {
            element(element) {
              element.setAttribute(
                "href",
                `/css/style.css?v=${cssKey.slice(0, 12)}`,
              );
            },
          })
          .on('link[rel="canonical"]', {
            element(element) {
              const url = new URL(element.getAttribute("href")!);
              url.pathname =
                url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
              element.setAttribute("href", url.href);
            },
          })
          .on("pre", {
            element(element) {
              element.setAttribute("tabindex", "0");
            },
          })
          .on(".markdown-content img", {
            element(element) {
              element.setAttribute("loading", "lazy");
              element.setAttribute("decoding", "async");
            },
          })
          .transform(new Response(contents))
          .text();
        contents = await minifyHtml(contents);
      } else if (name === "sitemap.xml") {
        contents = contents.replace(
          /<url>\s*<loc>[^<]*\/yo\/<\/loc>[\s\S]*?<\/url>/g,
          "",
        );
      }
      const destination = join(DIST, name);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, contents);
      outputs.push(destination);
    }
    return outputs;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function build(
  force = false,
  DIST = join(ROOT, "dist"),
  manifest = join(ROOT, ".build-cache.json"),
): Promise<void> {
  const version = fingerprint(
    JSON.stringify([
      Bun.version,
      await command(["zola", "--version"]),
      await fingerprintFiles(
        [
          "build.ts",
          "build-cache.ts",
          "package.json",
          "bun.lock",
          "bunfig.toml",
          "tsconfig.json",
        ].map((name) => join(ROOT, name)),
      ),
    ]),
  );
  const cache = new BuildCache(DIST, manifest, version);
  const loaded = await cache.load();
  const clean = force || !loaded;
  await rm(manifest, { force: true });
  if (clean) await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  const staticFiles = await filesUnder(STATIC);
  for (const source of staticFiles) {
    const name = relative(STATIC, source);
    if (name === "css/style.css") continue;
    await cache.run(
      `static:${name}`,
      await fingerprintFiles([source]),
      async () => {
        const destination = join(DIST, name);
        await mkdir(dirname(destination), { recursive: true });
        await cp(source, destination);
        return [destination];
      },
    );
  }
  const cssKey = await fingerprintFiles([join(STATIC, "css/style.css")]);
  await cache.run("css", cssKey, async () => {
    const result = await Bun.build({
      entrypoints: [join(STATIC, "css/style.css")],
      outdir: join(DIST, "css"),
      minify: true,
      external: ["*.ttf"],
      naming: "[name].[ext]",
    });
    if (!result.success)
      throw new AggregateError(result.logs, "CSS build failed");
    return result.outputs.map((file) => file.path);
  });
  const clientKey = await fingerprintFiles(await filesUnder(join(ROOT, "src")));
  const clientEntry = `/assets/index-${clientKey.slice(0, 12)}.js`;
  await cache.run("client", clientKey, async () => {
    const result = await Bun.build({
      entrypoints: [join(ROOT, "src/index.ts")],
      outdir: join(DIST, "assets"),
      target: "browser",
      minify: true,
      naming: `index-${clientKey.slice(0, 12)}.[ext]`,
    });
    if (!result.success)
      throw new AggregateError(result.logs, "TypeScript build failed");
    return result.outputs.map((file) => file.path);
  });
  const gallery = await galleryItems(staticFiles);
  // Conversions are cached individually; unrelated edits do not decode every photo.
  for (const source of staticFiles.filter(
    (file) =>
      dirname(file) === join(STATIC, "gallery") && /\.(jpe?g|png)$/i.test(file),
  )) {
    await cache.run(
      `thumbnail:${basename(source)}`,
      await fingerprintFiles([source]),
      async () => {
        const destination = join(
          DIST,
          "gallery/thumbs",
          `${basename(source, extname(source))}.webp`,
        );
        await mkdir(dirname(destination), { recursive: true });
        await new Bun.Image(source)
          .resize(720, undefined, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 76 })
          .write(destination);
        return [destination];
      },
    );
  }
  const siteKey = fingerprint(
    JSON.stringify([
      await fingerprintFiles([
        ...(await filesUnder(join(ROOT, "content"))),
        ...(await filesUnder(join(ROOT, "templates"))),
        join(ROOT, "zola.toml"),
      ]),
      gallery,
      clientEntry,
      cssKey,
    ]),
  );
  await cache.run("site", siteKey, () =>
    renderSite(gallery, clientEntry, cssKey, DIST),
  );
  await cache.save();
  console.log(
    `${clean ? "Clean" : "Incremental"} Zola build: ${cache.rebuilt} rebuilt, ${cache.reused} reused → dist/`,
  );
}

if (import.meta.main) {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  if (args.some((arg) => !["-f", "--force"].includes(arg)))
    throw new Error("Usage: bun run build [-f|--force]");
  await build(args.length > 0);
}
