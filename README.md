# oddknight.space

Static SPA. Svelte + Bun + TypeScript + marked. Live at [oddknight.space](https://oddknight.space).

## Develop

```sh
bun install
bun run build      # → dist/
bun run serve      # serves dist/ on :3000 and proxies /message to Telegram
bun run start      # build + serve
```

`PORT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` are read from the environment.

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

The gallery is sorted descending by numeric filename stem (so `38.jpg` appears
before `37.png`), then non-numeric filenames alphabetically.

## Add a static page

Drop a markdown file in `content/pages/`. It becomes available as JSON at
`/content/pages/<slug>.json` and you can render it from a Svelte page (see
`src/pages/Contact.svelte` for the pattern).

## Project layout

```
build.ts          # scans content/, compiles Svelte, copies static/ → dist/
server.ts         # Bun.serve: static dist/ + SPA fallback + Telegram proxy
src/
  main.ts         # mounts Svelte App to <body>
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
