# oddknight.space

Zola static site with TypeScript interactions and Bun build tooling. Live at [oddknight.space](https://oddknight.space).

Requires [Zola](https://www.getzola.org/documentation/getting-started/installation/) 0.23+ and Bun 1.4+ (verified with Zola 0.23.6 and Bun 1.4.2).

```sh
bun install --frozen-lockfile
bun run dev           # local preview on :3000; rebuilds and reloads on edits
bun run check         # TypeScript checks
bun run build         # incremental production build → dist/
bun run build -f      # clean rebuild (--force also works)
bun run serve         # static preview on :3000
bun run start         # build and preview
```

`bunfig.toml` requires newly resolved package versions to be at least 14 days old, including transitive dependencies, with no exemptions. The lockfile was regenerated under this policy. Existing locked versions are not rechecked by Bun's release-age gate.

## Build and development

Use `bun run build` rather than invoking `zola build` directly. The TypeScript build script creates a temporary Zola workspace, copies authored content and templates, supplies the gallery index, and runs Zola. Zola's built-in highlighter uses the GitHub light/dark themes; the build script then minifies the final HTML. Bun bundles/minifies browser TypeScript and CSS; no framework or browser syntax highlighter is shipped.

Each route has its own HTML file and renders its content before JavaScript runs. JavaScript adds theme switching, navigation controls, the gallery viewer, code copying, confetti, the visit counter, the message form, and `/yo`. Images in Markdown and gallery thumbnails use native lazy loading and asynchronous decoding. The logo loads eagerly. Gallery full-size images load on opening the viewer; adjacent photos preload afterward.

Production builds use `.build-cache.json` to reuse unchanged bundles, CSS, static files, individual thumbnails, and rendered pages. Missing or modified outputs are regenerated and removed inputs remove their outputs. Changes to build tooling, dependencies, Bun, or Zola invalidate the cache. `-f` clears `dist/` and rebuilds everything. A failed build invalidates the manifest.

Development output and its cache live in a temporary directory, removed on shutdown. The server rebuilds on changes to `content/`, `templates/`, `src/`, `static/`, and `zola.toml`, then reloads the browser. Failed builds show a development error overlay and retain the last working pages. Restart after changing build tooling, dependencies, environment variables, or server code.

## Content

Add a Markdown file in `content/blog/`:

```toml
+++
date = "2026-09-30"
title = "My new post"
description = "What it's about"

[extra]
image = "/img/my-new-post/photo.webp"
imageAlt = "A description of the photo"
+++
```

Write the Markdown body after the frontmatter. The filename becomes the slug, available at `/blog/my-new-post` and `/blog/my-new-post/`. Posts sort by descending date, the homepage shows the latest five, and the archive groups them by year. Custom metadata belongs under `[extra]`.

Add gallery images to `static/gallery/`. Numeric filenames sort descending, followed by non-numeric names alphabetically. Duplicate numeric photo IDs are rejected. Optional alt descriptions live in `content/gallery.json`, keyed by filename. JPEG/PNG previews are generated at up to 720px wide as WebP (quality 76) without enlarging smaller sources. Originals remain available. Viewer links such as `/gallery?photo=38` are preserved.

Add other pages as `content/<slug>.md` with `template = "page.html"`; `path` can override the route. Contact, gallery, and `/yo` use their existing dedicated routes. All public assets remain in `static/`, including fonts, icons, downloads, and robots.txt. Zola generates the sitemap and publishes its built-in RSS 2.0 feed at `/rss.xml`, containing the latest 20 dated posts. No custom feed template or XML postprocessing is used. `/yo` remains excluded from the sitemap and disallowed in robots.txt.

## Static hosting and Telegram messages

Deploy only `dist/` to your static host. The preview server is optional; Zola and Bun are not needed to serve production pages.

For Nginx, point `root` at the deployed `dist/` directory and use directory indexes and a real custom 404:

```nginx
index index.html;
error_page 404 /404.html;
location / {
    try_files $uri $uri/ =404;
}
location = /404.html {
    internal;
}
```

The home-page form posts `{"message":"..."}` to `/message`. Telegram sending is a separate optional service:

```sh
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... bun run serve:message
```

Keep credentials in server environment variables. The service binds to `127.0.0.1:3001` by default; change it with `MESSAGE_PORT`. Configure your existing reverse proxy:

```nginx
location = /message {
    client_max_body_size 16k;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
}
```

For local preview or development, set `MESSAGE_UPSTREAM=http://127.0.0.1:3001`. Without an upstream, the form keeps its appearance and reports a send failure. `PORT` controls the local static/development server port; it binds to loopback. Both preview and development accept extensionless routes and return HTTP 404 for unknown pages.

## Verification


The migration was compared against the prior Svelte implementation at 1280×900 and 390×844 in light and dark themes, including all eight posts and the 404 page. Core content is embedded in HTML and readable without JavaScript; gallery thumbnails and mobile navigation have a no-JavaScript visibility fallback. Code-copy feedback requires HTTPS or localhost.
