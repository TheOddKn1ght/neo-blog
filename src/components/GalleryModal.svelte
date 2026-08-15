<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import type { GalleryItem } from "../types";

  let {
    items,
    index,
    modalImage = $bindable(),
    onNavigate,
    onClose,
  }: {
    items: GalleryItem[];
    index: number;
    modalImage: HTMLImageElement | undefined;
    onNavigate: (index: number) => void;
    onClose: () => void;
  } = $props();

  let visibleIndex: number = $state(untrack(() => index));
  let targetIndex: number = $state(untrack(() => index));
  let phase: "" | "slide-out-left" | "slide-out-right" | "slide-in-left" | "slide-in-right" = $state("");
  let closeButton: HTMLButtonElement | undefined = $state();
  let previousButton: HTMLButtonElement | undefined = $state();
  let nextButton: HTMLButtonElement | undefined = $state();
  let startX = 0;
  let swapTimer: ReturnType<typeof setTimeout> | undefined;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers(): void {
    if (swapTimer) clearTimeout(swapTimer);
    if (finishTimer) clearTimeout(finishTimer);
    swapTimer = undefined;
    finishTimer = undefined;
  }

  function wrap(candidate: number): number {
    if (candidate < 0) return items.length - 1;
    if (candidate >= items.length) return 0;
    return candidate;
  }

  function preloadAround(currentIndex: number): void {
    for (const nearby of [wrap(currentIndex - 1), wrap(currentIndex + 1)]) {
      const image = new Image();
      image.src = items[nearby].src;
    }
  }

  function navigate(direction: "left" | "right"): void {
    clearTimers();
    targetIndex = wrap(targetIndex + (direction === "left" ? 1 : -1));
    phase = direction === "left" ? "slide-out-left" : "slide-out-right";
    swapTimer = setTimeout(() => {
      visibleIndex = targetIndex;
      onNavigate(targetIndex);
      preloadAround(targetIndex);
      phase = direction === "left" ? "slide-in-left" : "slide-in-right";
      swapTimer = undefined;
      finishTimer = setTimeout(() => {
        phase = "";
        finishTimer = undefined;
      }, 500);
    }, 250);
  }

  function focusableControls(): HTMLButtonElement[] {
    return [closeButton, previousButton, nextButton].filter(
      (control): control is HTMLButtonElement => control !== undefined && control.offsetParent !== null,
    );
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Tab") {
      const controls = focusableControls();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !controls.includes(active as HTMLButtonElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !controls.includes(active as HTMLButtonElement))) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    const key = event.key.toLowerCase();
    if (event.key === "ArrowRight" || key === "l") {
      event.preventDefault();
      navigate("left");
    } else if (event.key === "ArrowLeft" || key === "h") {
      event.preventDefault();
      navigate("right");
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function onTouchStart(event: TouchEvent): void {
    startX = event.touches[0]?.clientX ?? 0;
  }

  function onTouchEnd(event: TouchEvent): void {
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const difference = endX - startX;
    if (Math.abs(difference) <= 50) return;
    navigate(difference > 0 ? "right" : "left");
  }

  function onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onClose();
  }

  $effect(() => {
    const externalIndex = index;
    untrack(() => {
      if (externalIndex === targetIndex) return;
      clearTimers();
      targetIndex = externalIndex;
      visibleIndex = externalIndex;
      phase = "";
    });
  });

  onMount(() => {
    document.body.classList.add("modal-open");
    preloadAround(visibleIndex);
    closeButton?.focus({ preventScroll: true });
  });

  onDestroy(() => {
    clearTimers();
    document.body.classList.remove("modal-open");
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="modal" role="dialog" aria-modal="true" aria-label="Gallery image viewer">
  <button bind:this={closeButton} type="button" class="modal-close" aria-label="Close gallery image" onclick={onClose}>&times;</button>
  <button bind:this={previousButton} type="button" class="modal-arrow left" aria-label="Previous gallery image" onclick={() => navigate("right")}>&#10094;</button>
  <button type="button" tabindex="-1" class="modal-image-container" aria-label="Close gallery from backdrop" onclick={onBackdropClick}>
    <img
      bind:this={modalImage}
      id="modalImg"
      class={phase}
      src={items[visibleIndex].src}
      alt={items[visibleIndex].alt}
      decoding="async"
      ontouchstart={onTouchStart}
      ontouchend={onTouchEnd}
    />
  </button>
  <button bind:this={nextButton} type="button" class="modal-arrow right" aria-label="Next gallery image" onclick={() => navigate("left")}>&#10095;</button>
</div>
