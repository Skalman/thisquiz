import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import type { Design } from "../lib/design.ts";
import { DESIGN_CHANGE, storedDesign } from "../lib/design.ts";

/** The app's design, provided at the root. */
export const DesignContext = createContext<Design>("zen");

export function useDesign(): Design {
  return useContext(DesignContext);
}

/** The stored design, kept in sync across tabs. */
export function useStoredDesign(): Design {
  const [design, setDesign] = useState(storedDesign);
  useEffect(() => {
    const sync = () => setDesign(storedDesign());
    window.addEventListener(DESIGN_CHANGE, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DESIGN_CHANGE, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return design;
}
