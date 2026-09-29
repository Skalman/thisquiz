/** The app's look: zen or play. */
export type Design = "zen" | "play";

export const DESIGNS: readonly Design[] = ["zen", "play"];

export function isDesign(value: unknown): value is Design {
  return DESIGNS.some((design) => design === value);
}

const DESIGN_KEY = "refpuzzle:design";

/** Fired on the window when this tab stores a new design. */
export const DESIGN_CHANGE = "refpuzzle:design-change";

/** The design the player picked on this device; zen until they pick. */
export function storedDesign(): Design {
  try {
    const value = localStorage.getItem(DESIGN_KEY);
    return isDesign(value) ? value : "zen";
  } catch {
    return "zen";
  }
}

export function storeDesign(design: Design): void {
  try {
    if (design === "zen") localStorage.removeItem(DESIGN_KEY);
    else localStorage.setItem(DESIGN_KEY, design);
  } catch {}
  window.dispatchEvent(new Event(DESIGN_CHANGE));
}
