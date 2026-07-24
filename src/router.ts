import { tick } from "svelte";
import {
  SITE_DESCRIPTION,
  SITE_IMAGE,
  SITE_IMAGE_ALT,
  SITE_TITLE,
  SITE_URL,
} from "./site";

type Listener = (path: string) => void;

const listeners = new Set<Listener>();
let current = typeof location !== "undefined" ? location.pathname : "/";

export type PageMeta = {
  title: string;
  description?: string;
  path?: string;
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  publishedTime?: string;
  noIndex?: boolean;
};

function emit(path: string) {
  current = path;
  for (const l of listeners) l(path);
}

type StartViewTransition = (cb: () => void | Promise<void>) => unknown;

function withTransition(update: () => void): void {
  const start = (document as Document & { startViewTransition?: StartViewTransition })
    .startViewTransition;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!start || reduce) {
    update();
    return;
  }
  start.call(document, async () => {
    update();
    await tick();
  });
}

export function getPath(): string {
  return current;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = new URL(to, location.href);
  if (url.origin !== location.origin) {
    location.href = to;
    return;
  }
  const target = url.pathname + url.search + url.hash;
  if (target === location.pathname + location.search + location.hash) return;
  if (opts.replace) history.replaceState({}, "", target);
  else history.pushState({}, "", target);
  withTransition(() => {
    emit(url.pathname);
    if (!url.hash) window.scrollTo(0, 0);
  });
}

export function installRouter(): () => void {
  const onPop = () => withTransition(() => emit(location.pathname));
  window.addEventListener("popstate", onPop);

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const target = e.target as Element | null;
    const a = target?.closest("a") as HTMLAnchorElement | null;
    if (!a) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;

    const href = a.getAttribute("href");
    if (!href) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (a.origin !== location.origin) return;

    if (a.pathname === location.pathname && a.search === location.search) {
      return;
    }

    e.preventDefault();
    navigate(a.href);
  };

  document.addEventListener("click", onClick);
  return () => {
    window.removeEventListener("popstate", onPop);
    document.removeEventListener("click", onClick);
  };
}

function upsertMeta(attribute: "name" | "property", key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function removeMeta(attribute: "name" | "property", key: string): void {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
}

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

export function setMeta(meta: PageMeta): void {
  const description = meta.description ?? SITE_DESCRIPTION;
  const path = meta.path ?? location.pathname;
  const type = meta.type ?? "website";
  const customImage = meta.image !== undefined;
  const image = meta.image ?? SITE_IMAGE;
  const imageAlt = meta.imageAlt ?? (customImage ? meta.title : SITE_IMAGE_ALT);
  const canonicalUrl = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  document.title = meta.title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", meta.noIndex ? "noindex, nofollow" : "index, follow");
  upsertMeta("property", "og:site_name", SITE_TITLE);
  upsertMeta("property", "og:title", meta.title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:image", imageUrl);
  upsertMeta("property", "og:image:alt", imageAlt);
  upsertMeta("name", "twitter:card", customImage ? "summary_large_image" : "summary");
  upsertMeta("name", "twitter:title", meta.title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", imageUrl);
  upsertMeta("name", "twitter:image:alt", imageAlt);

  if (type === "article" && meta.publishedTime) {
    upsertMeta("property", "article:published_time", `${meta.publishedTime}T00:00:00Z`);
  } else {
    removeMeta("property", "article:published_time");
  }

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;
}
