// Remove support for refpuzzle.com after 2027-06-01.
// The app was Refpuzzle on refpuzzle.com; it is now This Quiz on thisquiz.app.
// Both hosts serve this same build until refpuzzle.com closes.

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
