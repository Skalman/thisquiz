import { useRef } from "preact/hooks";

/** The shortest gap between two presses that both count. */
const MIN_GAP_MS = 600;

/** Takes a press, unless too soon after the last it took. */
export function usePressGuard(): () => boolean {
  const lastRef = useRef(-Infinity);
  return () => {
    const now = performance.now();
    if (now - lastRef.current < MIN_GAP_MS) return false;
    lastRef.current = now;
    return true;
  };
}
