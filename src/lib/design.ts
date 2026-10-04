import { DAILY_PATH } from "../puzzles/daily.ts";

/** The app's look: zen or play. */
export type Design = "zen" | "play";

/** Whether `path` is the section at `base`, or a page in it. */
export function inSection(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

/** Each section has its own look: the daily pages are zen, everything else is play. */
export function designForPath(path: string): Design {
  return inSection(path, DAILY_PATH) ? "zen" : "play";
}
