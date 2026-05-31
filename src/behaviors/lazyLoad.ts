export function installLazyLoad(): () => void {
  const images = document.querySelectorAll<HTMLImageElement>("img.lazy-load");
  if (!images.length) return () => {};

  const load = (img: HTMLImageElement) => {
    if (img.dataset.src) img.src = img.dataset.src;
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    const done = () => img.classList.add("loaded");
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  };

  if (!("IntersectionObserver" in window)) {
    images.forEach(load);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        load(entry.target as HTMLImageElement);
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: "200px 0px", threshold: 0.01 },
  );

  images.forEach((img) => observer.observe(img));
  return () => observer.disconnect();
}
