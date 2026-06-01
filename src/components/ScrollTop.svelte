<script lang="ts">
  import { onMount } from "svelte";

  const THRESHOLD = 300;
  let visible: boolean = $state(false);

  onMount(() => {
    const onScroll = (): void => {
      visible = window.scrollY > THRESHOLD;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  });

  function toTop(): void {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<button id="scroll-top-btn" class:show={visible} aria-label="Scroll to top" onclick={toTop}>↑</button>
