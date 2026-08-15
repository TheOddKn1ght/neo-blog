import { compile, preprocess } from "svelte/compiler";
import { marked } from "marked";
import { readdir, readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { join, basename, extname, normalize } from "node:path";
import type { BunPlugin } from "bun";
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "./src/site";
import type { GalleryItem, PostMeta } from "./src/types";

const ROOT = import.meta.dir;
const SRC = join(ROOT, "src");
const STATIC = join(ROOT, "static");
const CONTENT = join(ROOT, "content");
const DIST = join(ROOT, "dist");

const STATIC_ROUTES = ["/", "/blog", "/gallery", "/contact"];
const RSS_MAX_ITEMS = 20;
const GALLERY_THUMBNAIL_WIDTH = 720;
const GALLERY_THUMBNAIL_QUALITY = 76;
const GALLERY_THUMBNAIL_WORKERS = 4;

type Post = PostMeta & { html: string };
type Frontmatter = Record<string, unknown>;

const tsTranspiler = new Bun.Transpiler({ loader: "ts" });

const tsPreprocess = {
  script({ content, attributes }: { content: string; attributes: Record<string, string | boolean> }) {
    if (attributes.lang !== "ts") return undefined;
    return { code: tsTranspiler.transformSync(content) };
  },
};

const sveltePlugin: BunPlugin = {
  name: "svelte",
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const source = await readFile(path, "utf8");
      const { code: processed } = await preprocess(source, [tsPreprocess], { filename: path });
      const out = compile(processed, {
        filename: path,
        generate: "client",
        css: "injected",
        dev: false,
      });
      return { contents: out.js.code, loader: "js" };
    });
  },
};

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

