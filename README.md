# oddknight.space

Static SPA. Svelte + Bun + TypeScript. Live at [oddknight.space](https://oddknight.space).

## Develop

```sh
bun install
bun run dev        # Svelte/CSS hot reloading on :3000

# Production
bun run build      # incremental build → dist/
bun run build -f   # force a clean rebuild
bun run serve      # serves dist/ on :3000 and proxies /message to Telegram
bun run start      # build + serve
```

`PORT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` are read from the environment.

`bun run dev` uses Vite and the official Svelte plugin for component and CSS hot
reloading. Changes in `content/` and static assets refresh the browser after content
generation succeeds; invalid content shows an error overlay and preserves the last
working content. Generated development files live in a temporary directory and are
removed on shutdown. `/message` uses the same Telegram handler as production.
Restart the dev command after changing `build.ts`, `server.ts`, or `dev.ts`.

Production builds cache content fingerprints in `.build-cache.json`. Unchanged
bundles, CSS, content, static files, and individual gallery thumbnails are reused.
Changed inputs rebuild their affected steps; removed inputs remove their outputs.
Missing or modified outputs are regenerated. Changes to build scripts, dependencies,
TypeScript configuration, or the Bun version invalidate the cache. `-f` (or `--force`)
clears `dist/` and rebuilds everything. A failed build invalidates the cache so the
next run starts clean. Client source changes rebuild the client bundle as a whole.

## Add a blog post

1. Drop a markdown file in `content/blog/`, e.g. `content/blog/my-new-post.md`:
   ```
   +++
   date = "2026-05-28"
   title = "My new post"
   description = "What it's about"
   +++

   Markdown body here.
   ```
2. `bun run build` — the post is now at `/blog/my-new-post`.

The filename (minus `.md`) becomes the URL slug. Posts are sorted by `date`
descending on the listing page and grouped by year.

## Add a gallery image

1. Drop the image in `static/gallery/`, e.g. `static/gallery/38.jpg`.
2. `bun run build`.

The build uses Bun's built-in image pipeline to generate 720px-wide WebP
previews in `dist/gallery/thumbs/`. The full-resolution image is still used in
the viewer; no external image tooling is required.

The gallery is sorted descending by numeric filename stem (so `38.jpg` appears
before `37.png`), then non-numeric filenames alphabetically.

## Add a static page

Drop a markdown file in `content/pages/`. It becomes available as JSON at
`/content/pages/<slug>.json` and you can render it from a Svelte page (see
`src/pages/Contact.svelte` for the pattern).

## Project layout

```
dev.ts            # Vite HMR + content watching + development message endpoint
build.ts          # scans content/, compiles Svelte, copies static/ → dist/
server.ts         # Bun.serve: static dist/ + SPA fallback + Telegram proxy
src/
  index.ts        # mounts Svelte App to <body>
  router.ts       # history-API SPA router
  App.svelte      # route switch
  components/     # Nav, Footer, ScrollTop
  pages/          # Home, BlogList, BlogPost, Gallery, Contact, Yo, NotFound
  behaviors/      # counter, lazyLoad, logoConfetti, enlarge (ported from static/js)
content/
  blog/*.md       # blog posts (frontmatter + markdown)
  pages/*.md      # extra static pages
static/           # copied verbatim to dist/ (css, img, gallery, fonts, robots.txt)
```

## Code highlighting

Fenced Markdown code blocks with a language (for example `js`, `json`, or `sh`)
are highlighted at build time with Shiki. Colors follow the site's light/dark
setting, and long lines scroll horizontally. Unknown languages and unlabeled
blocks remain plain text; inline code is unchanged. No highlighting JavaScript
is shipped to the browser. Changes to `markdown.ts` invalidate the build cache;
restart the dev server after editing the renderer.
