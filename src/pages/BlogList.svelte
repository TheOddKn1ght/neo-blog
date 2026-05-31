<script>
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import ScrollTop from "../components/ScrollTop.svelte";

  let posts = $state([]);

  onMount(() => {
    setMeta("OddKnight's Space | List of posts", "List of OddKnight's posts");
    fetch("/content/index.json")
      .then((r) => r.json())
      .then((data) => {
        posts = data.posts ?? [];
      })
      .catch(() => {});
  });

  function yearOf(p) {
    return (p.date ?? "").slice(0, 4) || "Undated";
  }

  const grouped = $derived.by(() => {
    const map = new Map();
    for (const p of posts) {
      const y = yearOf(p);
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(p);
    }
    return Array.from(map.entries());
  });
</script>

<h1 class="title">List of blog posts</h1>
{#each grouped as [year, items]}
  <h2>{year}</h2>
  <ul id="posts-list">
    {#each items as p}
      <li>{p.date}</li>
      <li><a href="/blog/{p.slug}">{p.title}</a></li>
    {/each}
  </ul>
{/each}
<ScrollTop />
