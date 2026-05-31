<script>
  import { onMount } from "svelte";
  import { setMeta } from "../router";

  onMount(() => setMeta("404 - Page not found"));
</script>

<h1>404</h1>
<p>Page not found</p>
