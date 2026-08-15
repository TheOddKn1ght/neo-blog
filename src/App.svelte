<script lang="ts">
  import { onMount, type Component } from "svelte";
  import { getPath, installRouter, subscribe } from "./router";
  import Nav from "./components/Nav.svelte";
  import Footer from "./components/Footer.svelte";

  type Route =
    | { name: "home" }
    | { name: "blogList" }
    | { name: "blogPost"; slug: string }
    | { name: "gallery" }
    | { name: "contact" }
    | { name: "yo" }
    | { name: "notFound" };

  let path: string = $state(getPath());
  let PageComponent: Component<any> | null = $state(null);
  let pageLoadFailed: boolean = $state(false);

  onMount(() => {
    const teardownRouter = installRouter();
    const unsub = subscribe((p: string) => (path = p));
    return () => {
      teardownRouter();
      unsub();
    };
  });

  function match(p: string): Route {
    const stripped = p.replace(/\/+$/, "") || "/";
    if (stripped === "/") return { name: "home" };
    if (stripped === "/blog") return { name: "blogList" };
    const m = /^\/blog\/([^\/]+)$/.exec(stripped);
    if (m) return { name: "blogPost", slug: decodeURIComponent(m[1]) };
    if (stripped === "/gallery") return { name: "gallery" };
    if (stripped === "/contact") return { name: "contact" };
    if (stripped === "/yo") return { name: "yo" };
    return { name: "notFound" };
  }

  const route: Route = $derived(match(path));
  const pageProps = $derived(route.name === "blogPost" ? { slug: route.slug } : {});

  function loadPage(currentRoute: Route): Promise<{ default: Component<any> }> {
    switch (currentRoute.name) {
      case "home": return import("./pages/Home.svelte");
      case "blogList": return import("./pages/BlogList.svelte");
      case "blogPost": return import("./pages/BlogPost.svelte");
      case "gallery": return import("./pages/Gallery.svelte");
      case "contact": return import("./pages/Contact.svelte");
      case "yo": return import("./pages/Yo.svelte");
      default: return import("./pages/NotFound.svelte");
    }
  }

  $effect(() => {
    const requestedPath = path;
    const requestedRoute = route;
    PageComponent = null;
    pageLoadFailed = false;
    void loadPage(requestedRoute).then(
      (module) => {
        if (path === requestedPath) PageComponent = module.default;
      },
      () => {
        if (path === requestedPath) pageLoadFailed = true;
      },
    );
  });
</script>

<svelte:head>
  <script data-goatcounter="https://oddknight.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</svelte:head>

<a class="skip-link" href="#main-content">Skip to content</a>
<Nav {path} />
<main id="main-content" class="section" tabindex="-1">
  <div class="container">
    {#key path}
      {#if PageComponent}
        <PageComponent {...pageProps} />
      {:else if pageLoadFailed}
        <div class="load-state error-state" role="alert">
          <p>Couldn’t load this page.</p>
          <button type="button" class="retry-button" onclick={() => location.reload()}>Try again</button>
        </div>
      {:else}
        <p class="load-state" role="status">Loading…</p>
      {/if}
    {/key}
  </div>
</main>
<Footer />
<div id="footer-title">
  <a href="/">oddknight.space</a>
</div>
