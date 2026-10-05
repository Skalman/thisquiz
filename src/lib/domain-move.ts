// Remove support for refpuzzle.com after 2027-06-01.
// The app was Refpuzzle on refpuzzle.com; it is now This Quiz on thisquiz.app.
// Both hosts serve this same build until refpuzzle.com closes.

export const NEW_ORIGIN = "https://thisquiz.app";
/** The route that takes a device's storage, packed into the hash. */
export const IMPORT_PATH = "/import";

/** From this day the banner warns of the close. */
export const URGENT_FROM = "2027-01-01";
/** From this day the old host sends every visit on to the new one. */
export const CLOSES_ON = "2027-03-31";

export type MovePhase = "move" | "urgent" | "closed";

/** Where the move stands on `today`, a `YYYY-MM-DD` date. */
export function movePhase(today: string): MovePhase {
  if (today >= CLOSES_ON) return "closed";
  if (today >= URGENT_FROM) return "urgent";
  return "move";
}

export function isLegacyHost(hostname: string): boolean {
  return hostname === "refpuzzle.com";
}

/** The backup file's shape, as the import reads it. */
export interface StoredBackup {
  version: 1;
  puzzles: Record<string, string>;
  stars?: unknown;
  streak?: unknown;
  adventureReached?: number;
}

function parsed(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Storage entries, keyed without the app prefix, split into what merges the
 * way an import does and the settings, which only fill gaps.
 */
export function sortStoredKeys(entries: Record<string, string>): {
  backup: StoredBackup;
  settings: Record<string, string>;
} {
  const backup: StoredBackup = { version: 1, puzzles: {} };
  const settings: Record<string, string> = {};
  for (const [name, value] of Object.entries(entries)) {
    if (name.startsWith("puzzle:")) backup.puzzles[name.slice("puzzle:".length)] = value;
    else if (name === "stars") backup.stars = parsed(value);
    else if (name === "streak") backup.streak = parsed(value);
    else if (name === "adventure-reached") backup.adventureReached = Number(value);
    else settings[name] = value;
  }
  return { backup, settings };
}

/** Whether the backup holds anything a new device would miss. */
export function holdsProgress(backup: StoredBackup): boolean {
  return (
    Object.keys(backup.puzzles).length > 0 ||
    (Array.isArray(backup.stars) && backup.stars.length > 0) ||
    backup.streak !== undefined ||
    (backup.adventureReached ?? 0) > 0
  );
}

/** A path on `origin` to land on; anything else is the front page. */
export function landingPath(path: unknown, origin: string): string {
  if (typeof path !== "string" || !path.startsWith("/")) return "/";
  try {
    // Parsed, since the parser drops tabs and newlines a pattern would miss.
    const url = new URL(path, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
