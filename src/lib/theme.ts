import { useEffect } from "preact/hooks";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Reads the resolved --bg rather than repeating the palette here, so the
// address-bar tint can't drift from the stylesheet. Runs after data-theme is
// on the root, so the computed value is already the new theme's.
export function updateThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (bg) meta.setAttribute("content", bg);
}

/** Keeps the address-bar tint on the system theme while auto follows it. */
export function useThemeColorWatch(): void {
  useEffect(() => {
    const query = matchMedia(DARK_QUERY);
    query.addEventListener("change", updateThemeColor);
    return () => query.removeEventListener("change", updateThemeColor);
  }, []);
}
