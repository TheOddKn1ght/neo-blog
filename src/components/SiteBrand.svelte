<script lang="ts">
  import { onDestroy } from "svelte";

  type Particle = {
    id: number;
    left: number;
    size: number;
    color: string;
    round: boolean;
    x: number;
    rotation: number;
    duration: number;
  };

  const COLORS = ["#ff5733", "#ffeb3b", "#00bcd4", "#4caf50", "#9c27b0", "#ff9800", "#81a1c1", "#b48ead"];
  const EMOJIS = [
    "🎉","🎊","🥳","✨","🎈","🎁","🪅","🌟","💫","🎆","🎇","🍾","🥂","🎀","🎂","🧁","🍰","🍩","🍪","🍫",
    "🍬","🍭","🍮","🍯","🍿","🍦","🍨","🍧","🍓","🍇","🍉","🍑","🍒","🍍","🥭","🥥","🥝","🍋","🍊","🍎",
    "🥑","🌽","🌶","🥕","🍔","🍕","🌮","🌯","🍣","🍜","🍱","🍙","🥟","🍤","🥐","🥨","🧀","🥞","🧇","🍞",
    "🐶","🐱","🦊","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🦆","🦉","🦇","🐺","🦄","🐴","🐝",
    "🦋","🐞","🐢","🐙","🦑","🦐","🦀","🐬","🐳","🦈","🐠","🦓","🦒","🐘","🦛","🦏","🦘","🦥","🦦","🦔",
    "🌸","🌺","🌻","🌷","🌹","🌼","🌱","🌿","🍀","🍁","🍂","🌳","🌴","🌵","🍄","🌍","🌎","🌏","🌙","☀️",
    "⭐","⚡","🔥","💧","🌈","❄️","☃️","⛄","🌊","☁️","🌪","🌋","🏔","🗻","🏝","🏖","🌅","🌄","🎑","🌌",
    "❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💖","💝","💘","💕","💞","💟","💌","💎","💍","👑","🎩",
    "🎵","🎶","🎸","🎹","🎺","🎷","🥁","🎻","🎤","🎧","🎬","🎨","🎭","🎯","🎲","🧩","🪀","🪁","🎮","🕹",
    "🚀","🛸","🌠","🪐","🛹","🛼","🚲","⚽","🏀","🏈","🎾","🏐","🏆","🥇","🥈","🥉","📚","✏️","💡","🔮",
    "🧸","🗿","🎃","👻","🤖","👾","🦖","🦕","🐉","🧙","🧚","🧜","🧞","🦸","🪄","🪴","🪷","🪸","🪼","🪿",
  ];

  let emoji: string | null = $state(null);
  let particles: Particle[] = $state([]);
  let nextParticleId = 0;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers(): void {
    if (hoverTimer) clearTimeout(hoverTimer);
    if (hideTimer) clearTimeout(hideTimer);
    hoverTimer = undefined;
    hideTimer = undefined;
  }

  function showEmojiSoon(): void {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = undefined;
    if (emoji || hoverTimer) return;
    hoverTimer = setTimeout(() => {
      emoji = EMOJIS[(Math.random() * EMOJIS.length) | 0];
      hoverTimer = undefined;
    }, 1500);
  }

  function hideEmojiSoon(): void {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = undefined;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      emoji = null;
      hideTimer = undefined;
    }, 150);
  }

  function burst(): void {
    particles = Array.from({ length: 500 }, () => {
      const angle = (Math.random() - 0.5) * 60;
      const velocity = 100 + Math.random() * 200;
      return {
        id: nextParticleId++,
        left: Math.random() * 100,
        size: Math.random() * 8 + 6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        round: Math.random() > 0.5,
        x: Math.sin((angle * Math.PI) / 180) * velocity,
        rotation: (Math.random() - 0.5) * 1440,
        duration: 2000 + Math.random() * 1500,
      };
    });
  }

  function removeParticle(id: number): void {
    particles = particles.filter((particle) => particle.id !== id);
  }

  function onBrandClick(event: MouseEvent): void {
    if (event.target instanceof HTMLImageElement) {
      event.preventDefault();
      burst();
    }
  }

  function onEmojiClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    burst();
  }

  onDestroy(() => {
    clearTimers();
    particles = [];
  });
</script>

<div class="nav-left">
  <ul>
    <li>
      <a href="/" onmouseenter={showEmojiSoon} onmouseleave={hideEmojiSoon} onclick={onBrandClick}>
        <img class="logo" src="/img/logo.webp" alt="OddKnight's Space logo" width="40" height="40" />
        <span class="sitename">OddKnight's Space</span>
      </a>
      {#if emoji}
        <button
          type="button"
          class="confetti-emoji"
          aria-label="Launch confetti"
          onmouseenter={showEmojiSoon}
          onmouseleave={hideEmojiSoon}
          onclick={onEmojiClick}
        >{emoji}</button>
      {/if}
    </li>
  </ul>
</div>

{#each particles as particle (particle.id)}
  <div
    class="confetti-piece"
    style:--left={`${particle.left}%`}
    style:--size={`${particle.size}px`}
    style:--color={particle.color}
    style:--radius={particle.round ? "50%" : "0"}
    style:--x={`${particle.x}px`}
    style:--rotation={`${particle.rotation}deg`}
    style:--duration={`${particle.duration}ms`}
    onanimationend={() => removeParticle(particle.id)}
  ></div>
{/each}
