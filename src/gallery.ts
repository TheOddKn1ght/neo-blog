export function installGallery(): void {
  const triggers = [
    ...document.querySelectorAll<HTMLButtonElement>(".gallery-item"),
  ];
  if (!triggers.length) return;
  const thumbnails = triggers.map((button) =>
    button.querySelector<HTMLImageElement>("img")!,
  );
  thumbnails.forEach((image) => {
    const loaded = () => image.classList.add("loaded");
    image.addEventListener("load", loaded);
    image.addEventListener("error", loaded);
    if (image.complete && image.hasAttribute("src")) loaded();
  });
  const deferred = thumbnails.filter((image) =>
    image.hasAttribute("data-thumb"),
  );
  if (deferred.length > 0) {
    const reveal = (image: HTMLImageElement) => {
      image.src = image.dataset.thumb!;
      image.removeAttribute("data-thumb");
    };
    if ("IntersectionObserver" in window) {
      const watcher = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const image = entry.target as HTMLImageElement;
            watcher.unobserve(image);
            reveal(image);
          }
        },
        { rootMargin: "150px" },
      );
      deferred.forEach((image) => watcher.observe(image));
    } else {
      deferred.forEach(reveal);
    }
  }
  let index: number | null = null;
  let target = 0;
  let modal: HTMLDivElement | undefined;
  let image: HTMLImageElement | undefined;
  let activeTrigger: HTMLButtonElement | undefined;
  let swapTimer: ReturnType<typeof setTimeout> | undefined;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let morphing = false;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = (value: number) => (value + triggers.length) % triggers.length;
  const photo = (value: number) =>
    /\/gallery\/(\d+)\./.exec(triggers[value]!.dataset.src!)?.[1];
  function writeUrl(value: number | null): void {
    const url = new URL(location.href);
    const id = value === null ? undefined : photo(value);
    if (id === undefined) url.searchParams.delete("photo");
    else url.searchParams.set("photo", id);
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
  function preload(value: number): void {
    for (const nearby of [wrap(value - 1), wrap(value + 1)]) {
      const img = new Image();
      img.src = triggers[nearby]!.dataset.src!;
    }
  }
  function display(value: number): void {
    index = value;
    target = value;
    image!.src = triggers[value]!.dataset.src!;
    image!.alt = triggers[value]!.dataset.alt!;
    preload(value);
  }
  function clearTimers(): void {
    clearTimeout(swapTimer);
    clearTimeout(finishTimer);
  }
  type TransitionDocument = Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };
  async function morph(
    source: Element | undefined,
    destination: () => Element | undefined,
    update: () => void,
  ): Promise<void> {
    const start = (document as TransitionDocument).startViewTransition;
    if (!source || !start || reduced()) {
      update();
      return;
    }
    morphing = true;
    document.body.classList.add("vt-active");
    source.classList.add("vt-morph");
    const transition = start.call(document, () => {
      source.classList.remove("vt-morph");
      update();
      destination()?.classList.add("vt-morph");
    });
    try {
      await transition.finished;
    } catch {
      /* A browser can skip an interrupted transition. */
    } finally {
      source.classList.remove("vt-morph");
      destination()?.classList.remove("vt-morph");
      document.body.classList.remove("vt-active");
      morphing = false;
    }
  }
  function navigate(step: number): void {
    if (index === null || morphing) return;
    clearTimers();
    target = wrap(target + step);
    const next = target;
    if (reduced()) {
      display(next);
      writeUrl(next);
      image!.className = "";
      return;
    }
    image!.className = step === 1 ? "slide-out-left" : "slide-out-right";
    swapTimer = setTimeout(() => {
      display(next);
      writeUrl(next);
      image!.className = step === 1 ? "slide-in-left" : "slide-in-right";
      finishTimer = setTimeout(() => {
        if (image) image.className = "";
      }, 500);
    }, 250);
  }
  async function close(updateUrl = true): Promise<void> {
    if (index === null || morphing) return;
    const previous = index;
    clearTimers();
    if (updateUrl) writeUrl(null);
    await morph(
      image,
      () => thumbnails[previous],
      () => {
        modal?.remove();
        modal = undefined;
        image = undefined;
        index = null;
        document.body.classList.remove("modal-open");
      },
    );
    (activeTrigger ?? triggers[previous])?.focus({ preventScroll: true });
  }
  async function open(value: number, updateUrl = true): Promise<void> {
    if (morphing) return;
    if (index !== null) {
      clearTimers();
      display(value);
      image!.className = "";
      if (updateUrl) writeUrl(value);
      return;
    }
    activeTrigger = triggers[value];
    if (updateUrl) writeUrl(value);
    await morph(
      thumbnails[value],
      () => image,
      () => {
        modal = document.createElement("div");
        modal.className = "modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Gallery image viewer");
        modal.innerHTML =
          '<button type="button" class="modal-close" aria-label="Close gallery image">&times;</button><button type="button" class="modal-arrow left" aria-label="Previous gallery image">&#10094;</button><button type="button" tabindex="-1" class="modal-image-container" aria-label="Close gallery from backdrop"><img id="modalImg" decoding="async"></button><button type="button" class="modal-arrow right" aria-label="Next gallery image">&#10095;</button>';
        document.body.append(modal);
        document.body.classList.add("modal-open");
        image = modal.querySelector<HTMLImageElement>("img")!;
        display(value);
        modal
          .querySelector(".modal-close")!
          .addEventListener("click", () => void close());
        modal
          .querySelector(".left")!
          .addEventListener("click", () => navigate(-1));
        modal
          .querySelector(".right")!
          .addEventListener("click", () => navigate(1));
        const backdrop = modal.querySelector(".modal-image-container")!;
        backdrop.addEventListener("click", (event) => {
          if (event.target === backdrop) void close();
        });
        image.addEventListener(
          "touchstart",
          (event) => {
            startX = event.touches[0]?.clientX ?? 0;
          },
          { passive: true },
        );
        image.addEventListener(
          "touchend",
          (event) => {
            const difference =
              (event.changedTouches[0]?.clientX ?? startX) - startX;
            if (Math.abs(difference) > 50) navigate(difference > 0 ? -1 : 1);
          },
          { passive: true },
        );
        modal
          .querySelector<HTMLButtonElement>(".modal-close")!
          .focus({ preventScroll: true });
      },
    );
  }
  window.addEventListener("keydown", (event) => {
    if (!modal) return;
    if (event.key === "Tab") {
      const controls = [
        ...modal.querySelectorAll<HTMLButtonElement>(
          ".modal-close,.modal-arrow",
        ),
      ].filter((button) => button.offsetParent !== null);
      const first = controls[0]!,
        last = controls.at(-1)!;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !controls.includes(document.activeElement as HTMLButtonElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !controls.includes(document.activeElement as HTMLButtonElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      void close();
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
      event.preventDefault();
      navigate(1);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "h") {
      event.preventDefault();
      navigate(-1);
    }
  });
  triggers.forEach((button, value) =>
    button.addEventListener("click", () => void open(value)),
  );
  function syncUrl(): void {
    const raw = new URL(location.href).searchParams.get("photo");
    const selected =
      raw && /^\d+$/.test(raw)
        ? triggers.findIndex((_, i) => Number(photo(i)) === Number(raw))
        : -1;
    if (selected >= 0) void open(selected, false);
    else void close(false);
  }
  window.addEventListener("popstate", syncUrl);
  syncUrl();
}
