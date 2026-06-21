<script lang="ts">
  import { onMount } from "svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let linksOpen: boolean = $state(false);
  let linksEl: HTMLUListElement | undefined = $state();
  let iconEl: HTMLDivElement | undefined = $state();

  function toggle(): void {
    linksOpen = !linksOpen;
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
    <ul id="links" class:nav-active={linksOpen} bind:this={linksEl}
        onclick={(e) => { if ((e.target as HTMLElement).closest('a')) linksOpen = false; }}>
      <li><a href="/contact">contact</a></li>
      <li><a href="https://github.com/TheOddKn1ght">github</a></li>
      <li><a href="https://myanimelist.net/profile/TheOddKnight">myanimelist</a></li>
      <li><a href="/gallery">gallery</a></li>
      <li><a href="https://x.com/oddtheknight">twitter</a></li>
      <li><a href="/blog">posts</a></li>
    </ul>
  </div>
</nav>
