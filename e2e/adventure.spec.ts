import { test, expect, s, cell, markCorrect } from "./fixtures.ts";
import type { Page } from "@playwright/test";

/**
 * Step 1's puzzle is 2 questions of 2 options, and its one solution is B, A. From
 * `public/puzzles/adventure.json`'s first 2x2 puzzle; re-derive it if the lists
 * are redrawn.
 */
const STEP_ONE_SOLUTION = [1, 0];

const STEP_ONE = "/adventure/1/2x2";

/** Step 1's stored state once solved without hints. */
const STEP_ONE_SOLVED = "v1.1B.2A|s";

/**
 * Step 1 solved elsewhere and brought in by sync: no reached step of its own on
 * record. Seeded on the first load only, so a replay's clear sticks.
 */
async function solvedElsewhere(page: Page) {
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("seeded") !== null) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("thisquiz:puzzle:/adventure/1/2x2", state);
  }, STEP_ONE_SOLVED);
}

/** A path whose reached step is `step`. */
async function seedReached(page: Page, step: number) {
  await page.addInitScript(
    (value) => localStorage.setItem("thisquiz:adventure-reached", value),
    String(step),
  );
}

/** A step's circle on the page, by its step number. */
function stepCircle(page: Page, step: number) {
  return page.locator(`[data-testid="adventure-step"][data-step="${step}"]`);
}

async function solveStepOne(page: Page) {
  for (const [questionIndex, optionIndex] of STEP_ONE_SOLUTION.entries()) {
    await markCorrect(page, questionIndex, optionIndex);
  }
  await expect(page.getByTestId("completion-bar")).toBeVisible();
}

/** How far the ringed step's center sits from the viewport's middle, in px. */
async function offCenter(page: Page): Promise<number> {
  const box = await page.locator("[data-ringed]").boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  return box ? Math.abs(box.y + box.height / 2 - height / 2) : Infinity;
}

