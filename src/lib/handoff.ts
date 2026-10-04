// Remove support for refpuzzle.com after 2027-06-01.
import { applyImport, planImport } from "./backup.ts";
import { isLegacyHost, sortStoredKeys } from "./domain-move.ts";

// Carries a device's storage from refpuzzle.com to thisquiz.app.

const PREFIX = "thisquiz:";
const LEGACY_PREFIX = "refpuzzle:";

/** Storage under `prefix`, keyed without it. */
function readEntries(prefix: string): Record<string, string> {
  const entries: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) entries[key.slice(prefix.length)] = value;
    }
  } catch {
    /* storage unavailable */
  }
  return entries;
}

/** Writes each setting this device doesn't hold yet. */
export function fillSettings(settings: Record<string, string>): void {
  try {
    for (const [name, value] of Object.entries(settings)) {
      if (localStorage.getItem(PREFIX + name) === null) localStorage.setItem(PREFIX + name, value);
    }
  } catch {
    /* storage unavailable */
  }
}

/**
 * Moves storage written under the old name onto the current keys, merged the
 * way an import is. Runs every boot on the old host and in development, since
 * a tab still on the old build can write old keys after the move.
 */
export function moveLegacyKeys(): void {
  if (!isLegacyHost(window.location.hostname) && !import.meta.env.DEV) return;
  const entries = readEntries(LEGACY_PREFIX);
  const names = Object.keys(entries);
  if (names.length === 0) return;
  try {
    const { backup, settings } = sortStoredKeys(entries);
    applyImport(planImport(JSON.stringify(backup)));
    fillSettings(settings);
    for (const name of names) localStorage.removeItem(LEGACY_PREFIX + name);
  } catch {
    /* storage unavailable */
  }
}
