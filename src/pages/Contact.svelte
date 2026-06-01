<script lang="ts">
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import type { Page } from "../types";

  let page: Page | null = $state(null);

  onMount(async () => {
    try {
      const r = await fetch("/content/pages/contact.json");
      if (!r.ok) return;
      page = await r.json();
      setMeta(page!.title, page!.description);
    } catch {}
  });
</script>

{#if page}
  <h1 class="title">{page.title}</h1>
  {@html page.html}
{/if}
