<script lang="ts">
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import ScrollTop from "../components/ScrollTop.svelte";
  import { isPostIndex, type PostMeta } from "../types";

  let posts: PostMeta[] = $state([]);
  let loading: boolean = $state(true);
  let error: string = $state("");
  let controller: AbortController | undefined;

  async function loadPosts(): Promise<void> {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading = true;
    error = "";
    try {
      const response = await fetch("/content/posts.json", { signal: request.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isPostIndex(data)) throw new Error("Invalid post index");
      posts = data;
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      posts = [];
      error = "Couldn’t load the post list.";
    } finally {
      if (!request.signal.aborted) loading = false;
    }
  }

  onMount(() => {
    setMeta({
      title: "OddKnight's Space | List of posts",
      description: "List of OddKnight's posts",
      path: "/blog",
    });
    void loadPosts();
    return () => controller?.abort();
  });

  function yearOf(p: PostMeta): string {
    return (p.date ?? "").slice(0, 4) || "Undated";
  }

  const grouped: [string, PostMeta[]][] = $derived.by(() => {
    const map = new Map<string, PostMeta[]>();
    for (const p of posts) {
      const y = yearOf(p);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return Array.from(map.entries());
  });
</script>

<h1 class="title">List of blog posts</h1>
{#if loading}
  <p class="load-state" role="status">Loading posts…</p>
{:else if error}
  <div class="load-state error-state" role="alert">
    <p>{error}</p>
    <button type="button" class="retry-button" onclick={loadPosts}>Try again</button>
  </div>
{:else if posts.length === 0}
  <p class="load-state">No posts yet.</p>
{:else}
  {#each grouped as [year, items]}
    <section aria-labelledby="year-{year}">
      <h2 id="year-{year}">{year}</h2>
      <ul class="posts-list">
        {#each items as p}
          <li>
            <time datetime={p.date}>{p.date}</time>
            <a href="/blog/{p.slug}">{p.title}</a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{/if}
<ScrollTop />
