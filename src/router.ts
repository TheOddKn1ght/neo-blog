import { tick } from "svelte";

type Listener = (path: string) => void;

const DEFAULT_DESCRIPTION = "OddKnight's personal webpage. Thanks for stopping by!";
const listeners = new Set<Listener>();
let current = typeof location !== "undefined" ? location.pathname : "/";

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

export function setMeta(title: string, description: string = DEFAULT_DESCRIPTION): void {
  document.title = title;
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = description;
}
