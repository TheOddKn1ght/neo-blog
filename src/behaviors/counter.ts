export function installCounter(): () => void {
  const el = document.getElementById("visitCountDisplay");
  if (!el) return () => {};
  const count = (parseInt(localStorage.getItem("visitCount") ?? "", 10) || 0) + 1;
  localStorage.setItem("visitCount", String(count));
  if (count >= 2) {
    el.insertAdjacentHTML(
      "beforeend",
      ` &nbsp;&nbsp;&nbsp; You have wasted your time on this site ${count} times.`,
    );
  }
  return () => {};
}
