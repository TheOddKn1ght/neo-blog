export function installEnlarge(): () => void {
  const modal = document.getElementById("modal") as HTMLElement | null;
  const modalImg = document.getElementById("modalImg") as HTMLImageElement | null;
  const closeBtn = document.getElementById("modalClose");
  const prevBtn = document.getElementById("modalPrev");
  const nextBtn = document.getElementById("modalNext");
  if (!modal || !modalImg) return () => {};

  const images = Array.from(document.querySelectorAll<HTMLImageElement>(".gallery img"));
  if (!images.length) return () => {};

  let suppressUrlWrite = false;

  const readPhotoParam = (): number | null => {
    const raw = new URL(location.href).searchParams.get("photo");
    if (raw === null || !/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    if (n < 1 || n > images.length) return null;
    return n - 1;
  };

  const writePhotoParam = (index: number) => {
    if (suppressUrlWrite) return;
    const url = new URL(location.href);
    url.searchParams.set("photo", String(index + 1));
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  };

  const clearPhotoParam = () => {
    if (suppressUrlWrite) return;
    const url = new URL(location.href);
    if (!url.searchParams.has("photo")) return;
    url.searchParams.delete("photo");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  };

  const isOpen = () => modal.style.display === "flex";

  const SLIDE = ["slide-out-left", "slide-out-right", "slide-in-left", "slide-in-right"];
  const clearSlide = () => modalImg.classList.remove(...SLIDE);
  let currentIndex = -1;

  const srcOf = (img: HTMLImageElement) => img.src || img.dataset.src || "";

  const show = (index: number, direction: "left" | "right" | null = null) => {
    if (index < 0) index = images.length - 1;
    if (index >= images.length) index = 0;
    writePhotoParam(index);
    if (!direction) {
      modalImg.src = srcOf(images[index]);
      clearSlide();
      currentIndex = index;
      return;
    }
    const left = direction === "left";
    clearSlide();
    modalImg.classList.add(left ? "slide-out-left" : "slide-out-right");
    setTimeout(() => {
      modalImg.src = srcOf(images[index]);
      modalImg.classList.remove("slide-out-left", "slide-out-right");
      modalImg.classList.add(left ? "slide-in-left" : "slide-in-right");
      currentIndex = index;
    }, 250);
    setTimeout(() => modalImg.classList.remove("slide-in-left", "slide-in-right"), 550);
  };

  const open = (index: number) => {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    show(index);
  };

  const close = () => {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    clearSlide();
    clearPhotoParam();
  };

  const handlers: Array<() => void> = [];
  images.forEach((img, i) => {
    const fn = () => open(i);
    img.addEventListener("click", fn);
    handlers.push(() => img.removeEventListener("click", fn));
  });

  const onClose = () => close();
  const onPrev = () => show(currentIndex - 1, "right");
  const onNext = () => show(currentIndex + 1, "left");
  closeBtn?.addEventListener("click", onClose);
  prevBtn?.addEventListener("click", onPrev);
  nextBtn?.addEventListener("click", onNext);

  const onModalClick = (e: MouseEvent) => {
    const t = e.target as Element;
    if (t === modalImg) return;
    if (t.classList.contains("modal-image-container")) {
      close();
      return;
    }
    if (t.closest(".modal-arrow") || t.closest(".modal-close")) return;
    close();
  };
  modal.addEventListener("click", onModalClick);

  const onKey = (e: KeyboardEvent) => {
    if (modal.style.display !== "flex") return;
    const k = e.key.toLowerCase();
    if (e.key === "ArrowRight" || k === "l") show(currentIndex + 1, "left");
    else if (e.key === "ArrowLeft" || k === "h") show(currentIndex - 1, "right");
    else if (e.key === "Escape") close();
  };
  window.addEventListener("keydown", onKey);

  let startX = 0;
  const onTouchStart = (e: TouchEvent) => (startX = e.touches[0].clientX);
  const onTouchEnd = (e: TouchEvent) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) <= 50) return;
    show(currentIndex + (diff > 0 ? -1 : 1), diff > 0 ? "right" : "left");
  };
  modalImg.addEventListener("touchstart", onTouchStart, { passive: true });
  modalImg.addEventListener("touchend", onTouchEnd);

  const onPop = () => {
    const idx = readPhotoParam();
    suppressUrlWrite = true;
    try {
      if (idx !== null) {
        if (!isOpen()) open(idx);
        else show(idx);
      } else if (isOpen()) {
        close();
      }
    } finally {
      suppressUrlWrite = false;
    }
  };
  window.addEventListener("popstate", onPop);

  const initial = readPhotoParam();
  if (initial !== null) open(initial);

  return () => {
    for (const h of handlers) h();
    closeBtn?.removeEventListener("click", onClose);
    prevBtn?.removeEventListener("click", onPrev);
    nextBtn?.removeEventListener("click", onNext);
    modal.removeEventListener("click", onModalClick);
    window.removeEventListener("keydown", onKey);
    modalImg.removeEventListener("touchstart", onTouchStart);
    modalImg.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("popstate", onPop);
    document.body.classList.remove("modal-open");
  };
}
