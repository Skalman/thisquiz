import { test } from "node:test";
import assert from "node:assert/strict";
import { joinStreaks, streakAfterSolve } from "./streak.ts";

test("a first solve starts a streak of one", () => {
  assert.deepEqual(streakAfterSolve(null, "2026-10-04"), { last: "2026-10-04", length: 1 });
});

test("a solve the day after runs the streak on, across a month and a year", () => {
  assert.deepEqual(streakAfterSolve({ last: "2026-09-30", length: 4 }, "2026-10-01"), {
    last: "2026-10-01",
    length: 5,
  });
  assert.deepEqual(streakAfterSolve({ last: "2026-12-31", length: 2 }, "2027-01-01"), {
    last: "2027-01-01",
    length: 3,
  });
});

test("a second solve the same day changes nothing", () => {
  const streak = { last: "2026-10-04", length: 3 };
  assert.deepEqual(streakAfterSolve(streak, "2026-10-04"), streak);
});

test("a day missed starts over", () => {
  assert.deepEqual(streakAfterSolve({ last: "2026-10-01", length: 9 }, "2026-10-03"), {
    last: "2026-10-03",
    length: 1,
  });
});

test("a date before the last solve, as after a clock change, leaves the streak be", () => {
  const streak = { last: "2026-10-04", length: 6 };
  assert.deepEqual(streakAfterSolve(streak, "2026-10-03"), streak);
});

test("joined streaks: overlapping or touching runs make one, in either order", () => {
  const cases: [string, number, string, number, string, number][] = [
    // Overlapping: 10-01..10-05 and 10-03..10-08.
    ["2026-10-05", 5, "2026-10-08", 6, "2026-10-08", 8],
    // Touching: 10-01..10-03 and 10-04..10-05.
    ["2026-10-03", 3, "2026-10-05", 2, "2026-10-05", 5],
    // One inside the other: 10-01..10-10 and 10-04..10-05.
    ["2026-10-10", 10, "2026-10-05", 2, "2026-10-10", 10],
    // The same run.
    ["2026-10-05", 3, "2026-10-05", 3, "2026-10-05", 3],
    // Apart: 10-01..10-02 and 10-04..10-05; the later run stands.
    ["2026-10-02", 2, "2026-10-05", 2, "2026-10-05", 2],
  ];
  for (const [aLast, aLength, bLast, bLength, last, length] of cases) {
    const a = { last: aLast, length: aLength };
    const b = { last: bLast, length: bLength };
    assert.deepEqual(
      joinStreaks(a, b),
      { last, length },
      `${aLast}/${aLength} + ${bLast}/${bLength}`,
    );
    assert.deepEqual(
      joinStreaks(b, a),
      { last, length },
      `${bLast}/${bLength} + ${aLast}/${aLength}`,
    );
  }
});
