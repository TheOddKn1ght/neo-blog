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
const COUNT = 500;

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

function burst(): void {
  const frag = document.createDocumentFragment();
  const pieces: HTMLDivElement[] = [];
  for (let i = 0; i < COUNT; i++) {
    const c = document.createElement("div");
    const size = Math.random() * 8 + 6;
    c.style.cssText =
      `position:fixed;left:${Math.random() * 100}%;top:-10px;` +
      `width:${size}px;height:${size}px;` +
      `background:${COLORS[(Math.random() * COLORS.length) | 0]};` +
      `border-radius:${Math.random() > 0.5 ? "50%" : "0"};` +
      `pointer-events:none;z-index:10000;opacity:.9;`;
    frag.appendChild(c);
    pieces.push(c);
  }
  document.body.appendChild(frag);

  for (const c of pieces) {
    const angle = (Math.random() - 0.5) * 60;
    const velocity = 100 + Math.random() * 200;
    const x = Math.sin((angle * Math.PI) / 180) * velocity;
    const rot = (Math.random() - 0.5) * 1440;
    const anim = c.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${x}px, ${window.innerHeight + 100}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration: 2000 + Math.random() * 1500, easing: "cubic-bezier(0.5, 0, 0.5, 1)" },
    );
    anim.onfinish = () => c.remove();
  }
}

export function installLogoConfetti(): () => void {
  const logo = document.querySelector(".logo");
  const link = logo?.closest("a");
  if (!link) return () => {};

  let emoji: HTMLSpanElement | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  const showEmoji = () => {
    if (emoji) return;
    const sitename = document.querySelector(".sitename");
    if (!sitename?.parentNode) return;
    const el = document.createElement("span");
    el.textContent = EMOJIS[(Math.random() * EMOJIS.length) | 0];
    el.className = "confetti-emoji";
    el.style.cssText =
      "display:inline-block;font-size:20px;margin-left:5px;pointer-events:auto;cursor:pointer;transition:transform .2s ease,opacity .3s ease;user-select:none;vertical-align:middle;text-decoration:none;opacity:0;";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      burst();
    });
    el.addEventListener("mouseenter", () => (el.style.transform = "scale(1.2)"));
    el.addEventListener("mouseleave", () => (el.style.transform = "scale(1)"));
    sitename.parentNode.insertBefore(el, sitename.nextSibling);
    emoji = el;
    requestAnimationFrame(() => {
      if (emoji) emoji.style.opacity = "1";
    });
  };

  const hideEmoji = () => {
    if (!emoji?.parentNode) return;
    const e = emoji;
    e.style.opacity = "0";
    emoji = null;
    setTimeout(() => e.parentNode?.removeChild(e), 300);
  };

  const onEnter = () => {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      showEmoji();
      hoverTimer = null;
    }, 1500);
  };
  const onLeave = () => {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = null;
    hideEmoji();
  };
  const onClick = (e: Event) => {
    const t = e.target as Element;
    if (t.classList.contains("logo")) {
      burst();
      e.preventDefault();
    }
  };

  link.addEventListener("mouseenter", onEnter);
  link.addEventListener("mouseleave", onLeave);
  link.addEventListener("click", onClick);

  return () => {
    link.removeEventListener("mouseenter", onEnter);
    link.removeEventListener("mouseleave", onLeave);
    link.removeEventListener("click", onClick);
    if (hoverTimer) clearTimeout(hoverTimer);
    hideEmoji();
  };
}
