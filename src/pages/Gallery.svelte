<script lang="ts">
  import { onMount, tick } from "svelte";
  import { setMeta } from "../router";
  import ScrollTop from "../components/ScrollTop.svelte";
  import GalleryImage from "../components/GalleryImage.svelte";
  import GalleryModal from "../components/GalleryModal.svelte";
  import { isGalleryIndex, type GalleryItem } from "../types";

  type StartViewTransition = (callback: () => void | Promise<void>) => {
    finished: Promise<void>;
  };

  let items: GalleryItem[] = $state([]);
  let loading: boolean = $state(true);
  let error: string = $state("");
  let selectedIndex: number | null = $state(null);
  let activeTrigger: HTMLButtonElement | undefined;
  let modalImage: HTMLImageElement | undefined = $state();
  let controller: AbortController | undefined;
  const triggers: HTMLButtonElement[] = [];
  const thumbnailImages: HTMLImageElement[] = [];

  function photoNumber(item: GalleryItem): number | null {
    const match = /\/gallery\/(\d+)\./.exec(item.src);
    return match ? Number(match[1]) : null;
  }

  function readPhotoIndex(): number | null {
    const raw = new URL(location.href).searchParams.get("photo");
    if (raw === null || !/^\d+$/.test(raw)) return null;
    const photo = Number(raw);
    const index = items.findIndex((item) => photoNumber(item) === photo);
    return index >= 0 ? index : null;
  }

  function writePhotoIndex(index: number): void {
    const url = new URL(location.href);
    const photo = photoNumber(items[index]);
    if (photo === null) url.searchParams.delete("photo");
    else url.searchParams.set("photo", String(photo));
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function clearPhotoIndex(): void {
    const url = new URL(location.href);
    if (!url.searchParams.has("photo")) return;
    url.searchParams.delete("photo");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function canMorph(): boolean {
    const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
    return typeof start === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  async function withMorph(
    source: Element | undefined,
    target: () => Element | undefined,
    update: () => void,
  ): Promise<void> {
    if (!source || !canMorph()) {
      update();
      await tick();
      return;
    }
    document.body.classList.add("vt-active");
    source.classList.add("vt-morph");
    const documentWithTransition = document as Document & {
      startViewTransition: StartViewTransition;
    };
    const transition = documentWithTransition.startViewTransition(async () => {
      source.classList.remove("vt-morph");
      update();
      await tick();
      target()?.classList.add("vt-morph");
    });
    try {
      await transition.finished;
    } finally {
      target()?.classList.remove("vt-morph");
      document.body.classList.remove("vt-active");
    }
  }

  async function openModal(
    index: number,
    trigger?: HTMLButtonElement,
    updateUrl = true,
  ): Promise<void> {
    if (index < 0 || index >= items.length) return;
    activeTrigger = trigger ?? triggers[index];
    if (updateUrl) writePhotoIndex(index);
    await withMorph(
      thumbnailImages[index],
      () => modalImage,
      () => {
        selectedIndex = index;
      },
    );
  }

  async function closeModal(updateUrl = true): Promise<void> {
    if (selectedIndex === null) return;
    const closingIndex = selectedIndex;
    const focusTarget = activeTrigger ?? triggers[closingIndex];
    if (updateUrl) clearPhotoIndex();
    await withMorph(
      modalImage,
      () => thumbnailImages[closingIndex],
      () => {
        selectedIndex = null;
      },
    );
    await tick();
    (focusTarget ?? triggers[closingIndex])?.focus({ preventScroll: true });
  }

  function onNavigate(index: number): void {
    selectedIndex = index;
    writePhotoIndex(index);
  }

  async function syncFromUrl(): Promise<void> {
    const index = readPhotoIndex();
    if (index === null) {
      await closeModal(false);
    } else if (index !== selectedIndex) {
      await openModal(index, triggers[index], false);
    }
  }

  async function loadGallery(): Promise<void> {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading = true;
    error = "";
    try {
      const response = await fetch("/content/gallery.json", { signal: request.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isGalleryIndex(data)) throw new Error("Invalid gallery index");
      items = data;
      await tick();
      if (!request.signal.aborted) await syncFromUrl();
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      items = [];
      error = "Couldn’t load the gallery.";
    } finally {
      if (!request.signal.aborted) loading = false;
    }
  }

  onMount(() => {
    setMeta({
      title: "Gallery",
      description: "OddKnight's silly ugly photos",
      path: "/gallery",
    });
    const onPopstate = () => void syncFromUrl();
    window.addEventListener("popstate", onPopstate);
    void loadGallery();
    return () => {
      controller?.abort();
      window.removeEventListener("popstate", onPopstate);
      document.body.classList.remove("modal-open", "vt-active");
    };
  });
</script>

<ScrollTop />
<h1 class="title">Gallery</h1>

{#if loading}
  <p class="load-state" role="status">Loading gallery…</p>
{:else if error}
  <div class="load-state error-state" role="alert">
    <p>{error}</p>
    <button type="button" class="retry-button" onclick={loadGallery}>Try again</button>
  </div>
{:else if items.length === 0}
  <p class="load-state">No gallery images yet.</p>
{:else}
  <div class="gallery">
    {#each items as item, index}
      <button
        bind:this={triggers[index]}
        type="button"
        class="gallery-item"
        aria-label="Open {item.alt}"
        onclick={(event) => void openModal(index, event.currentTarget)}
      >
        <GalleryImage {item} bind:element={thumbnailImages[index]} />
      </button>
    {/each}
  </div>
{/if}

{#if selectedIndex !== null}
  <GalleryModal
    {items}
    index={selectedIndex}
    bind:modalImage
    {onNavigate}
    onClose={() => void closeModal()}
  />
{/if}
