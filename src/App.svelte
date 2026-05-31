<script>
  import { onMount } from "svelte";
  import { getPath, installRouter, subscribe } from "./router";
  import Nav from "./components/Nav.svelte";
  import Footer from "./components/Footer.svelte";
  import Home from "./pages/Home.svelte";
  import BlogList from "./pages/BlogList.svelte";
  import BlogPost from "./pages/BlogPost.svelte";
  import Gallery from "./pages/Gallery.svelte";
  import Contact from "./pages/Contact.svelte";
  import Yo from "./pages/Yo.svelte";
  import NotFound from "./pages/NotFound.svelte";

  let path = $state(getPath());

  onMount(() => {
    const teardownRouter = installRouter();
    const unsub = subscribe((p) => (path = p));
    return () => {
      teardownRouter();
      unsub();
    };
  });

  function match(p) {
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

  const route = $derived(match(path));
</script>

<svelte:head>
  <script data-goatcounter="https://oddknight.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</svelte:head>

<Nav />
<section class="section">
  <div class="container">
    {#key path}
      {#if route.name === "home"}
        <Home />
      {:else if route.name === "blogList"}
        <BlogList />
      {:else if route.name === "blogPost"}
        <BlogPost slug={route.slug} />
      {:else if route.name === "gallery"}
        <Gallery />
      {:else if route.name === "contact"}
        <Contact />
      {:else if route.name === "yo"}
        <Yo />
      {:else}
        <NotFound />
      {/if}
    {/key}
  </div>
</section>
<Footer />
<div id="footer-title">
  <a href="/">oddknight.space</a>
</div>
