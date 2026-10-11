export function installCodeCopy(): void {
  for (const code of document.querySelectorAll<HTMLElement>(
    ".markdown-content pre > code",
  )) {
    const pre = code.parentElement!;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    const toolbar = document.createElement("div");
    toolbar.className = "code-block-toolbar";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-button";
    const status = document.createElement("span");
    status.className = "code-copy-status";
    status.setAttribute("role", "status");
    const icons = {
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      success: '<path d="m5 12 4 4L19 6"/>',
      error: '<path d="m6 6 12 12M6 18 18 6"/>',
    };
    const showState = (state: keyof typeof icons) => {
      const label =
        state === "copy"
          ? "Copy code"
          : state === "success"
            ? "Copied!"
            : "Copy failed";
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[state]}</svg>`;
      button.setAttribute("aria-label", label);
      button.title =
        state === "error"
          ? "Copy failed. Select the code and copy it manually."
          : label;
      status.textContent = state === "copy" ? "" : label;
    };
    showState("copy");
    toolbar.append(button, status);
    pre.before(wrapper);
    wrapper.append(toolbar, pre);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const copy = async () => {
      clearTimeout(timer);
      button.disabled = true;
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");

        showState("success");
      } catch {
        showState("error");
      } finally {
        {
          button.disabled = false;
          timer = setTimeout(() => {
            showState("copy");
          }, 2500);
        }
      }
    };
    button.addEventListener("click", copy);
  }
}
