import type { Marks, OptionMark } from "../engine/types.ts";
import type { CompactPuzzle } from "./daily.ts";

export const TUTORIAL_ID = "tutorial";

/** A tutorial step's name, also the key of its copy. */
export type TutorialStepKey = "meetQuestion" | "validityBar" | "askSelf" | "tryThree" | "tryTwo";

/** The name of a puzzle's solved line, also the key of its copy. */
export type TutorialSolvedKey = "first" | "self" | "three" | "done";

/** Tutorial words: an optional bold lead, then the text. */
export interface StepCopy {
  lead?: string;
  text: string;
}

/** Where a step's arrow points: a question's row, or its validity bar. */
export interface ArrowSpec {
  mode: "row" | "bar";
  qi: number;
}

/**
 * What a step waits for: one cell reaching a mark, or the puzzle solved by any
 * presses (with its answers, one option per question).
 */
export type TutorialTarget =
  | { type: "cell"; qi: number; oi: number; mark: OptionMark }
  | { type: "solve"; answers: number[] };

export interface TutorialStep {
  key: TutorialStepKey;
  target: TutorialTarget;
  arrow?: ArrowSpec;
}

/** A tutorial puzzle, its script, and its solved line. */
export interface TutorialPuzzle {
  compact: CompactPuzzle;
  steps: TutorialStep[];
  solved?: TutorialSolvedKey;
}

const cell = (qi: number, oi: number, mark: OptionMark): TutorialTarget => ({
  type: "cell",
  qi,
  oi,
  mark,
});

/** The tutorial's puzzles, in order. */
export const TUTORIAL_PUZZLES: TutorialPuzzle[] = [
  // One question, one option: solution A.
  {
    compact: { o: [[1]], q: [{ a: 0, t: "CountAnswer" }] },
    steps: [
      { key: "meetQuestion", target: cell(0, 0, "incorrect"), arrow: { mode: "row", qi: 0 } },
      { key: "validityBar", target: cell(0, 0, "correct"), arrow: { mode: "bar", qi: 0 } },
    ],
    solved: "first",
  },
  // One question asking for its own answer by number, one option: solution A.
  {
    compact: { o: [[0]], q: [{ q: 0, t: "AnswerOf" }] },
    steps: [{ key: "askSelf", target: { type: "solve", answers: [0] } }],
    solved: "self",
  },
  // One question asking for its own answer by number, options saying B A C: solution C.
  {
    compact: { o: [[1, 0, 2]], q: [{ q: 0, t: "AnswerOf" }] },
    steps: [{ key: "tryThree", target: { type: "solve", answers: [2] } }],
    solved: "three",
  },
  // Two questions asking about each other, one option each: solution A A.
  {
    compact: {
      o: [[0], [2]],
      q: [
        { q: 1, t: "AnswerOf" },
        { a: 0, t: "CountAnswer" },
      ],
    },
    steps: [{ key: "tryTwo", target: { type: "solve", answers: [0, 0] } }],
    solved: "done",
  },
];

function reached(target: TutorialTarget, marks: Marks[]): boolean {
  if (target.type === "solve") {
    return target.answers.every((oi, qi) => marks[qi]?.[oi] === "correct");
  }
  return marks[target.qi]?.[target.oi] === target.mark;
}

/**
 * The step after the last one the marks reach, or null past the end; read off
 * the marks, so overshooting and coming back still lands right.
 */
export function currentStep(steps: TutorialStep[], marks: Marks[]): TutorialStep | null {
  let next = 0;
  steps.forEach((step, i) => {
    if (reached(step.target, marks)) next = i + 1;
  });
  return steps[next] ?? null;
}

const DONE_KEY = "refpuzzle:tutorial";

/** Also held in memory, so a failed save still retires it this visit. */
let doneThisVisit = false;

/** Whether the tutorial has been finished or skipped on this device. */
export function tutorialDone(): boolean {
  if (doneThisVisit) return true;
  try {
    return localStorage.getItem(DONE_KEY) !== null;
  } catch {
    // Blocked storage counts as done, so it never loops.
    return true;
  }
}

export function markTutorialDone(): void {
  doneThisVisit = true;
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    // storage unavailable
  }
}

/** The page a link opened the tutorial from; null when it opened by itself. */
let openedFrom: string | null = null;

/** Remembers the current page, for a tutorial opened by a link to return to. */
export function rememberTutorialOpener(): void {
  openedFrom = window.location.pathname;
}

export function tutorialOpener(): string | null {
  return openedFrom;
}
