import { test, expect, cell, s, DAY_ONE_L1 } from "./fixtures.ts";
import type { Locator, Page } from "@playwright/test";
import { TUTORIAL_PUZZLES, type TutorialPuzzle } from "../src/puzzles/tutorial.ts";

// A clock to step past the double-press guard.
test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

function stepText(page: Page) {
  return page.getByTestId("tutorial-step");
}

/** A cell's marks, in press order. */
const MARK_CYCLE = ["unmarked", "incorrect", "correct"];

/** A press spaced from the last, so the tutorial counts it. */
async function press(page: Page, target: Locator) {
  await page.clock.fastForward(1000);
  await target.click();
}

/** Presses a cell through the cycle, from its mark to `mark`. */
async function pressTo(page: Page, target: Locator, mark: string) {
  const from = MARK_CYCLE.indexOf((await target.getAttribute("data-mark")) ?? "");
  const presses = (MARK_CYCLE.indexOf(mark) - from + 3) % 3;
  for (let i = 0; i < presses; i++) await press(page, target);
  await expect(target).toHaveAttribute("data-mark", mark);
}

/** Presses the lone cell through its marks and moves on. */
async function passOpening(page: Page) {
  const lone = cell(page, 0, 0);
  for (const mark of ["incorrect", "correct", "unmarked"]) {
    await press(page, lone);
    await expect(lone).toHaveAttribute("data-mark", mark);
  }
  await page.getByTestId("tutorial-next").click();
}

/** Plays a puzzle's script through, checking each step's copy on the way. */
async function playPuzzle(page: Page, puzzle: TutorialPuzzle) {
  for (const step of puzzle.steps) {
    await expect(stepText(page)).toContainText(s.tutorial.steps("fine")[step.key].text);
    // A solve step: mark each question's answer.
    const moves =
      step.target.type === "solve"
        ? step.target.answers.map((oi, qi) => ({ qi, oi, mark: "correct" }))
        : [step.target];
    for (const move of moves) await pressTo(page, cell(page, move.qi, move.oi), move.mark);
  }
  if (puzzle.solved) {
    await expect(stepText(page)).toContainText(s.tutorial.solved[puzzle.solved].text);
  }
}

/** Clears the tutorial flag, as on a fresh device. */
async function freshDevice(page: Page) {
  await page.addInitScript(() => localStorage.removeItem("thisquiz:tutorial"));
}

test("a solve step takes any cell", async ({ page }) => {
  await page.goto("/tutorial");
  await passOpening(page);
  // The first puzzle with more than one option, all solve steps.
  const free = TUTORIAL_PUZZLES.findIndex(
    (puzzle) =>
      puzzle.compact.o[0].length > 1 && puzzle.steps.every((step) => step.target.type === "solve"),
  );
  for (const puzzle of TUTORIAL_PUZZLES.slice(0, free)) {
    await playPuzzle(page, puzzle);
    await page.getByTestId("tutorial-next").click();
  }
  // Wrong answers take marks too, and a quick double press counts twice.
  await pressTo(page, cell(page, 0, 0), "incorrect");
  const wrong = cell(page, 0, 1);
  await press(page, wrong);
  await wrong.click();
  await expect(wrong).toHaveAttribute("data-mark", "correct");
});

test("a quick second press is ignored", async ({ page }) => {
  await page.goto("/tutorial");
  // Frozen, so the second press lands within the guard's gap.
  await page.clock.pauseAt(Date.now() + 60_000);
  const lone = cell(page, 0, 0);
  await press(page, lone);
  await lone.click();
  await expect(lone).toHaveAttribute("data-mark", "incorrect");
});

test("a first visit opens the tutorial", async ({ page }) => {
  await freshDevice(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/tutorial$/);
  await expect(stepText(page)).toBeVisible();
});

test("a visit with progress stays on the overview", async ({ page }) => {
  await freshDevice(page);
  await page.addInitScript(() => localStorage.setItem("thisquiz:puzzle:/2026-04-19/1", "x"));
  await page.goto("/");
  await expect(page.getByTestId("overview-daily")).toBeVisible();
  await expect(page).not.toHaveURL(/\/tutorial$/);
});

test.describe("as a crawler", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  });

  test("a first visit stays on the overview", async ({ page }) => {
    await freshDevice(page);
    await page.goto("/");
    await expect(page.getByTestId("overview-daily")).toBeVisible();
    await expect(page).not.toHaveURL(/\/tutorial$/);
  });
});

test("skipping a first visit's tutorial opens the overview, with the tutorial retired", async ({
  page,
}) => {
  await freshDevice(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/tutorial$/);
  await page.getByTestId("tutorial-skip").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("overview-daily")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("thisquiz:tutorial"))).toBe("1");
});

test("the first level links to the tutorial", async ({ page }) => {
  await page.goto("/daily");
  await page.getByTestId("take-tutorial").click();
  await expect(page).toHaveURL(/\/tutorial$/);
});

test("skipping a linked tutorial returns to the page it came from", async ({ page }) => {
  await page.goto(DAY_ONE_L1);
  await page.getByTestId("take-tutorial").click();
  await expect(page).toHaveURL(/\/tutorial$/);
  await page.getByTestId("tutorial-skip").click();
  await expect(page).toHaveURL(new RegExp(`${DAY_ONE_L1}$`));
});

/** Plays the whole script, stopping on the last puzzle's destinations. */
async function walkScript(page: Page) {
  await freshDevice(page);
  await page.goto("/tutorial");
  await passOpening(page);
  for (const puzzle of TUTORIAL_PUZZLES) {
    await playPuzzle(page, puzzle);
    const last = puzzle === TUTORIAL_PUZZLES.at(-1);
    // Skip stays until the last puzzle is solved.
    await expect(page.getByTestId("tutorial-skip")).toHaveCount(last ? 0 : 1);
    if (!last) await page.getByTestId("tutorial-next").click();
  }
}

test("the script walks through to today's puzzle", async ({ page }) => {
  await walkScript(page);
  await page.getByTestId("tutorial-daily").click();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByRole("tab", { name: s.difficulty[1] })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("thisquiz:tutorial"))).toBe("1");
});

test("the script's Adventure destination opens the map", async ({ page }) => {
  await walkScript(page);
  await page.getByTestId("tutorial-adventure").click();
  await expect(page).toHaveURL(/\/adventure$/);
  await expect(page.getByTestId("adventure-step").first()).toBeVisible();
});
