import { useEffect, useState } from "preact/hooks";
// Remove support for refpuzzle.com after 2027-06-01.
import type { MovePhase } from "./domain-move.ts";

/**
 * Development switches, kept in sessionStorage so they survive a reload but
 * never a new tab. `?debug` is the one URL entry point, and sets the flag for
 * the session; everything else is set from the overview's Debug dialog.
 */

const DEBUG_KEY = "debug";
const NUDGE_KEY = "debug:nudge";

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {}
}

/** Reads `?debug` off the URL once, so the flag outlives the query string. */
export function adoptDebugParam(): void {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).has("debug")) write(DEBUG_KEY, "1");
}

/** Debug mode: every hint step at once, and any date opens. */
export function debugEnabled(): boolean {
  return read(DEBUG_KEY) === "1";
}

export function setDebugEnabled(on: boolean): void {
  write(DEBUG_KEY, on ? "1" : null);
}

/** Seconds of idle before a nudge; null leaves the shipped wait alone. */
export function nudgeSeconds(): number | null {
  const seconds = Number(read(NUDGE_KEY));
  return seconds > 0 ? seconds : null;
}

export function setNudgeSeconds(seconds: number | null): void {
  write(NUDGE_KEY, seconds === null ? null : String(seconds));
}

const REACHED_STEP_KEY = "debug:adventure-reached";

/** The Adventure's reached step, set by hand; null leaves the path as played. */
export function reachedStepOverride(): number | null {
  const step = Number(read(REACHED_STEP_KEY));
  return Number.isInteger(step) && step >= 1 ? step : null;
}

export function setReachedStepOverride(step: number | null): void {
  write(REACHED_STEP_KEY, step === null ? null : String(step));
}

// Remove support for refpuzzle.com after 2027-06-01.
const LEGACY_HOST_KEY = "debug:legacy-host";
const MOVE_PHASES: readonly MovePhase[] = ["move", "urgent", "closed"];

/** The page as refpuzzle.com shows it in this phase; null is this host as it is. */
export function legacyHostPreview(): MovePhase | null {
  const phase = read(LEGACY_HOST_KEY);
  return MOVE_PHASES.find((x) => x === phase) ?? null;
}

export function setLegacyHostPreview(phase: MovePhase | null): void {
  write(LEGACY_HOST_KEY, phase);
}

const changeListeners = new Set<() => void>();

/** Puts saved switches to work: the app remounts, so every reader reads them afresh. */
export function applyDebugChanges(): void {
  for (const listener of changeListeners) listener();
}

/** A count that rises with each applied change, as a key that remounts the app. */
export function useDebugRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const listener = () => setRevision((was) => was + 1);
    changeListeners.add(listener);
    return () => {
      changeListeners.delete(listener);
    };
  }, []);
  return revision;
}
