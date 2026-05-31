<script>
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import ScrollTop from "../components/ScrollTop.svelte";

  let { slug } = $props();
  let post = $state(null);
  let notFound = $state(false);

  onMount(async () => {
    try {
      const r = await fetch(`/content/posts/${encodeURIComponent(slug)}.json`);
      if (!r.ok) {
        notFound = true;
        setMeta("404 - Page not found");
        return;
      }
      post = await r.json();
      setMeta(post.title, post.description);
    } catch {
      notFound = true;
      setMeta("404 - Page not found");
    }
  });
</script>

{#if notFound}
  <h1>404</h1>
  <p>Page not found</p>
{:else if post}
  <ScrollTop />
  <h1 class="title">{post.title}</h1>
  <p class="subtitle"><i>{post.date}</i></p>
  {@html post.html}
{/if}