test("a new path opens at its start, ten steps long, only the first unlocked", async ({ page }) => {
  await page.goto("/adventure");
  await expect(page.getByTestId("adventure-step")).toHaveCount(10);
  await expect(stepCircle(page, 1)).toHaveAttribute("data-status", "next");
  await expect(stepCircle(page, 2)).toHaveAttribute("data-status", "locked");
  await expect(stepCircle(page, 10)).toHaveAttribute("data-status", "locked");
  await expect(page.getByTestId("adventure-stars")).toHaveText("0");
  await expect(page.getByTestId("adventure-diamonds")).toHaveCount(0);
  await expect(stepCircle(page, 1)).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("further along, the map shows five locked steps past the reached one", async ({ page }) => {
  await seedReached(page, 12);
  await page.goto("/adventure");
  await expect(page.getByTestId("adventure-step")).toHaveCount(17);
  await expect(stepCircle(page, 11)).toHaveAttribute("data-status", "done");
  await expect(stepCircle(page, 12)).toHaveAttribute("data-status", "next");
  for (const step of [13, 17]) {
    await expect(stepCircle(page, step)).toHaveAttribute("data-status", "locked");
  }
});

test("a locked step sends back to the map", async ({ page }) => {
  await page.goto("/adventure/2/2x2");
  await expect(page).toHaveURL(/\/adventure$/);
});

// Not a number, not its plain spelling, no such size, and a size before it joins.
for (const path of ["0/2x2", "abc/2x2", "01/2x2", "1/4x4", "1/2x3"]) {
  test(`/adventure/${path} is no puzzle`, async ({ page }) => {
    await page.goto(`/adventure/${path}`);
    await expect(page.getByText(s.adventure.notFound)).toBeVisible();
    await expect(page.getByRole("link", { name: s.adventure.backToMap })).toBeVisible();
  });
}

test("a hint-free solve stars the puzzle and unlocks the next step", async ({ page }) => {
  await page.goto(STEP_ONE);
  await expect(page.getByRole("heading", { name: s.adventure.puzzleTitle(1) })).toBeVisible();
  // Hint is the only tool.
  await expect(page.getByRole("button", { name: s.puzzle.checkpoint })).toHaveCount(0);
  await expect(page.getByRole("button", { name: s.puzzle.hint })).toBeVisible();

  await solveStepOne(page);
  // A solve leads back to the map, not straight on.
  const bar = page.getByTestId("completion-bar");
  await expect(bar.getByRole("button", { name: new RegExp(s.puzzle.nextPuzzle) })).toHaveCount(0);
  await expect(page.getByTestId("adventure-star-note")).toHaveText(s.adventure.starEarned);
  await bar.getByRole("link", { name: new RegExp(s.adventure.continue) }).click();
  await expect(page).toHaveURL(/\/adventure\/1$/);

  // The player has moved on to the step just unlocked.
  await expect(stepCircle(page, 2)).toHaveAttribute("data-ringed", "true");
  await expect(stepCircle(page, 1)).toHaveAttribute("data-status", "done");
  await expect(stepCircle(page, 1)).toHaveAccessibleName(s.adventure.step.done(1, 1));
  await expect(stepCircle(page, 2)).toHaveAttribute("data-status", "next");
  await expect(page.getByTestId("adventure-stars")).toHaveText("1");
});

test("a solve with a hint says how to earn the star", async ({ page }) => {
  await page.goto(STEP_ONE);
  await page.getByRole("button", { name: s.puzzle.hint }).click();
  await expect(page.getByTestId("hint-panel")).toBeVisible();
  await solveStepOne(page);
  await expect(page.getByTestId("adventure-star-note")).toHaveText(s.adventure.starMissed);

  await page.goto("/adventure");
  await expect(stepCircle(page, 1)).toHaveAttribute("data-status", "done");
  await expect(page.getByTestId("adventure-stars")).toHaveText("0");
});

test("the board and the Hint button hold still as a hint opens and the solve lands", async ({
  page,
}) => {
  await page.goto(STEP_ONE);
  const row = page.locator('[data-row="0"]');
  const hint = page.getByRole("button", { name: s.puzzle.hint });
  const rowBefore = await row.boundingBox();
  const hintBefore = await hint.boundingBox();
  await hint.click();
  await expect(page.getByTestId("hint-panel")).toBeVisible();
  expect(await row.boundingBox()).toEqual(rowBefore);
  expect(await hint.boundingBox()).toEqual(hintBefore);

  await solveStepOne(page);
  expect(await row.boundingBox()).toEqual(rowBefore);
});

test("a solved puzzle asks: replay, or show the solution; a replay keeps the star", async ({
  page,
}) => {
  await page.goto(STEP_ONE);
  await solveStepOne(page);

  await page.goto("/adventure");
  await stepCircle(page, 1).click();
  await expect(page.getByTestId("replay-star")).toHaveText(s.adventure.replay.starred);
  await page.getByTestId("replay-show-solution").click();
  await expect(page).toHaveURL(/\/adventure\/1\/2x2$/);
  await expect(page.getByTestId("completion-bar")).toBeVisible();

  await page.goto("/adventure");
  await stepCircle(page, 1).click();
  await page.getByTestId("replay-play-again").click();
  await expect(page).toHaveURL(/\/adventure\/1\/2x2$/);
  await expect(cell(page, 0, 0)).toHaveAttribute("data-mark", "unmarked");
  await expect(page.getByTestId("completion-bar")).toBeHidden();

  // Clearing the board keeps the next step unlocked, and the star.
  await page.goto("/adventure");
  await expect(stepCircle(page, 2)).toHaveAttribute("data-status", "next");
  await expect(page.getByTestId("adventure-stars")).toHaveText("1");

  // A solve with a hint after that still has the star.
  await page.goto(STEP_ONE);
  await page.getByRole("button", { name: s.puzzle.hint }).click();
  await solveStepOne(page);
  await expect(page.getByTestId("adventure-star-note")).toHaveText(s.adventure.alreadyStarred);
});

test("a replay keeps the next step unlocked, even without this device's own solve", async ({
  page,
}) => {
  await solvedElsewhere(page);
  await page.goto("/adventure");
  await stepCircle(page, 1).click();
  await page.getByTestId("replay-play-again").click();
  await expect(page).toHaveURL(/\/adventure\/1\/2x2$/);
  await page.getByTestId("adventure-back").click();
  await expect(stepCircle(page, 2)).toHaveAttribute("data-status", "next");
});

test("the solved board's own Play again keeps the next step unlocked too", async ({ page }) => {
  await solvedElsewhere(page);
  await page.goto(STEP_ONE);
  const bar = page.getByTestId("completion-bar");
  await bar.getByRole("button", { name: s.puzzle.playAgain }).click();
  await bar.getByRole("button", { name: s.puzzle.playAgainConfirm }).click();
  await expect(cell(page, 0, 0)).toHaveAttribute("data-mark", "unmarked");
  await page.getByTestId("adventure-back").click();
  await expect(stepCircle(page, 2)).toHaveAttribute("data-status", "next");
});

test("a step with more than one size expands into its sizes", async ({ page }) => {
  await seedReached(page, 30);
  await page.goto("/adventure");
  // Before 2x3 joins, a step is its one puzzle.
  await expect(stepCircle(page, 29)).toHaveAttribute("href", "/adventure/29/2x2");

  await expect(page.getByTestId("adventure-size")).toHaveCount(0);
  const pathTop = () =>
    stepCircle(page, 31).evaluate((x) => x.getBoundingClientRect().top + window.scrollY);
  const before = await pathTop();
  await stepCircle(page, 30).click();
  await expect(stepCircle(page, 30)).toHaveAttribute("aria-expanded", "true");
  const sizes = page.getByTestId("adventure-size");
  await expect(sizes).toHaveCount(2);
  // The sizes show over the path; nothing below them moves.
  expect(await pathTop()).toBe(before);

  // A press anywhere else closes it, and so does Escape.
  await page.mouse.click(5, 400);
  await expect(sizes).toHaveCount(0);
  await stepCircle(page, 30).click();
  await expect(sizes).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(sizes).toHaveCount(0);
  await stepCircle(page, 30).click();
  await expect(sizes.nth(0)).toHaveAttribute("data-size", "2x2");
  await expect(sizes.nth(1)).toHaveAccessibleName(s.adventure.size.unsolved(3, 2));

  await sizes.nth(1).click();
  await expect(page).toHaveURL(/\/adventure\/30\/2x3$/);
  await expect(page.getByRole("heading", { name: s.adventure.puzzleTitle(30) })).toBeVisible();
  await expect(page.locator("[data-row]")).toHaveCount(3);
});

test("a solved size asks, from the expanded step, to replay it or show the solution", async ({
  page,
}) => {
  await seedReached(page, 31);
  await page.addInitScript(() => localStorage.setItem("thisquiz:puzzle:/adventure/30/2x3", "v1|s"));
  for (const choice of ["replay-show-solution", "replay-play-again"]) {
    await page.goto("/adventure");
    await stepCircle(page, 30).click();
    await page.getByTestId("adventure-size").nth(1).click();
    await page.getByTestId(choice).click();
    await expect(page).toHaveURL(/\/adventure\/30\/2x3$/);
  }
});

test("every size joined so far is on offer, up to all four", async ({ page }) => {
  await seedReached(page, 100);
  await page.goto("/adventure");
  await stepCircle(page, 100).click();
  const sizes = page.getByTestId("adventure-size");
  await expect(sizes).toHaveCount(4);
  for (const [i, key] of ["2x2", "2x3", "3x2", "3x3"].entries()) {
    await expect(sizes.nth(i)).toHaveAttribute("data-size", key);
  }
});

test("a hundred steps earn a diamond and unlock the next world", async ({ page }) => {
  await seedReached(page, 100);
  await page.goto("/adventure");
  // The path ends at its diamond.
  await expect(page.getByTestId("adventure-step")).toHaveCount(100);
  await expect(page.getByTestId("adventure-diamond")).not.toHaveAttribute("data-earned");
  await expect(page.getByTestId("adventure-first-diamond")).toHaveCount(0);
  await page.goto("/");
  await expect(
    page.getByTestId("overview-adventure").getByTestId("adventure-diamond"),
  ).not.toHaveAttribute("data-earned");
  await page.goto("/adventure/2");
  await expect(page).toHaveURL(/\/adventure$/);

  await seedReached(page, 101);
  await page.goto("/adventure");
  // On to the second world, counting on from 101.
  await expect(page.getByRole("heading", { name: s.adventure.world(2) })).toBeVisible();
  await expect(page.getByTestId("adventure-step")).toHaveCount(10);
  await expect(stepCircle(page, 101)).toHaveAttribute("data-status", "next");
  await expect(stepCircle(page, 101)).toHaveAccessibleName(s.adventure.step.next(101));
  await expect(page.getByTestId("adventure-diamonds")).toHaveText("1");

  // The overview shows the diamond only as the one to aim for.
  await page.goto("/");
  await expect(page.getByTestId("overview-adventure").getByTestId("adventure-diamond")).toHaveCount(
    0,
  );
  await page.goto("/adventure");

  // The title opens the list of worlds.
  await page.getByTestId("world-title").click();
  const items = page.getByTestId("world-list-item");
  await expect(items).toHaveCount(2);
  await items.first().click();
  await expect(page).toHaveURL(/\/adventure\/1$/);
  await expect(page.getByTestId("adventure-diamond")).toHaveAttribute("data-earned", "true");
  await expect(page.getByTestId("adventure-diamond")).toBeInViewport();
  await page.getByTestId("world-next").click();
  await expect(page).toHaveURL(/\/adventure\/2$/);

  await page.goto("/adventure/1");
  await page.getByTestId("adventure-daily").click();
  await expect(page).toHaveURL(/\/daily$/);
});

test("past the lists' end, each size starts over from where it joined", async ({ page }) => {
  await seedReached(page, 577);
  const rows = page.locator("[data-row]");
  await page.goto("/adventure/577/2x3");
  await expect(rows).toHaveCount(3);
  const later = await rows.allTextContents();
  await page.goto("/adventure/30/2x3");
  await expect(rows).toHaveCount(3);
  expect(await rows.allTextContents()).toEqual(later);
});

test("the Debug dialog moves the path to a step, forward or back", async ({ page }) => {
  await page.goto("/?debug");
  await page.getByTestId("overview-debug").click();
  await page.getByTestId("debug-adventure-reached").fill("150");
  // Saving takes effect without a page load.
  await page.evaluate(() => ((window as unknown as { stayed: boolean }).stayed = true));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByTestId("overview-adventure").locator("[data-ringed]"),
  ).toHaveAccessibleName(s.adventure.step.next(150));
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
  await page.goto("/adventure");
  await expect(stepCircle(page, 150)).toHaveAttribute("data-status", "next");
  await expect(page.getByTestId("adventure-diamonds")).toHaveText("1");
  await expect(page.getByTestId("adventure-stars")).toHaveText("0");

  await page.goto("/");
  await page.getByTestId("overview-debug").click();
  // Enter in the field saves too.
  await page.getByTestId("debug-adventure-reached").fill("5");
  await page.getByTestId("debug-adventure-reached").press("Enter");
  await page.goto("/adventure");
  await expect(stepCircle(page, 5)).toHaveAttribute("data-status", "next");
  await expect(stepCircle(page, 6)).toHaveAttribute("data-status", "locked");
});

/** Seeds a streak whose last solve was `daysAgo` days before today. */
async function seedStreak(page: Page, daysAgo: number, length: number) {
  await page.evaluate(
    ([days, run]) => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      const pad = (n: number) => String(n).padStart(2, "0");
      const last = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      localStorage.setItem("thisquiz:streak", JSON.stringify({ last, length: run }));
    },
    [daysAgo, length],
  );
}

