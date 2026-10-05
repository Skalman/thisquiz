// Remove support for refpuzzle.com after 2027-06-01.
import { getClientInfo, track } from "./analytics.ts";
import { applyImport, planImport, type ImportPlan } from "./backup.ts";
import { packText, unpackText } from "./compress.ts";
import { legacyHostPreview, setLegacyHostPreview } from "./debug.ts";
import {
  IMPORT_PATH,
  NEW_ORIGIN,
  holdsProgress,
  isLegacyHost,
  landingPath,
  movePhase,
  sortStoredKeys,
  type MovePhase,
} from "./domain-move.ts";
import { todayDateStr } from "../puzzles/daily.ts";

// Carries a device's storage from refpuzzle.com to thisquiz.app.

const PREFIX = "thisquiz:";
const LEGACY_PREFIX = "refpuzzle:";

/** Whether this page is on the old site, or previewing it from the Debug dialog. */
export function onLegacyHost(): boolean {
  return isLegacyHost(window.location.hostname) || legacyHostPreview() !== null;
}

/** Where the move stands today, or as the Debug dialog previews it. */
export function currentPhase(): MovePhase {
  return legacyHostPreview() ?? movePhase(todayDateStr());
}

/** The new site; a preview stays on this one, so the import can be tried. */
function newOrigin(): string {
  return legacyHostPreview() === null ? NEW_ORIGIN : window.location.origin;
}

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
  if (!onLegacyHost() && !import.meta.env.DEV) return;
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

/** Whether this device holds progress a move would carry. */
export function hasProgressToMove(): boolean {
  return holdsProgress(sortStoredKeys(readEntries(PREFIX)).backup);
}

/** Marks a payload sent uncompressed; packed text never starts with it. */
const PLAIN_MARK = "~";

/** The payload for the hash: packed, or plain where the browser can't compress. */
async function encodePayload(json: string): Promise<string> {
  try {
    return await packText(json);
  } catch {
    return PLAIN_MARK + encodeURIComponent(json);
  }
}

/** This page on the new site, carrying this device's storage when it has any. */
export async function handoffUrl(): Promise<string> {
  const path = window.location.pathname + window.location.search + window.location.hash;
  const keys = readEntries(PREFIX);
  if (Object.keys(keys).length === 0) return newOrigin() + path;
  return `${newOrigin()}${IMPORT_PATH}#${await encodePayload(JSON.stringify({ path, keys }))}`;
}

/**
 * Sends the visit on to the new site when there's nothing to keep here, or
 * the old site has closed. True when it does, so the app doesn't start.
 */
export function leaveLegacyHost(): boolean {
  if (!onLegacyHost() || window.location.pathname === IMPORT_PATH) return false;
  const phase = currentPhase();
  if (phase !== "closed" && hasProgressToMove()) return false;
  track("domain_move", { via: "auto", phase, ...getClientInfo() });
  void handoffUrl().then((url) => {
    // A preview leaves once, so it doesn't loop on its own origin.
    if (legacyHostPreview() !== null) setLegacyHostPreview(null);
    window.location.replace(url);
  });
  return true;
}

export interface Handoff {
  plan: ImportPlan;
  settings: Record<string, string>;
  /** The page to land on once the import is done. */
  path: string;
}

/** The storage a handoff link's hash carries; rejects on anything else. */
export async function readHandoff(packed: string): Promise<Handoff> {
  const json = packed.startsWith(PLAIN_MARK)
    ? decodeURIComponent(packed.slice(PLAIN_MARK.length))
    : await unpackText(packed);
  const data: unknown = JSON.parse(json);
  if (typeof data !== "object" || data === null || !("keys" in data)) {
    throw new Error("Invalid handoff");
  }
  if (typeof data.keys !== "object" || data.keys === null) throw new Error("Invalid handoff");
  const keys = Object.fromEntries(
    Object.entries(data.keys).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const { backup, settings } = sortStoredKeys(keys);
  return {
    plan: planImport(JSON.stringify(backup)),
    settings,
    path: landingPath("path" in data ? data.path : undefined, window.location.origin),
  };
}
