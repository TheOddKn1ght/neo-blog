<script lang="ts">
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import ScrollTop from "../components/ScrollTop.svelte";
  import { isPost, type Post } from "../types";

  let { slug }: { slug: string } = $props();
  let post: Post | null = $state(null);
  let loadState: "loading" | "ready" | "notFound" | "error" = $state("loading");
  let controller: AbortController | undefined;

  async function loadPost(): Promise<void> {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loadState = "loading";
    post = null;
    try {
      const response = await fetch(`/content/posts/${encodeURIComponent(slug)}.json`, {
        signal: request.signal,
      });
      if (response.status === 404) {
        loadState = "notFound";
        setMeta({
          title: "404 - Page not found",
          path: location.pathname,
          noIndex: true,
        });
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isPost(data)) throw new Error("Invalid post");
      post = data;
      loadState = "ready";
      setMeta({
        title: data.title,
        description: data.description,
        path: `/blog/${encodeURIComponent(data.slug)}`,
        type: "article",
        image: data.image,
        imageAlt: data.imageAlt,
        publishedTime: data.date,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      loadState = "error";
      setMeta({
        title: "Couldn’t load post",
        path: location.pathname,
        noIndex: true,
      });
    }
  }

  onMount(() => {
    setMeta({
      title: "Loading post…",
      path: location.pathname,
      noIndex: true,
    });
    void loadPost();
    return () => controller?.abort();
  });
</script>

{#if loadState === "loading"}
  <p class="load-state" role="status">Loading post…</p>
{:else if loadState === "notFound"}
  <h1>404</h1>
  <p>Page not found</p>
{:else if loadState === "error"}
  <div class="load-state error-state" role="alert">
    <p>Couldn’t load this post.</p>
    <button type="button" class="retry-button" onclick={loadPost}>Try again</button>
  </div>
{:else if post}
  <ScrollTop />
  <article>
    <h1 class="title">{post.title}</h1>
    <p class="subtitle"><time datetime={post.date}>{post.date}</time></p>
    {@html post.html}
  </article>
{/if}
