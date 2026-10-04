import { createContext } from "preact";
import { useContext, useRef } from "preact/hooks";
import { useLocation } from "preact-iso";
import type { Design } from "../lib/design.ts";
import { designForPath } from "../lib/design.ts";
import { switchWithTransition } from "../lib/switchTransition.ts";

/** The app's design, provided at the root. */
export const DesignContext = createContext<Design>("play");

export function useDesign(): Design {
  return useContext(DesignContext);
}

/**
 * The current section's design. A move into a section with the other look eases
 * across: the switch is armed during the render, so the new classes land
 * already transitioning.
 */
export function useSectionDesign(): Design {
  const { path } = useLocation();
  const design = designForPath(path);
  const shown = useRef(design);
  if (shown.current !== design) {
    shown.current = design;
    switchWithTransition(() => {});
  }
  return design;
}
