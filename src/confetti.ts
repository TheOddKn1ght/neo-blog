export function installConfetti(): void {
  const brand = document.querySelector<HTMLAnchorElement>(".nav-left a");
  const emoji = document.querySelector<HTMLButtonElement>(".confetti-emoji");
  if (!brand || !emoji) return;
  const COLORS = [
    "#ff5733",
    "#ffeb3b",
    "#00bcd4",
    "#4caf50",
    "#9c27b0",
    "#ff9800",
    "#81a1c1",
    "#b48ead",
  ];
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

  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  let particles: HTMLElement[] = [];
  function showSoon(): void {
    clearTimeout(hideTimer);
    if (!emoji!.hidden || hoverTimer) return;
    hoverTimer = setTimeout(() => {
      emoji!.textContent = EMOJIS[(Math.random() * EMOJIS.length) | 0]!;
      emoji!.hidden = false;
      hoverTimer = undefined;
    }, 1500);
  }
  function hideSoon(): void {
    clearTimeout(hoverTimer);
    hoverTimer = undefined;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      emoji!.hidden = true;
    }, 150);
  }
  function burst(): void {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    clearTimeout(cleanupTimer);
    particles.forEach((p) => p.remove());
    particles = Array.from({ length: 500 }, () => {
      const angle = (Math.random() - 0.5) * 60,
        velocity = 100 + Math.random() * 200;
      const p = document.createElement("div");
      p.className = "confetti-piece";
      const values = {
        left: `${Math.random() * 100}%`,
        size: `${Math.random() * 8 + 6}px`,
        color: COLORS[(Math.random() * COLORS.length) | 0]!,
        radius: Math.random() > 0.5 ? "50%" : "0",
        x: `${Math.sin((angle * Math.PI) / 180) * velocity}px`,
        rotation: `${(Math.random() - 0.5) * 1440}deg`,
        duration: `${2000 + Math.random() * 1500}ms`,
      };
      for (const [key, value] of Object.entries(values))
        p.style.setProperty(`--${key}`, value);
      document.body.append(p);
      return p;
    });
    cleanupTimer = setTimeout(() => {
      particles.forEach((p) => p.remove());
      particles = [];
    }, 3600);
  }
  brand.addEventListener("mouseenter", showSoon);
  brand.addEventListener("mouseleave", hideSoon);
  brand.addEventListener("click", (event) => {
    if (event.target instanceof HTMLImageElement) {
      event.preventDefault();
      burst();
    }
  });
  emoji.addEventListener("mouseenter", showSoon);
  emoji.addEventListener("mouseleave", hideSoon);
  emoji.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    burst();
  });
}
