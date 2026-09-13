  <script lang="ts">
  import { onMount } from "svelte";
  import { setMeta } from "../router";
  import VisitCounter from "../components/VisitCounter.svelte";
  import { isPostIndex, type PostMeta } from "../types";

  let posts: PostMeta[] = $state([]);
  let loading: boolean = $state(true);
  let loadError: string = $state("");
  let status: string = $state("");
  let sending: boolean = $state(false);
  let controller: AbortController | undefined;

  async function loadPosts(): Promise<void> {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading = true;
    loadError = "";
    try {
      const response = await fetch("/content/posts.json", { signal: request.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isPostIndex(data)) throw new Error("Invalid post index");
      posts = data.slice(0, 5);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      posts = [];
      loadError = "Couldn’t load recent posts.";
    } finally {
      if (!request.signal.aborted) loading = false;
    }
  }

  onMount(() => {
    setMeta({
      title: "OddKnight's Space",
      description: "OddKnight's personal webpage. Thanks for stopping by!",
      path: "/",
    });
    void loadPosts();
    return () => {
      controller?.abort();
    };
  });

  async function onSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const ta = form.querySelector<HTMLTextAreaElement>("#ama-message");
    if (!ta) return;
    const message = ta.value.trim();
    if (!message || sending) return;
    sending = true;
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
    } finally {
      sending = false;
    }
  }
</script>

<div class="moving-text-container">
  <div class="moving-text-wrapper">
    <div class="moving-text">Oh hi!! (⁠ﾉ⁠◕⁠ヮ⁠◕⁠)⁠ﾉ⁠*⁠.⁠✧ ⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩⋆｡°✩<VisitCounter /></div>
  </div>
</div>
<h2 class="changing-text">And welcome</h2>
<p>This website is the result of my long-held desire to have my own online presence. Don't expect much here!</p>
<p>I mean, seriously. You're definitely gonna waste your time on this website.</p>
<h2>Recent posts</h2>
{#if loading}
  <p class="load-state" role="status">Loading recent posts…</p>
{:else if loadError}
  <div class="load-state error-state" role="alert">
    <p>{loadError}</p>
    <button type="button" class="retry-button" onclick={loadPosts}>Try again</button>
  </div>
{:else if posts.length === 0}
  <p class="load-state">No posts yet.</p>
{:else}
  <ul style="list-style: none;">
    {#each posts as p}
      <li><a href="/blog/{p.slug}">{p.title}</a></li>
    {/each}
  </ul>
{/if}
<h2>Funny things</h2>
<ul style="list-style: none;">
  <li><a href="https://timer.oddknight.space">Shitty pomodoro timer</a></li>
  <li><a href="https://color.oddknight.space">Shitty color picker</a></li>
  <li><a href="https://typefr.oddknight.space">Shitty opinionated french typing tool</a></li>
  <li><a href="https://wake.oddknight.space">Shitty no sleep page</a></li>
  <li><a href="/blog/switch-tab-ctrl-number">Shitty Firefox tab switcher (Ctrl+1..9 for Linux)</a></li>
</ul>

<div class="ama-card">
  <h2 class="ama-title">Ask me anything</h2>
  <p class="ama-subtitle">Got a question, idea, or just want to say hi? Drop it below and include your contact info if you'd like a reply</p>
  <form id="ama-form" class="ama-form" onsubmit={onSubmit}>
    <label for="ama-message" class="ama-label">Your message</label>
    <textarea id="ama-message" name="message" rows="4" maxlength="4000" required class="ama-textarea"></textarea>
    <button type="submit" class="ama-button" disabled={sending}>{sending ? "Sending…" : "Send"}</button>
    <p id="ama-status" class="ama-status" aria-live="polite">{status}</p>
  </form>
</div>