function parseFrontmatter(file: string, raw: string): { meta: Frontmatter; body: string } {
  const m = /^\+\+\+\s*\r?\n([\s\S]*?)\r?\n\+\+\+\s*\r?\n?/.exec(raw);
  if (!m) fail(file, "frontmatter block is required");
  let parsed: unknown;
  try {
    parsed = Bun.TOML.parse(m[1]);
  } catch (error) {
    fail(file, `invalid TOML frontmatter: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(file, "frontmatter must be a TOML table");
  }
  return { meta: parsed as Frontmatter, body: raw.slice(m[0].length) };
}

function validateKeys(file: string, meta: Frontmatter, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(meta)) {
    if (!allowedSet.has(key)) fail(file, `unknown frontmatter field '${key}'`);
  }
}

function requiredString(file: string, meta: Frontmatter, key: string): string {
  const value = meta[key];
  if (typeof value !== "string" || !value.trim()) fail(file, `'${key}' must be a non-empty string`);
  return value.trim();
}

function validateDate(file: string, date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(file, "'date' must use YYYY-MM-DD");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fail(file, `'date' is not a real calendar date: ${date}`);
  }
}

function validateSlug(file: string): string {
  const slug = basename(file, ".md");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail(file, "filename slug must be lowercase kebab-case");
  }
  return slug;
}

function ensureUniqueSlug(file: string, slug: string, seen: Map<string, string>): void {
  const normalized = slug.toLowerCase();
  const existing = seen.get(normalized);
  if (existing) fail(file, `slug duplicates ${existing}`);
  seen.set(normalized, file);
}

async function validateImage(
  file: string,
  meta: Frontmatter,
): Promise<{ image?: string; imageAlt?: string }> {
  const image = meta.image;
  const imageAlt = meta.imageAlt;
  if (image === undefined && imageAlt === undefined) return {};
  if (typeof image !== "string" || !image.trim()) fail(file, "'image' must be a non-empty string");
  if (typeof imageAlt !== "string" || !imageAlt.trim()) {
    fail(file, "'imageAlt' is required when 'image' is set");
  }
  if (!image.startsWith("/img/") || image.includes("\0")) {
    fail(file, "'image' must be a site-relative path under /img/");
  }
  const imagePath = normalize(join(STATIC, image));
  if (!imagePath.startsWith(`${STATIC}/`) || !(await Bun.file(imagePath).exists())) {
    fail(file, `'image' does not exist in static/: ${image}`);
  }
  return { image, imageAlt: imageAlt.trim() };
}

async function buildPosts(): Promise<Post[]> {
  const dir = join(CONTENT, "blog");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const posts: Post[] = [];
  const seen = new Map<string, string>();
  for (const file of files) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const slug = validateSlug(file);
    ensureUniqueSlug(file, slug, seen);
    const raw = await readFile(join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(file, raw);
    validateKeys(file, meta, ["date", "title", "description", "image", "imageAlt"]);
    const title = requiredString(file, meta, "title");
    const date = requiredString(file, meta, "date");
    const description = requiredString(file, meta, "description");
    validateDate(file, date);
    const image = await validateImage(file, meta);
    const html = await marked.parse(body, { gfm: true, breaks: false });
    posts.push({
      slug,
      title,
      date,
      description,
      ...image,
      html,
    });
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  await mkdir(join(DIST, "content", "posts"), { recursive: true });
  for (const p of posts) {
    await writeFile(
      join(DIST, "content", "posts", `${p.slug}.json`),
      JSON.stringify(p),
    );
  }
  return posts;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(date: string): string {
  const d = date ? new Date(`${date}T00:00:00Z`) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toUTCString();
}

function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

async function writeSitemap(posts: PostMeta[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  for (const route of STATIC_ROUTES) {
    lines.push(
      `  <url><loc>${SITE_URL}${route}</loc><lastmod>${today}</lastmod></url>`,
    );
  }
  for (const p of posts) {
    const lastmod = p.date || today;
    lines.push(
      `  <url><loc>${SITE_URL}/blog/${encodeURIComponent(p.slug)}</loc><lastmod>${lastmod}</lastmod></url>`,
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join("\n")}
</urlset>
`;
  await writeFile(join(DIST, "sitemap.xml"), xml);
}

async function writeRss(posts: Post[]): Promise<void> {
  const items = posts.slice(0, RSS_MAX_ITEMS).map((p) => {
    const link = `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`;
    const safeHtml = p.html.replace(/]]>/g, "]]]]><![CDATA[>");
    return `  <item>
    <title>${xmlEscape(p.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${rfc822(p.date)}</pubDate>
    <description>${xmlEscape(p.description)}</description>
    <content:encoded><![CDATA[${safeHtml}]]></content:encoded>
  </item>`;
  }).join("\n");

  const latest = posts[0]?.date ? rfc822(posts[0].date) : new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xmlEscape(SITE_TITLE)}</title>
  <link>${SITE_URL}</link>
  <description>${xmlEscape(SITE_DESCRIPTION)}</description>
  <language>en</language>
  <lastBuildDate>${latest}</lastBuildDate>
  <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`;
  await writeFile(join(DIST, "rss.xml"), xml);
}

async function buildPages(): Promise<void> {
  const dir = join(CONTENT, "pages");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }
  await mkdir(join(DIST, "content", "pages"), { recursive: true });
  const seen = new Map<string, string>();
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = validateSlug(file);
    ensureUniqueSlug(file, slug, seen);
    const raw = await readFile(join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(file, raw);
    validateKeys(file, meta, ["title", "description", "image", "imageAlt"]);
    const title = requiredString(file, meta, "title");
    const description = requiredString(file, meta, "description");
    const image = await validateImage(file, meta);
    const html = await marked.parse(body, { gfm: true, breaks: false });
    await writeFile(
      join(DIST, "content", "pages", `${slug}.json`),
      JSON.stringify({
        slug,
        title,
        description,
        ...image,
        html,
      }),
    );
  }
}

async function readGalleryAltText(files: string[]): Promise<Record<string, string>> {
  const path = join(CONTENT, "gallery.json");
  if (!(await Bun.file(path).exists())) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail("content/gallery.json", `invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail("content/gallery.json", "root value must be an object");
  }
  const known = new Set(files);
  const result: Record<string, string> = {};
  for (const [file, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!known.has(file)) fail("content/gallery.json", `unknown gallery file '${file}'`);
    if (typeof value !== "string" || !value.trim()) {
      fail("content/gallery.json", `description for '${file}' must be a non-empty string`);
    }
    result[file] = value.trim();
  }
  return result;
}

function fallbackGalleryAlt(file: string): string {
  const stem = file.replace(/\.[^.]+$/, "");
  const numeric = /^(\d+)$/.exec(stem);
  if (numeric) return `Gallery photo ${numeric[1]}`;
  const words = stem.replace(/[-_]+/g, " ").trim();
  return `Gallery image ${words || "untitled"}`;
}

