<script lang="ts">
  import { onMount } from "svelte";
  import { setMeta } from "../router";

  onMount(() => {
    setMeta({
      title: "404 - Page not found",
      path: location.pathname,
      noIndex: true,
    });
  });
</script>

<h1>404</h1>
<p>Page not found</p>
