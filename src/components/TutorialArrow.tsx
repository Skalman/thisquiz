import { useLayoutEffect, useEffect, useState } from "preact/hooks";
import type { ArrowSpec } from "../puzzles/tutorial.ts";
import { arcPath, within45 } from "../lib/arcPath.ts";
import { COACH_ARROW, COACH_ARROW_OUTLINE, COACH_SVG } from "./coachStyles.ts";

interface Props {
  arrow: ArrowSpec | null;
  /** A new key redraws the arrow from scratch. */
  arrowKey: string;
  gridRef: { current: HTMLDivElement | null };
  textRef: { current: HTMLDivElement | null };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Shortest a pointer line may be, so a close target (e.g. the top row, right
// under the text) isn't a stubby arc with an oversized head.
const MIN_POINTER = 40;
// The space between a pointer's tip and the validity bar it points at.
const BAR_GAP = 10;

/**
 * The tutorial's arrow, from its text down to what the step points at. Measures
 * the live board, so it tracks layout; the draw-on is motion-gated CSS.
 */
export function TutorialArrow({ arrow, arrowKey, gridRef, textRef }: Props) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [path, setPath] = useState<string | null>(null);
  // Bumped on resize. Only a dependency of the geometry effect — the count
  // itself means nothing.
  const [viewport, setViewport] = useState(0);

  useLayoutEffect(() => {
    setPath(arrowPath(svg, gridRef.current, textRef.current, arrow));
  }, [svg, arrow, gridRef, textRef, viewport]);

  // Only resize can reflow the board and change the arrow's geometry. Scroll
  // can't: the overlay and the rows share the puzzle view as their box, so
  // their relative (svg-local) positions are scroll-invariant.
  useEffect(() => {
    const onResize = () => setViewport((v) => v + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // `pathLength` normalizes the draw-on dash so it covers the whole curve
  // regardless of length. A wider under-stroke gives a crisp outline.
  return (
    <div class="pointer-events-none absolute inset-0 z-5" aria-hidden="true">
      <svg ref={setSvg} class={COACH_SVG}>
        {path && (
          <g key={arrowKey}>
            <path
              class={COACH_ARROW_OUTLINE}
              d={path}
              pathLength={100}
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              class={COACH_ARROW}
              d={path}
              pathLength={100}
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/** The arc from the text to the arrow's target, in svg-local px. */
function arrowPath(
  svg: SVGSVGElement | null,
  grid: HTMLDivElement | null,
  text: HTMLDivElement | null,
  arrow: ArrowSpec | null,
): string | null {
  if (!svg || !grid || !text || !arrow) return null;
  const origin = svg.getBoundingClientRect();
  const rel = (el: Element | null): Rect | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
  };

  const row = `[data-row="${arrow.qi}"]`;
  const found = rel(grid.querySelector(arrow.mode === "bar" ? `${row} [data-validity-bar]` : row));
  const textRect = rel(text);
  if (!found || !textRect) return null;
  // The tip stops short of the thin bar.
  const target = arrow.mode === "bar" ? { ...found, y: found.y - BAR_GAP } : found;

  const x2 = target.x + target.w / 2;
  const y2 = target.y;
  let y1 = textRect.y + textRect.h;
  // From the text's middle, slanting no more than 45°.
  let x1 = within45(textRect.x + textRect.w / 2, x2, Math.abs(y2 - y1));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len > 0 && len < MIN_POINTER) {
    // Pull the start back along the line so a close target still gets a full arrow.
    x1 = x2 - (dx / len) * MIN_POINTER;
    y1 = y2 - (dy / len) * MIN_POINTER;
  }
  return arcPath(x1, y1, x2, y2, true);
}
