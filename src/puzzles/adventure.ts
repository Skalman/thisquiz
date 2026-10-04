import type { Puzzle } from "../engine/types.ts";
import { reachedStepOverride, setReachedStepOverride } from "../lib/debug.ts";
import { addStars, loadStars } from "../lib/stars.ts";
import { clearState, getCompletedPuzzleIds } from "../lib/store.ts";
import { wasmReady } from "../lib/wasm.ts";
import { parseCompactPuzzle, type CompactPuzzle } from "./daily.ts";

/** A puzzle size on the path, and the step where the path first offers it. */
export interface AdventureSize {
  /** Options × questions, as the grid is wide and tall: `3x2` is 2 questions of 3 options. */
  key: string;
  questions: number;
  options: number;
  joins: number;
}

/** Every size, in the order they join the path. */
const SIZES: readonly AdventureSize[] = [
  { key: "2x2", questions: 2, options: 2, joins: 1 },
  { key: "2x3", questions: 3, options: 2, joins: 30 },
  { key: "3x2", questions: 2, options: 3, joins: 60 },
  { key: "3x3", questions: 3, options: 3, joins: 100 },
];

/** The sizes a step offers: every one that has joined by then. */
function sizesAt(step: number): AdventureSize[] {
  return SIZES.filter((size) => size.joins <= step);
}

export function sizeByKey(key: string): AdventureSize | undefined {
  return SIZES.find((size) => size.key === key);
}

/**
 * The path comes in worlds of this many steps, each on a map of its own;
 * finishing one earns a diamond and unlocks the next. Steps are counted along
 * the whole path: the second world runs from 101 to 200.
 */
export const STEPS_PER_WORLD = 100;

/** The world a step is in, from 1. */
export function worldOf(step: number): number {
  return Math.floor((step - 1) / STEPS_PER_WORLD) + 1;
}

/** A world's first step. */
export function firstStepOf(world: number): number {
  return (world - 1) * STEPS_PER_WORLD + 1;
}

/** The map of the world the player is in. */
export const ADVENTURE_PATH = "/adventure";

/** One world's map. */
export function worldMapPath(world: number): string {
  return `${ADVENTURE_PATH}/${world}`;
}

/** A puzzle's page. */
export function adventurePuzzlePath(step: number, size: AdventureSize): string {
  return `${ADVENTURE_PATH}/${step}/${size.key}`;
}

/** A puzzle's storage key. */
function adventureId(step: number, size: AdventureSize): string {
  return `/adventure/${step}/${size.key}`;
}

/** A storage key's step and size key, or null for any other puzzle's. */
function parseAdventureId(id: string): { step: number; size: string } | null {
  const match = /^\/adventure\/(\d+)\/(\d+x\d+)$/.exec(id);
  return match && sizeByKey(match[2]) ? { step: Number(match[1]), size: match[2] } : null;
}

/** Each size's list of puzzles, by size key. */
export type AdventureLists = Record<string, CompactPuzzle[] | undefined>;

/** The lists, loaded once; a failed load is retried on the next call. */
let request: Promise<AdventureLists | null> | null = null;

/** The lists once they have loaded, for a render that can't wait a tick. */
let loaded: AdventureLists | null = null;

export function fetchAdventureLists(): Promise<AdventureLists | null> {
  request ??= loadLists().then((result) => {
    if (result === null) request = null;
    loaded = result;
    return result;
  });
  return request;
}

export function loadedAdventureLists(): AdventureLists | null {
  return loaded;
}

async function loadLists(): Promise<AdventureLists | null> {
  try {
    const resp = await fetch("/puzzles/adventure.json");
    if (!resp.ok) return null;
    const result: AdventureLists = await resp.json();
    // Board text renders through wasm.
    await wasmReady();
    return result;
  } catch {
    return null;
  }
}

/** Puzzles already parsed, so a page keeps the same one across renders. */
const parsed = new Map<string, Puzzle>();

/**
 * The puzzle a step gives in a size, or null before the size joins. Each list
 * runs from the step where its size joins; past its end, it starts over.
 */
export function adventurePuzzle(
  lists: AdventureLists,
  step: number,
  size: AdventureSize,
): Puzzle | null {
  const list = lists[size.key];
  if (!list?.length || step < size.joins) return null;
  const id = adventureId(step, size);
  let puzzle = parsed.get(id);
  if (!puzzle) {
    puzzle = { ...parseCompactPuzzle(list[(step - size.joins) % list.length]), id };
    parsed.set(id, puzzle);
  }
  return puzzle;
}

const REACHED_KEY = "refpuzzle:adventure-reached";

/** The furthest reached step noted this visit, for when storage can't keep it. */
let reachedThisVisit = 0;