async function buildGallery(): Promise<GalleryItem[]> {
  const dir = join(STATIC, "gallery");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const imgs = files.filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f));
  const numericIds = new Map<number, string>();
  for (const file of imgs) {
    const match = /^(\d+)\./.exec(file);
    if (!match) continue;
    const id = Number(match[1]);
    const existing = numericIds.get(id);
    if (existing) fail(file, `numeric gallery id duplicates ${existing}`);
    numericIds.set(id, file);
  }
  imgs.sort((a, b) => {
    const an = parseInt(/^(\d+)/.exec(a)?.[1] ?? "");
    const bn = parseInt(/^(\d+)/.exec(b)?.[1] ?? "");
    const ai = !Number.isNaN(an);
    const bi = !Number.isNaN(bn);
    if (ai && bi) return bn - an;
    if (ai) return -1;
    if (bi) return 1;
    return a.localeCompare(b);
  });
  const altText = await readGalleryAltText(imgs);
  const thumbnailDir = join(DIST, "gallery", "thumbs");
  await mkdir(thumbnailDir, { recursive: true });

  const convertible = imgs.filter((file) => /\.jpe?g$|\.png$/i.test(file));
  let nextThumbnail = 0;
  async function thumbnailWorker(): Promise<void> {
    while (nextThumbnail < convertible.length) {
      const file = convertible[nextThumbnail++];
      const thumbnailFile = `${basename(file, extname(file))}.webp`;
      try {
        await new Bun.Image(join(dir, file))
          .resize(GALLERY_THUMBNAIL_WIDTH, undefined, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: GALLERY_THUMBNAIL_QUALITY })
          .write(join(thumbnailDir, thumbnailFile));
      } catch (error) {
        fail(file, `could not generate thumbnail: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(GALLERY_THUMBNAIL_WORKERS, convertible.length) },
      () => thumbnailWorker(),
    ),
  );

  const items: GalleryItem[] = [];
  for (const file of imgs) {
    const thumbnailFile = `${basename(file, extname(file))}.webp`;
    const canConvert = /\.jpe?g$|\.png$/i.test(file);
    items.push({
      src: `/gallery/${file}`,
      ...(canConvert ? { thumbnail: `/gallery/thumbs/${thumbnailFile}` } : {}),
      alt: altText[file] ?? fallbackGalleryAlt(file),
    });
  }
  return items;
}

async function buildClient(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(SRC, "index.ts")],
    outdir: DIST,
    plugins: [sveltePlugin],
    target: "browser",
    format: "esm",
    minify: true,
    splitting: true,
    naming: { entry: "[name].[ext]" },
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("client build failed");
  }
}

async function minifyCss(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(STATIC, "css", "style.css")],
    outdir: join(DIST, "css"),
    minify: true,
    external: ["*.ttf"],
    naming: "[name].[ext]",
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("css minify failed");
  }
}

async function writeIndexHtml(): Promise<void> {
  const canonical = `${SITE_URL}/`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${xmlEscape(SITE_TITLE)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#4f7193" />
    <meta name="description" content="${xmlEscape(SITE_DESCRIPTION)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
    <link rel="shortcut icon" href="/img/favicon.ico" type="image/x-icon" />
    <link rel="alternate" type="application/rss+xml" title="OddKnight's Space" href="/rss.xml" />
    <link rel="stylesheet" href="/css/style.css" />
    <script>(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();</script>
    <script type="module" src="/index.js"></script>
  </head>
  <body></body>
</html>
`;
  await writeFile(join(DIST, "index.html"), minifyHtml(html));
}

async function main(): Promise<void> {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  await cp(STATIC, DIST, { recursive: true });
  await minifyCss();

  const [posts, gallery] = await Promise.all([buildPosts(), buildGallery()]);
  await buildPages();

  const postMeta: PostMeta[] = posts.map(({ html, ...meta }) => meta);
  await Promise.all([
    writeFile(join(DIST, "content", "posts.json"), JSON.stringify(postMeta)),
    writeFile(join(DIST, "content", "gallery.json"), JSON.stringify(gallery)),
  ]);

  await writeSitemap(postMeta);
  await writeRss(posts);

  await buildClient();
  await writeIndexHtml();

  console.log(`Built ${posts.length} posts, ${gallery.length} gallery items → dist/`);
}

await main();
