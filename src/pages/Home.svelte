<script>
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import { installCounter } from "../behaviors/counter";
  import { installLogoConfetti } from "../behaviors/logoConfetti";

  let posts = $state([]);
  let status = $state("");

  onMount(() => {
    setMeta(
      "OddKnight's Space",
      "OddKnight's personal webpage. Thanks for stopping by!",
    );

    fetch("/content/index.json")
      .then((r) => r.json())
      .then((data) => {
        posts = (data.posts ?? []).slice(0, 5);
      })
      .catch(() => {});

    const teardownCounter = installCounter();
    const teardownConfetti = installLogoConfetti();
    return () => {
      teardownCounter?.();
      teardownConfetti?.();
    };
  });

  async function onSubmit(e) {
    e.preventDefault();
    const ta = e.currentTarget.querySelector("#ama-message");
    const message = ta.value.trim();
    if (!message) return;
    status = "Sending...";
    try {
      const r = await fetch("/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (r.ok) {
        ta.value = "";
        status = "Thanks! Your message was sent.";
      } else {
        status = "Something went wrong :(";
      }
    } catch {
      status = "Could not send your message :(";
    }
  }
</script>

<div class="moving-text-container">
  <div class="moving-text-wrapper">
    <div class="moving-text" id="visitCountDisplay">Oh hi!! (⁠ﾉ⁠◕⁠ヮ⁠◕⁠)⁠ﾉ⁠*⁠.⁠✧ ⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩</div>
  </div>
</div>
<h2 class="changing-text">And welcome</h2>
<p>This website is the result of my long-held desire to have my own online presence. Don't expect much here!</p>
<p>I mean, seriously. You're definitely gonna waste your time on this website.</p>
<h2>Recent posts</h2>
<ul style="list-style: none;">
  {#each posts as p}
    <li><a href="/blog/{p.slug}">{p.title}</a></li>
  {/each}
</ul>
<h2>Funny things</h2>
<ul style="list-style: none;">
  <li><a href="https://timer.oddknight.space">Shitty pomodoro timer</a></li>
  <li><a href="https://color.oddknight.space">Shitty color picker</a></li>
  <li><a href="https://typefr.oddknight.space">Shitty opinionated french typing tool</a></li>
  <li><a href="https://wake.oddknight.space">Shitty no sleep page</a></li>
</ul>

<div class="ama-card">
  <h2 class="ama-title">Ask me anything</h2>
  <p class="ama-subtitle">Got a question, idea, or just want to say hi? Drop it below and include your contact info if you'd like a reply</p>
  <form id="ama-form" class="ama-form" onsubmit={onSubmit}>
    <label for="ama-message" class="ama-label">Your message</label>
    <textarea id="ama-message" name="message" rows="4" required class="ama-textarea"></textarea>
    <button type="submit" class="ama-button">Send</button>
    <p id="ama-status" class="ama-status" aria-live="polite">{status}</p>
  </form>
</div>
