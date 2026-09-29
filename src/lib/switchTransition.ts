/** Matches the blanket transition's duration in styles/base.css. */
const SWITCH_MS = 400;

let clearTimer = 0;

/** Applies a look change, easing every property; instant with reduced motion. */
export function switchWithTransition(apply: () => void): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    apply();
    return;
  }
  const root = document.documentElement;
  root.setAttribute("data-switching", "");
  apply();
  clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => root.removeAttribute("data-switching"), SWITCH_MS);
}
