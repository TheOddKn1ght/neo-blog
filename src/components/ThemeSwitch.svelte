<script lang="ts">
  import { onMount } from "svelte";

  type Theme = "auto" | "light" | "dark";

  const STORAGE_KEY = "theme";
  const ORDER: Theme[] = ["auto", "light", "dark"];
  const LABEL: Record<Theme, string> = { auto: "Auto", light: "Light", dark: "Dark" };

  let theme: Theme = $state("auto");

  function apply(next: Theme): void {
    const root = document.documentElement;
    if (next === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  function cycle(): void {
    const i = ORDER.indexOf(theme);
    const next = ORDER[(i + 1) % ORDER.length];
    theme = next;
    apply(next);
    try {
      if (next === "auto") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  onMount(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {}
    theme = stored === "light" || stored === "dark" ? stored : "auto";
  });
</script>

<button
  id="theme-toggle-btn"
  type="button"
  aria-label="Theme: {LABEL[theme]} (click to change)"
  title="Theme: {LABEL[theme]}"
  onclick={cycle}
>
  {#if theme === "light"}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
    </svg>
  {:else if theme === "dark"}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"></path>
    </svg>
  {/if}
</button>
