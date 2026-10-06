import { test } from "node:test";
import assert from "node:assert/strict";
import { arrowPaths, arrowTip, tipOffset } from "./noteArrow.ts";

const word = { left: 40, top: 10, width: 60, height: 36 };
const size = 32;

function numbers(path: string): number[] {
  return (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

test("the tip stops just below the word, on the line through its middle", () => {
  const tip = arrowTip(word, size);
  assert.ok(Math.abs(tip.y - (word.top + word.height + 0.1 * size)) < 1e-9);
  // Back along the heading from the tip, the line passes the word's middle.
  const aim = { x: word.left + word.width / 2, y: word.top + word.height * 0.6 };
  const dx = aim.x - tip.x;
  const dy = aim.y - tip.y;
  const heading = { x: Math.cos((2 * Math.PI) / 3), y: -Math.sin((2 * Math.PI) / 3) };
  assert.ok(Math.abs(dx * heading.y - dy * heading.x) < 1e-9);
  assert.ok(tipOffset(word, size) > 0);
});

test("the line runs from the start to the tip", () => {
  const start = { x: 160, y: 70 };
  const tip = arrowTip(word, size);
  const line = numbers(arrowPaths(start, tip, size).line);
  assert.deepEqual(line.slice(0, 2), [160, 70]);
  assert.deepEqual(line.slice(-2), [Number(tip.x.toFixed(1)), Number(tip.y.toFixed(1))]);
});

test("the head's wings are the same length and sit evenly about the line", () => {
  const tip = arrowTip(word, size);
  const [ax, ay, , , bx, by] = numbers(arrowPaths({ x: 160, y: 70 }, tip, size).head);
  const lengthA = Math.hypot(ax - tip.x, ay - tip.y);
  const lengthB = Math.hypot(bx - tip.x, by - tip.y);
  assert.ok(Math.abs(lengthA - lengthB) < 0.15);
  // The wings' midpoint lies straight back along the heading.
  const back = { x: -Math.cos((2 * Math.PI) / 3), y: Math.sin((2 * Math.PI) / 3) };
  const mid = { x: (ax + bx) / 2 - tip.x, y: (ay + by) / 2 - tip.y };
  assert.ok(Math.abs(mid.x * back.y - mid.y * back.x) < 0.15);
});
