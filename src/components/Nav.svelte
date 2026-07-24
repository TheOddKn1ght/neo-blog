<script lang="ts">
  import { onMount } from "svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let linksOpen: boolean = $state(false);
  let linksEl: HTMLUListElement | undefined = $state();
  let iconEl: HTMLDivElement | undefined = $state();

  function toggle(): void {
    linksOpen = !linksOpen;
  }

  function closeLinks(): void {
    linksOpen = false;
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
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
  <div class="nav-left">
    <ul>
      <li>
        <a href="/"
          ><img class="logo" src="/img/logo.webp" alt="logo" width="40" height="40" /><span class="sitename">OddKnight's Space</span></a>
      </li>
    </ul>
  </div>
  <div class="nav-right">
    <ul>
      <li class="icons">
        <a id="toggle-nav" aria-label="Toggle navigation" role="button" tabindex="0" onclick={toggle} onkeydown={onKey}>
          <div class="hamburger-icon" class:active={linksOpen} bind:this={iconEl}>
            <span></span><span></span><span></span>
          </div>
        </a>
      </li>
      <li class="icons theme-icon"><ThemeSwitch /></li>
    </ul>
    <ul id="links" class:nav-active={linksOpen} bind:this={linksEl}>
      <li><a href="/contact" onclick={closeLinks}>contact</a></li>
      <li><a href="https://github.com/TheOddKn1ght" onclick={closeLinks}>github</a></li>
      <li><a href="https://myanimelist.net/profile/TheOddKnight" onclick={closeLinks}>myanimelist</a></li>
      <li><a href="/gallery" onclick={closeLinks}>gallery</a></li>
      <li><a href="https://x.com/oddtheknight" onclick={closeLinks}>twitter</a></li>
      <li><a href="/blog" onclick={closeLinks}>posts</a></li>
    </ul>
  </div>
</nav>
