<script>
  import { onMount, tick } from "svelte";
  import { setMeta } from "../router";
  import ScrollTop from "../components/ScrollTop.svelte";
  import { installLazyLoad } from "../behaviors/lazyLoad";
  import { installEnlarge } from "../behaviors/enlarge";

  let images = $state([]);
  let modalImg;
  let modal;
  let teardownLazy;
  let teardownEnlarge;

  onMount(async () => {
    setMeta("Gallery", "OddKnight's silly ugly photos");
    try {
      const r = await fetch("/content/index.json");
      const data = await r.json();
      images = data.gallery ?? [];
    } catch {}
    await tick();
    teardownLazy = installLazyLoad();
    teardownEnlarge = installEnlarge();
    return () => {
      teardownLazy?.();
      teardownEnlarge?.();
    };
  });
</script>

<ScrollTop />
<h1 class="title">Gallery</h1>

<div class="gallery">
  {#each images as src}
    <img class="lazy-load" data-src={src} alt="" loading="lazy" decoding="async" />
  {/each}
</div>
<div id="modal" class="modal" aria-hidden="true">
  <span id="modalClose" class="modal-close" role="button" aria-label="Close">&times;</span>
  <span id="modalPrev" class="modal-arrow left" role="button" aria-label="Previous">&#10094;</span>
  <div class="modal-image-container">
    <img id="modalImg" src="" alt="" />
  </div>
  <span id="modalNext" class="modal-arrow right" role="button" aria-label="Next">&#10095;</span>
</div>