test("a solve starts the streak; one the day after runs it on", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("streak")).toHaveCount(0);
  await page.goto(STEP_ONE);
  await solveStepOne(page);
  await page.goto("/");
  await expect(page.getByTestId("streak")).toHaveText(s.overview.streak(1));
  await expect(page.getByTestId("streak")).toHaveAttribute("data-lit", "true");

  // Last solved yesterday: still running, its flame unlit until today's.
  await seedStreak(page, 1, 4);
  await page.reload();
  await expect(page.getByTestId("streak")).toContainText(s.overview.streak(4));
  await expect(page.getByTestId("streak")).toContainText(s.overview.streakOpen);
  await expect(page.getByTestId("streak")).toHaveAttribute("data-lit", "false");

  // A replay counts.
  await page.goto(STEP_ONE);
  const bar = page.getByTestId("completion-bar");
  await bar.getByRole("button", { name: s.puzzle.playAgain }).click();
  await bar.getByRole("button", { name: s.puzzle.playAgainConfirm }).click();
  await solveStepOne(page);
  await page.goto("/");
  await expect(page.getByTestId("streak")).toHaveText(s.overview.streak(5));
});

test("a day missed ends the streak", async ({ page }) => {
  await page.goto("/");
  await seedStreak(page, 2, 4);
  await page.reload();
  await expect(page.getByTestId("streak")).toHaveCount(0);
});

