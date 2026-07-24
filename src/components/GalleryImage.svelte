<script lang="ts">
  import type { GalleryItem } from "../types";

  let {
    item,
    element = $bindable(),
  }: {
    item: GalleryItem;
    element: HTMLImageElement | undefined;
  } = $props();

  let loaded: boolean = $state(false);
</script>

<img
  bind:this={element}
  class:loaded
  src={item.src}
  alt={item.alt}
  loading="lazy"
  decoding="async"
  onload={() => (loaded = true)}
  onerror={() => (loaded = true)}
/>
