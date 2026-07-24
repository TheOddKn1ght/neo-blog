<script lang="ts">
  import { onMount } from "svelte";

  let count: number = $state(0);

  onMount(() => {
    try {
      count = (Number.parseInt(localStorage.getItem("visitCount") ?? "", 10) || 0) + 1;
      localStorage.setItem("visitCount", String(count));
    } catch {
      count = 0;
    }
  });
</script>

{#if count >= 2}
  &nbsp;&nbsp;&nbsp; You have wasted your time on this site {count} times.
{/if}