test("the map's bar stays in view as the path scrolls", async ({ page }) => {
  await seedReached(page, 30);
  await page.goto("/adventure");
  await stepCircle(page, 33).scrollIntoViewIfNeeded();
  await expect(page.getByTestId("adventure-stars")).toBeInViewport();
  await expect(page.getByTestId("home")).toBeInViewport();
});

test("Home stays put between a scrolled map and a puzzle", async ({ page }) => {
  await seedReached(page, 30);
  await page.goto("/adventure");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const onMap = await page.getByTestId("home").boundingBox();
  await page.goto("/adventure/30/2x2");
  const onPuzzle = await page.getByTestId("home").boundingBox();
  expect(onPuzzle).toEqual(onMap);
});

test("back from an earlier step, the map rings it, mid-screen", async ({ page }) => {
  // Step 25 sits rows above where the map would otherwise open.
  await seedReached(page, 30);
  await page.goto("/adventure/25/2x2");
  await page.getByTestId("adventure-back").click();
  await expect(page).toHaveURL(/\/adventure\/1$/);
  await expect(stepCircle(page, 25)).toHaveAttribute("data-ringed", "true");
  await expect(stepCircle(page, 30)).not.toHaveAttribute("data-ringed");
  await expect.poll(() => offCenter(page)).toBeLessThan(2);

  // In from the overview, too; the overview itself rings the next step to solve.
  await page.goto("/");
  await expect(
    page.getByTestId("overview-adventure").locator("[data-ringed]"),
  ).toHaveAccessibleName(s.adventure.step.next(30));
  await page.getByTestId("overview-adventure-play").click();
  await expect(page).toHaveURL(/\/adventure$/);
  await expect.poll(() => offCenter(page)).toBeLessThan(2);
});

