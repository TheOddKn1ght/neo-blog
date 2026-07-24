<script lang="ts">
  import { onMount, tick } from "svelte";
  import { setMeta } from "../router";
  import ScrollTop from "../components/ScrollTop.svelte";
  import { installLazyLoad } from "../behaviors/lazyLoad";
  import { installEnlarge } from "../behaviors/enlarge";

  let images: string[] = $state([]);
  let teardownLazy: (() => void) | undefined;
  let teardownEnlarge: (() => void) | undefined;

  onMount(() => {
    let cancelled = false;
    setMeta("Gallery", "OddKnight's silly ugly photos");
    void (async () => {
      try {
        const r = await fetch("/content/index.json");
        const data: { gallery?: string[] } = await r.json();
        images = data.gallery ?? [];
      } catch {}
      await tick();
      if (cancelled) return;
      teardownLazy = installLazyLoad();
      teardownEnlarge = installEnlarge();
    })();
    return () => {
      cancelled = true;
      teardownLazy?.();
      teardownEnlarge?.();
    };
  });
</script>

<ScrollTop />
<h1 class="title">Gallery</h1>

<div class="gallery">
  {#each images as src, index}
    <button type="button" class="gallery-item" aria-label="Open gallery image {index + 1}">
      <img class="lazy-load" data-src={src} alt="" loading="lazy" decoding="async" />
    </button>
  {/each}
</div>
<div id="modal" class="modal" role="dialog" aria-modal="true" aria-label="Gallery image viewer" aria-hidden="true">
  <button id="modalClose" type="button" class="modal-close" aria-label="Close gallery image">&times;</button>
  <button id="modalPrev" type="button" class="modal-arrow left" aria-label="Previous gallery image">&#10094;</button>
  <div class="modal-image-container">
    <img id="modalImg" src="" alt="" />
  </div>
  <button id="modalNext" type="button" class="modal-arrow right" aria-label="Next gallery image">&#10095;</button>
</div>
