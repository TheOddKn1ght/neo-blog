import { compile } from "svelte/compiler";
import { marked } from "marked";
import { readdir, readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import type { BunPlugin } from "bun";

const ROOT = import.meta.dir;
const SRC = join(ROOT, "src");
const STATIC = join(ROOT, "static");
const CONTENT = join(ROOT, "content");
const DIST = join(ROOT, "dist");

const SITE_URL = "https://oddknight.space";
const SITE_TITLE = "OddKnight's Space";
const SITE_DESCRIPTION = "OddKnight's personal webpage. Thanks for stopping by!";
const STATIC_ROUTES = ["/", "/blog", "/gallery", "/contact"];
const RSS_MAX_ITEMS = 20;

type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
};

type Post = PostMeta & { html: string };

const sveltePlugin: BunPlugin = {
  name: "svelte",
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const source = await readFile(path, "utf8");
      const out = compile(source, {
        filename: path,
        generate: "client",
        css: "injected",
        dev: false,
      });
      return { contents: out.js.code, loader: "js" };
    });
  },
};

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^\+\+\+\s*\r?\n([\s\S]*?)\r?\n\+\+\+\s*\r?\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([A-Za-z_][\w]*)\s*=\s*(.+?)\s*$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[kv[1]] = v;
  }
  return { meta, body: raw.slice(m[0].length) };
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
  for (const file of files) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const slug = basename(file, ".md");
    const raw = await readFile(join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const html = await marked.parse(body, { gfm: true, breaks: false });
    posts.push({
      slug,
      title: meta.title ?? slug,
      date: meta.date ?? "",
      description: meta.description ?? "",
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
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = basename(file, ".md");
    const raw = await readFile(join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const html = await marked.parse(body, { gfm: true, breaks: false });
    await writeFile(
      join(DIST, "content", "pages", `${slug}.json`),
      JSON.stringify({
        slug,
        title: meta.title ?? slug,
        description: meta.description ?? "",
        html,
      }),
    );
  }
}

async function buildGallery(): Promise<string[]> {
  const dir = join(STATIC, "gallery");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const imgs = files.filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f));
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
  return imgs.map((f) => `/gallery/${f}`);
}

async function buildClient(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(SRC, "index.ts")],
    outdir: DIST,
    plugins: [sveltePlugin],
    target: "browser",
    format: "esm",
    minify: true,
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
    naming: "[name].[ext]",
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("css minify failed");
  }
}

async function writeIndexHtml(): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OddKnight's Space</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#4f7193" />
    <meta name="description" content="OddKnight's personal webpage. Thanks for stopping by!" />
    <link rel="shortcut icon" href="/img/favicon.ico" type="image/x-icon" />
    <link rel="alternate" type="application/rss+xml" title="OddKnight's Space" href="/rss.xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Azeret+Mono:ital,wght@0,100..900;1,100..900&display=swap" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Azeret+Mono:ital,wght@0,100..900;1,100..900&display=swap" />
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
  await writeFile(
    join(DIST, "content", "index.json"),
    JSON.stringify({ posts: postMeta, gallery }),
  );

  await writeSitemap(postMeta);
  await writeRss(posts);

  await buildClient();
  await writeIndexHtml();

  console.log(`Built ${posts.length} posts, ${gallery.length} gallery items → dist/`);
}

await main();