test("the map's Home button leads to the overview", async ({ page }) => {
  await page.goto("/adventure");
  await page.getByTestId("home").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("overview-adventure")).toBeVisible();
});

test("each overview window opens its place, from Play or anywhere on it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("overview-adventure").getByTestId("adventure-stars")).toHaveText(
    "0",
  );
  await page.getByTestId("overview-adventure-play").click();
  await expect(page).toHaveURL(/\/adventure$/);

  await page.goto("/");
  await page.getByTestId("overview-daily-play").click();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByRole("tab", { name: s.difficulty[1] })).toBeVisible();

  // A blank corner of each window.
  const corner = { x: 12, y: 12 };
  await page.goto("/");
  await page.getByTestId("overview-adventure").click({ position: corner });
  await expect(page).toHaveURL(/\/adventure$/);

  await page.goto("/");
  await page.getByTestId("overview-daily").click({ position: corner });
  await expect(page).toHaveURL(/\/daily$/);

  // Archive keeps its own way in, above the window's.
  await page.goto("/");
  await page.getByTestId("overview-daily").getByRole("link", { name: s.daily.archive }).click();
  await expect(page).toHaveURL(/\/daily\/archive$/);
});

test("the overview's steps open their puzzles, or expand right in the window", async ({ page }) => {
  await page.goto("/");
  const strip = page.getByTestId("overview-adventure");
  await strip.getByTestId("adventure-step").first().click();
  await expect(page).toHaveURL(/\/adventure\/1\/2x2$/);

  await seedReached(page, 30);
  await page.goto("/");
  await strip.locator("[data-ringed]").click();
  await expect(strip.getByTestId("adventure-size")).toHaveCount(2);
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("Escape");
  await expect(strip.getByTestId("adventure-size")).toHaveCount(0);
  await strip.locator("[data-ringed]").click();
  // In through the app, not a fresh page load.
  await page.evaluate(() => ((window as unknown as { stayed: boolean }).stayed = true));
  await strip.getByTestId("adventure-size").nth(1).click();
  await expect(page).toHaveURL(/\/adventure\/30\/2x3$/);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
});
