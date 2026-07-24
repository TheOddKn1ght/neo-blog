<script lang="ts">
  import { onMount } from "svelte";
  import SiteBrand from "./SiteBrand.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let linksOpen: boolean = $state(false);

  function toggle(): void {
    linksOpen = !linksOpen;
  }

  function closeLinks(): void {
    linksOpen = false;
  }

  onMount(() => {
    const mq = window.matchMedia("(min-width: 876px)");
    const onChange = (e: MediaQueryListEvent): void => {
      if (e.matches) linksOpen = false;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
</script>

<nav class="menu">
  <SiteBrand />
  <div class="nav-right">
    <ul>
      <li class="icons">
        <button id="toggle-nav" type="button" aria-label="Toggle navigation" aria-expanded={linksOpen} aria-controls="links" onclick={toggle}>
          <div class="hamburger-icon" class:active={linksOpen}>
            <span></span><span></span><span></span>
          </div>
        </button>
      </li>
      <li class="icons theme-icon"><ThemeSwitch /></li>
    </ul>
    <ul id="links" class:nav-active={linksOpen}>
      <li><a href="/contact" onclick={closeLinks}>contact</a></li>
      <li><a href="https://github.com/TheOddKn1ght" onclick={closeLinks}>github</a></li>
      <li><a href="https://myanimelist.net/profile/TheOddKnight" onclick={closeLinks}>myanimelist</a></li>
      <li><a href="/gallery" onclick={closeLinks}>gallery</a></li>
      <li><a href="https://x.com/oddtheknight" onclick={closeLinks}>twitter</a></li>
      <li><a href="/blog" onclick={closeLinks}>posts</a></li>
    </ul>
  </div>
</nav>