/**
 * The furthest step unlocked on the path: past every solve, and never back,
 * so clearing a solved board to replay it keeps the steps after it unlocked. The
 * Debug dialog's step stands in for it, and moves on with solves.
 */
export function reachedStep(): number {
  const override = reachedStepOverride();
  if (override !== null) return override;
  let reached = Math.max(1, reachedThisVisit);
  for (const id of getCompletedPuzzleIds()) {
    const solved = parseAdventureId(id);
    if (solved) reached = Math.max(reached, solved.step + 1);
  }
  return Math.max(reached, storedReached());
}

/** The reached step this device keeps, apart from its solves; 0 if none. */
export function storedReached(): number {
  try {
    return Number(localStorage.getItem(REACHED_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Raises the reached step this device keeps to `step`, if it's further. */
export function raiseStoredReached(step: number): void {
  reachedThisVisit = Math.max(reachedThisVisit, step);
  try {
    if (step > storedReached()) localStorage.setItem(REACHED_KEY, String(step));
  } catch {}
}

/** Unlocks the path up to `step`; while the Debug dialog's step is set, that moves instead. */
function unlockUpTo(step: number): void {
  const override = reachedStepOverride();
  if (override === null) raiseStoredReached(step);
  else if (step > override) setReachedStepOverride(step);
}

/** A solve unlocks the next step, and earns a star without hints. */
export function recordSolve(step: number, size: AdventureSize, withoutHints: boolean): void {
  unlockUpTo(step + 1);
  if (withoutHints) addStars([adventureId(step, size)]);
}

/** Stores the reached step as it stands, so clearing a solve can't take it back. */
export function holdReached(): void {
  unlockUpTo(reachedStep());
}

/** Clears a solved board to play again; its star and the steps after it stay. */
export function clearForReplay(step: number, size: AdventureSize): void {
  holdReached();
  clearState(adventureId(step, size));
}

/** A step on the map: not reached yet, the reached one, or passed. */
export type StepStatus = "locked" | "next" | "done";

/** One step's standing. */
export interface StepProgress {
  step: number;
  status: StepStatus;
  sizes: AdventureSize[];
  /** The keys of the sizes whose boards stand solved. */
  solvedSizes: Set<string>;
  /** The keys of the sizes with a star. */
  starredSizes: Set<string>;
}

/** Where the path stands, as the map and the overview show it. */
export interface AdventureProgress {
  reached: number;
  /** The step the player last played. */
  lastPlayed: number;
  stars: number;
  diamonds: number;
  /** The world the reached step is in, from 1. */
  reachedWorld: number;
  /** The stars earned in one world. */
  starsInWorld: (world: number) => number;
  /** One step's standing. */
  stepAt: (step: number) => StepProgress;
}

export function adventureProgress(): AdventureProgress {
  const reached = reachedStep();
  /** Size keys by step, from a list of storage keys. */
  const byStep = (ids: Iterable<string>) => {
    const map = new Map<number, Set<string>>();
    for (const id of ids) {
      const at = parseAdventureId(id);
      if (!at) continue;
      const sizes = map.get(at.step) ?? new Set<string>();
      sizes.add(at.size);
      map.set(at.step, sizes);
    }
    return map;
  };
  const solved = byStep(getCompletedPuzzleIds());
  const starred = byStep(loadStars());
  const starCount = (steps: [number, Set<string>][]) =>
    steps.reduce((sum, [, keys]) => sum + keys.size, 0);
  return {
    reached,
    lastPlayed: lastPlayedStep(reached),
    stars: starCount([...starred]),
    diamonds: worldOf(reached) - 1,
    reachedWorld: worldOf(reached),
    starsInWorld: (world) => starCount([...starred].filter(([step]) => worldOf(step) === world)),
    stepAt: (step) => ({
      step,
      status: step > reached ? "locked" : step === reached ? "next" : "done",
      sizes: sizesAt(step),
      solvedSizes: solved.get(step) ?? new Set(),
      starredSizes: starred.get(step) ?? new Set(),
    }),
  };
}

const LAST_PLAYED_KEY = "refpuzzle:adventure-last-played";

/**
 * Where the player is on the path: the step they last played, or the one a
 * solve there unlocked; the reached step until they've played one. Kept for the
 * tab's session, so a reload keeps the place.
 */
function lastPlayedStep(reached: number): number {
  try {
    const step = Number(sessionStorage.getItem(LAST_PLAYED_KEY));
    if (step >= 1 && step <= reached) return step;
  } catch {}
  return reached;
}

export function setLastPlayed(step: number): void {
  try {
    sessionStorage.setItem(LAST_PLAYED_KEY, String(step));
  } catch {}
}
