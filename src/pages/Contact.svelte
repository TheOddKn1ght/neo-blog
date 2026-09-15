<script lang="ts">
  import MarkdownContent from "../components/MarkdownContent.svelte";
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import { isPage, type Page } from "../types";

  let page: Page | null = $state(null);
  let loading: boolean = $state(true);
  let error: string = $state("");
  let controller: AbortController | undefined;

  async function loadPage(): Promise<void> {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading = true;
    error = "";
    try {
      const response = await fetch("/content/pages/contact.json", { signal: request.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isPage(data)) throw new Error("Invalid page");
      page = data;
      setMeta({
        title: data.title,
        description: data.description,
        path: "/contact",
        image: data.image,
        imageAlt: data.imageAlt,
      });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      page = null;
      error = "Couldn’t load the contact page.";
    } finally {
      if (!request.signal.aborted) loading = false;
    }
  }

  onMount(() => {
    setMeta({
      title: "Contact",
      description: "OddKnight's contact information",
      path: "/contact",
    });
    void loadPage();
    return () => controller?.abort();
  });
</script>

{#if loading}
  <p class="load-state" role="status">Loading contact information…</p>
{:else if error}
  <div class="load-state error-state" role="alert">
    <p>{error}</p>
    <button type="button" class="retry-button" onclick={loadPage}>Try again</button>
  </div>
{:else if page}
  <h1 class="title">{page.title}</h1>
  <MarkdownContent html={page.html} />
{/if}
