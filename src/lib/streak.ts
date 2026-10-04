/**
 * The streak: days in a row, by the device's date, with a puzzle solved. Any
 * solve counts, a replay too; the tutorial's and the playground's don't.
 */
export interface Streak {
  /** The last day with a solve, `YYYY-MM-DD`. */
  last: string;
  /** Days in a row up to and including `last`. */
  length: number;
}

const STREAK_KEY = "refpuzzle:streak";

/** A `YYYY-MM-DD` date as a count of days, for differences. */
function dayIndex(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** A real calendar date, `YYYY-MM-DD`. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(dayIndex(value) * 86_400_000).toISOString().startsWith(value);
}

/** A well-formed streak, copied without anything else the value carries. */
function asStreak(value: unknown): Streak | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("last" in value) || typeof value.last !== "string" || !isDate(value.last)) return null;
  if (!("length" in value) || typeof value.length !== "number") return null;
  if (!Number.isInteger(value.length) || value.length < 1) return null;
  return { last: value.last, length: value.length };
}

export function loadStreak(): Streak | null {
  try {
    return asStreak(JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null"));
  } catch {
    return null;
  }
}

export function saveStreak(streak: Streak): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  } catch {}
}

/** The days in a row as of `today`: still running if the last solve was today or yesterday. */
export function currentStreak(today: string): number {
  const streak = loadStreak();
  if (!streak) return 0;
  return dayIndex(today) - dayIndex(streak.last) <= 1 ? streak.length : 0;
}

/** Whether `today` already has a solve. */
export function solvedToday(today: string): boolean {
  const streak = loadStreak();
  return streak !== null && dayIndex(streak.last) >= dayIndex(today);
}

/**
 * The streak after a solve on `today`: run on from yesterday, or start over.
 * A date earlier than the last solve, as after a clock change, leaves it be.
 */
export function streakAfterSolve(streak: Streak | null, today: string): Streak {
  if (!streak) return { last: today, length: 1 };
  const gap = dayIndex(today) - dayIndex(streak.last);
  if (gap <= 0) return streak;
  return { last: today, length: gap === 1 ? streak.length + 1 : 1 };
}

/** Counts a solve on `today` toward the streak. */
export function extendStreak(today: string): void {
  saveStreak(streakAfterSolve(loadStreak(), today));
}

/** Two streaks joined. Each is a run of days ending on its last day; runs that touch or overlap make one. */
export function joinStreaks(a: Streak, b: Streak): Streak {
  const [later, earlier] = dayIndex(a.last) >= dayIndex(b.last) ? [a, b] : [b, a];
  const start = (streak: Streak) => dayIndex(streak.last) - streak.length + 1;
  const touching = dayIndex(earlier.last) >= start(later) - 1;
  const length = touching
    ? dayIndex(later.last) - Math.min(start(later), start(earlier)) + 1
    : later.length;
  return { last: later.last, length };
}

/** The stored streak joined with another device's, or null if that changes nothing. */
export function mergedStreak(incoming: unknown): Streak | null {
  const theirs = asStreak(incoming);
  if (!theirs) return null;
  const own = loadStreak();
  if (!own) return theirs;
  const joined = joinStreaks(own, theirs);
  return joined.last === own.last && joined.length === own.length ? null : joined;
}
