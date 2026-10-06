/**
 * The store screenshots and the link-preview image, taken from the built app
 * in a fixed state: a frozen date, light theme, and puzzles part-way solved.
 * Run with `pnpm screenshots`, look the images over, then commit them.
 */
import { statSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { TUTORIAL_PUZZLES } from "../../src/puzzles/tutorial.ts";

const PUBLIC = new URL("../../public/", import.meta.url).pathname;

/** WhatsApp drops previews whose image is larger than this. */
const PREVIEW_MAX_BYTES = 300 * 1024;

/** A day after the first puzzles, so day one reads as a past puzzle to replay. */
const NOW = new Date("2026-04-20T10:00:00");

/**
 * Progress to show, from each puzzle's one solution: `answered` questions get
 * their answer marked; `eliminated` maps a question to the wrong options to
 * cross out. Solutions from `cargo run --release -- check
 * public/puzzles/daily/2026.json <id> --json` (`brute_solutions`).
 */
interface Progress {
  path: string;
  solution: string;
  answered: number[];
  eliminated: Record<number, string>;
}

/** 8 questions in two columns. */
const DESKTOP: Progress = {
  path: "/daily/2026-04-19/4",
  solution: "BADAECAB",
  answered: [0, 1, 4],
  eliminated: { 2: "AE", 3: "BC", 5: "D", 6: "CE" },
};

/** 4 questions, close up. */
const PHONE: Progress = {
  path: "/daily/2026-04-19/2",
  solution: "DBEC",
  answered: [1],
  eliminated: { 0: "AC", 2: "B", 3: "E" },
};

const LETTERS = "ABCDE";

/**
 * The tutorial's three-option puzzle, "What is the answer to question #1?",
 * where only C agrees with itself. Shown through the playground, whose address
 * carries the puzzle: `p=` and its JSON, deflated and base64url-encoded.
 */
const previewPuzzle = TUTORIAL_PUZZLES.find((puzzle) => puzzle.solved === "three");
if (!previewPuzzle) throw new Error("The tutorial's three-option puzzle is gone");
const PREVIEW_PUZZLE = `/playground#p=${deflateRawSync(JSON.stringify(previewPuzzle.compact)).toString("base64url")}`;

async function prepare(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    localStorage.setItem("thisquiz:onboarded", "1");
    localStorage.setItem("thisquiz:tutorial", "1");
    localStorage.setItem("thisquiz:theme", "light");
  });
}

async function play(page: Page, progress: Progress) {
  await page.goto(progress.path);
  const cell = (question: number, letter: string) =>
    page.locator(`[data-qi="${question}"][data-oi="${LETTERS.indexOf(letter)}"]`);
  for (const [question, letters] of Object.entries(progress.eliminated)) {
    for (const letter of letters) {
      // Only wrong options, so the board stays consistent with the solution.
      expect(letter).not.toBe(progress.solution[Number(question)]);
      await cell(Number(question), letter).click();
    }
  }
  for (const question of progress.answered) {
    // A click eliminates, a second marks correct.
    const target = cell(question, progress.solution[question]);
    await target.click();
    await target.click();
  }
  await settle(page);
}

/** Fonts in and the logo's drawing animation done. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
}

test("desktop: a daily puzzle part-way solved", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();
  await prepare(page);
  await play(page, DESKTOP);
  await page.screenshot({ path: PUBLIC + "screenshot-desktop.png" });
  await context.close();
});

test("phone: a daily puzzle part-way solved", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await prepare(page);
  await play(page, PHONE);
  await page.screenshot({ path: PUBLIC + "screenshot-mobile.png" });
  await context.close();
});

test("link preview: the title beside a small puzzle", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await prepare(page);

  await page.goto("/");
  await settle(page);
  // The note and arrow hang outside the title's box, so clip to all three.
  const titleArea = await page.getByTestId("brand-title").evaluate((root) => {
    const parts = [root, ...root.querySelectorAll("p, [data-arrow]")];
    const rects = parts.map((part) => part.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const pad = 8;
    return {
      x: left - pad,
      y: top - pad,
      width: right - left + 2 * pad,
      height: bottom - top + 2 * pad,
    };
  });
  const title = await page.screenshot({ clip: titleArea });

  // A small puzzle, whole and untouched: an invitation to start. Taken in a
  // narrow window, so it reflows tall and its text scales up in the card: a
  // preview is often shown at a third of its size.
  const puzzleContext = await browser.newContext({
    viewport: { width: 540, height: 800 },
    deviceScaleFactor: 3,
  });
  const puzzlePage = await puzzleContext.newPage();
  await prepare(puzzlePage);
  await puzzlePage.goto(PREVIEW_PUZZLE);
  await settle(puzzlePage);
  // An untouched board's validity bars say nothing yet, and the toolbar below
  // isn't part of the puzzle, so the preview leaves both out.
  // A larger base size than narrow windows get, so the text is large for its width.
  await puzzlePage.addStyleTag({
    content:
      "[data-validity-bar] { display: none !important; } [data-testid=puzzle-dock] { visibility: hidden !important; } html { font-size: 20px !important; }",
  });
  await settle(puzzlePage);
  const rows = puzzlePage.locator("[data-row]");
  const first = await rows.first().boundingBox();
  const last = await rows.last().boundingBox();
  // From the first question's text, past the row's own padding above it.
  const text = await rows.first().locator(":scope > div").nth(1).boundingBox();
  if (!first || !last || !text) throw new Error("No questions to show");
  // Room for the buttons' raised edges.
  const margin = 12;
  const questions = await puzzlePage.screenshot({
    clip: {
      x: first.x - margin,
      y: text.y - margin,
      width: Math.max(first.width, last.width) + 2 * margin,
      height: last.y + last.height - text.y + 2 * margin,
    },
  });

  // Composed at the size previews use: the title on the left, the questions right.
  // Its own context at 1x, so the file is 1200x630; the parts above are 2x, so it stays sharp.
  const cardContext = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const card = await cardContext.newPage();
  const src = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
  await card.setContent(`<!doctype html>
    <style>
      html, body { margin: 0; width: 1200px; height: 630px; background: #faf9f7; }
      body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 20px 56px; box-sizing: border-box; }
      img { display: block; max-width: 100%; }
      .title { height: 320px; }
      .questions { width: 1000px; max-height: 250px; object-fit: contain; }
    </style>
    <img class="title" src="${src(title)}" alt="">
    <img class="questions" src="${src(questions)}" alt="">`);
  const path = PUBLIC + "og-image.png";
  await card.screenshot({ path });
  expect(statSync(path).size).toBeLessThan(PREVIEW_MAX_BYTES);
  await cardContext.close();
  await puzzleContext.close();
  await context.close();
});
