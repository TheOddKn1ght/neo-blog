export function installEnlarge(): () => void {
  const modal = document.getElementById("modal") as HTMLElement | null;
  const modalImg = document.getElementById("modalImg") as HTMLImageElement | null;
  const closeBtn = document.getElementById("modalClose");
  const prevBtn = document.getElementById("modalPrev");
  const nextBtn = document.getElementById("modalNext");
  if (!modal || !modalImg) return () => {};

  const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>(".gallery-item"));
  const images = triggers
    .map((trigger) => trigger.querySelector<HTMLImageElement>("img"))
    .filter((img): img is HTMLImageElement => img !== null);
  if (!images.length) return () => {};

  let suppressUrlWrite = false;
  let activeTrigger: HTMLButtonElement | null = null;

  type StartViewTransition = (cb: () => void) => { finished: Promise<void> };
  const supportsVT = () =>
    typeof (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition === "function";
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canMorph = () => supportsVT() && !prefersReducedMotion();

  const withMorph = (source: Element | null, target: Element | null, mutate: () => void) => {
    if (!canMorph() || !source) {
      mutate();
      return;
    }
    document.body.classList.add("vt-active");
    source.classList.add("vt-morph");
    const doc = document as unknown as { startViewTransition: StartViewTransition };
    const transition = doc.startViewTransition(() => {
      source.classList.remove("vt-morph");
      mutate();
      target?.classList.add("vt-morph");
    });
    transition.finished.finally(() => {
      target?.classList.remove("vt-morph");
      document.body.classList.remove("vt-active");
    });
  };

  const filenameNumber = (img: HTMLImageElement): number | null => {
    const src = img.src || img.dataset.src || "";
    const m = /\/gallery\/(\d+)\./.exec(src);
    return m ? Number(m[1]) : null;
  };

  const indexByPhotoNumber = new Map<number, number>();
  images.forEach((img, i) => {
    const n = filenameNumber(img);
    if (n !== null) indexByPhotoNumber.set(n, i);
  });

  const readPhotoParam = (): number | null => {
    const raw = new URL(location.href).searchParams.get("photo");
    if (raw === null || !/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return indexByPhotoNumber.get(n) ?? null;
  };

  const writePhotoParam = (index: number) => {
    if (suppressUrlWrite) return;
    const url = new URL(location.href);
    const n = filenameNumber(images[index]);
    if (n === null) url.searchParams.delete("photo");
    else url.searchParams.set("photo", String(n));
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

  const setHiddenThumb = (newIndex: number) => {
    if (currentIndex >= 0 && currentIndex !== newIndex) {
      images[currentIndex]?.classList.remove("vt-hidden");
    }
    images[newIndex]?.classList.add("vt-hidden");
  };
  const clearHiddenThumb = () => {
    if (currentIndex >= 0) images[currentIndex]?.classList.remove("vt-hidden");
  };

  const srcOf = (img: HTMLImageElement) => img.src || img.dataset.src || "";

  const show = (index: number, direction: "left" | "right" | null = null) => {
    if (index < 0) index = images.length - 1;
    if (index >= images.length) index = 0;
    writePhotoParam(index);
    if (!direction) {
      modalImg.src = srcOf(images[index]);
      modalImg.alt = `Gallery image ${index + 1} of ${images.length}`;
      clearSlide();
      setHiddenThumb(index);
      currentIndex = index;
      return;
    }
    const left = direction === "left";
    clearSlide();
    modalImg.classList.add(left ? "slide-out-left" : "slide-out-right");
    setTimeout(() => {
      modalImg.src = srcOf(images[index]);
      modalImg.alt = `Gallery image ${index + 1} of ${images.length}`;
      modalImg.classList.remove("slide-out-left", "slide-out-right");
      modalImg.classList.add(left ? "slide-in-left" : "slide-in-right");
      setHiddenThumb(index);
      currentIndex = index;
    }, 250);
    setTimeout(() => modalImg.classList.remove("slide-in-left", "slide-in-right"), 550);
  };

  const open = (index: number, source?: HTMLImageElement) => {
    activeTrigger = triggers[index] ?? null;
    const doOpen = () => {
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      show(index);
      closeBtn?.focus({ preventScroll: true });
    };
    if (source && canMorph()) withMorph(source, modalImg, doOpen);
    else doOpen();
  };

  const close = () => {
    const target = images[currentIndex] ?? null;
    const doClose = () => {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      clearSlide();
      clearPhotoParam();
      clearHiddenThumb();
      activeTrigger?.focus({ preventScroll: true });
    };
    if (target && canMorph()) withMorph(modalImg, target, doClose);
    else doClose();
  };

  const handlers: Array<() => void> = [];
  triggers.forEach((trigger, i) => {
    const img = images[i];
    if (!img) return;
    const fn = () => open(i, img);
    trigger.addEventListener("click", fn);
    handlers.push(() => trigger.removeEventListener("click", fn));
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
    if (e.key === "Tab") {
      const controls = [closeBtn, prevBtn, nextBtn].filter(
        (control): control is HTMLElement => control instanceof HTMLElement && control.offsetParent !== null,
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (e.key === "ArrowRight" || k === "l") {
      e.preventDefault();
      show(currentIndex + 1, "left");
    } else if (e.key === "ArrowLeft" || k === "h") {
      e.preventDefault();
      show(currentIndex - 1, "right");
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
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
    clearHiddenThumb();
  };
}
