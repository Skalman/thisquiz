/**
 * The curved arrow from the tagline's note up to "This". Lengths are in px,
 * scaled by `size`, the name's font size; points are in the drawing box's
 * coordinates, y down.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The heading at the tip, in degrees counterclockwise from pointing right. */
const TIP_ANGLE = 120;
/** How far below the word the tip stops, in em. */
const TIP_GAP = 0.1;
/** The point aimed at, as a share of the word's box height from its top. */
const AIM_HEIGHT = 0.6;
/** How far back from the tip the line stays nearly straight, in em. */
const STRAIGHT_END = 0.3;
/** How deep the curve swings, as a share of the distance it spans. */
const REACH = 0.45;
const HEAD_LENGTH = 0.24;
/** Each wing's angle off the line, in radians. */
const HEAD_SPREAD = 0.55;

const heading: Point = {
  x: Math.cos((TIP_ANGLE * Math.PI) / 180),
  y: -Math.sin((TIP_ANGLE * Math.PI) / 180),
};

/**
 * Where the tip goes: just below `word`, on the line through the word's middle
 * along the tip heading, so the arrow reads as pointing at that middle.
 */
export function arrowTip(word: Box, size: number): Point {
  const aim = { x: word.left + word.width / 2, y: word.top + word.height * AIM_HEIGHT };
  const y = word.top + word.height + TIP_GAP * size;
  return { x: aim.x + ((y - aim.y) / heading.y) * heading.x, y };
}

/** How far right of the word's middle the tip lands, for placing the note to match. */
export function tipOffset(word: Box, size: number): number {
  return arrowTip(word, size).x - (word.left + word.width / 2);
}

const fmt = (v: number) => v.toFixed(1);

/**
 * The arrow's line and open head as SVG path data. The line is a cubic whose
 * control points both lie on the line back from the tip, so it straightens
 * into the head with no seam; the head then sits evenly about it.
 */
export function arrowPaths(start: Point, tip: Point, size: number): { line: string; head: string } {
  const run = STRAIGHT_END * size;
  const reach = REACH * Math.hypot(start.x - tip.x, start.y - tip.y);
  const near = { x: tip.x - run * heading.x, y: tip.y - run * heading.y };
  const far = { x: tip.x - (run + reach) * heading.x, y: tip.y - (run + reach) * heading.y };
  const line =
    `M${fmt(start.x)} ${fmt(start.y)} ` +
    `C${fmt(far.x)} ${fmt(far.y)} ${fmt(near.x)} ${fmt(near.y)} ${fmt(tip.x)} ${fmt(tip.y)}`;

  const length = HEAD_LENGTH * size;
  const wing = (turn: number): Point => {
    const back = { x: -heading.x, y: -heading.y };
    return {
      x: tip.x + length * (back.x * Math.cos(turn) - back.y * Math.sin(turn)),
      y: tip.y + length * (back.x * Math.sin(turn) + back.y * Math.cos(turn)),
    };
  };
  const a = wing(HEAD_SPREAD);
  const b = wing(-HEAD_SPREAD);
  const head = `M${fmt(a.x)} ${fmt(a.y)} L${fmt(tip.x)} ${fmt(tip.y)} L${fmt(b.x)} ${fmt(b.y)}`;
  return { line, head };
}
