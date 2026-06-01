<script lang="ts">
  import { onMount } from "svelte";
  import { setMeta } from "../router";

  let rotated: boolean = $state(false);

  onMount(() => {
    setMeta("The yo™ page");
    return () => {
      document.body.style.transform = "";
      document.body.style.transition = "";
    };
  });

  function onYo(): void {
    document.body.style.transition = "3s";
    document.body.style.transform = rotated ? "rotate(0deg)" : "rotate(360deg)";
    rotated = !rotated;
  }
</script>

<h1 class="title" style="text-align: center;">The yo™ page</h1>

<div class="button-container" style="text-align: center;">
  <button id="yo" onclick={onYo}>yo</button>
</div>

<style>
  #yo {
    background-color: #000;
    color: #fff;
    border: none;
    padding: 15px 32px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    margin: 4px 2px;
    cursor: pointer;
    border-radius: 10px;
    transition: background-color 0.3s;
  }
  #yo:hover {
    background-color: #fff;
    color: #000;
  }
</style>
