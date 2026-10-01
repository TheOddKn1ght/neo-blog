import { installGallery } from "./gallery";
import { installConfetti } from "./confetti";
import { installCodeCopy } from "./code-copy";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const themeButton = document.querySelector<HTMLButtonElement>("#theme-toggle-btn");
type Theme = "auto" | "light" | "dark";
const themes: Theme[] = ["auto", "light", "dark"];
const labels = {auto:"Auto",light:"Light",dark:"Dark"};
const icons = {
  auto:'<circle cx="12" cy="12" r="9"></circle><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"></path>',
  light:'<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>',
  dark:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>',
};
let theme: Theme = document.documentElement.dataset.theme === "light" ? "light" : document.documentElement.dataset.theme === "dark" ? "dark" : "auto";
function renderTheme(): void {
  if (!themeButton) return;
  themeButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[theme]}</svg>`;
  themeButton.title = `Theme: ${labels[theme]}`;
  themeButton.setAttribute("aria-label", `${themeButton.title} (click to change)`);
}
renderTheme();
themeButton?.addEventListener("click", () => {
  theme = themes[(themes.indexOf(theme) + 1) % themes.length]!;
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
  try { if (theme === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", theme); } catch {}
  renderTheme();
});

const navButton = document.querySelector<HTMLButtonElement>("#toggle-nav");
const links = document.querySelector("#links");
function closeNav(): void {
  links?.classList.remove("nav-active");
  navButton?.setAttribute("aria-expanded", "false");
  navButton?.querySelector(".hamburger-icon")?.classList.remove("active");
}
navButton?.addEventListener("click", () => {
  const open = links?.classList.toggle("nav-active") ?? false;
  navButton.setAttribute("aria-expanded", String(open));
  navButton.querySelector(".hamburger-icon")?.classList.toggle("active", open);
});
links?.addEventListener("click", (event) => {if ((event.target as Element).closest("a")) closeNav();});
matchMedia("(min-width: 876px)").addEventListener("change", (event) => {if (event.matches) closeNav();});

const counter = document.querySelector("#visit-counter");
if (counter) {
  try {
    // A visit was previously counted on each home-page mount.
    const count = (Number.parseInt(localStorage.getItem("visitCount") ?? "", 10) || 0) + 1;
    localStorage.setItem("visitCount", String(count));
    if (count >= 2) counter.textContent = `\u00a0\u00a0\u00a0 You have wasted your time on this site ${count} times.`;
  } catch {}
}
const scrollTop = document.querySelector<HTMLButtonElement>("#scroll-top-btn");
if (scrollTop) {
  const update = () => scrollTop.classList.toggle("show", window.scrollY > 300);
  window.addEventListener("scroll", update, {passive:true});
  update();
  scrollTop.addEventListener("click", () => window.scrollTo({top:0,behavior:reducedMotion() ? "instant" : "smooth"}));
}
let rotated = false;
document.querySelector("#yo")?.addEventListener("click", () => {
  document.body.style.transition = reducedMotion() ? "0s" : "3s";
  document.body.style.transform = rotated ? "rotate(0deg)" : "rotate(360deg)";
  rotated = !rotated;
});
const form = document.querySelector<HTMLFormElement>("#ama-form");
const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
if (submitButton) submitButton.disabled = false;
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const textarea = form.querySelector<HTMLTextAreaElement>("#ama-message")!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const status = form.querySelector<HTMLElement>("#ama-status")!;
  const message = textarea.value.trim();
  if (!message || button.disabled) return;
  button.disabled = true; button.textContent = "Sending…"; status.textContent = "Sending...";
  try {
    const response = await fetch("/message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message})});
    if (response.ok) {textarea.value = ""; status.textContent = "Thanks! Your message was sent.";}
    else status.textContent = "Something went wrong :(";
  } catch {status.textContent = "Could not send your message :(";}
  finally {button.disabled = false; button.textContent = "Send";}
});
installConfetti();
installCodeCopy();
installGallery();
