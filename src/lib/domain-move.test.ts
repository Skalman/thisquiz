// Remove support for refpuzzle.com after 2027-06-01.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isLegacyHost, sortStoredKeys } from "./domain-move.ts";

test("the old host is refpuzzle.com alone", () => {
  assert.ok(isLegacyHost("refpuzzle.com"));
  assert.ok(!isLegacyHost("www.refpuzzle.com"));
  assert.ok(!isLegacyHost("thisquiz.app"));
  assert.ok(!isLegacyHost("notrefpuzzle.com"));
  assert.ok(!isLegacyHost("localhost"));
});

test("progress sorts into the backup, everything else into the settings", () => {
  const { backup, settings } = sortStoredKeys({
    "puzzle:/daily/2026-10-01/3": "v1|s",
    stars: '["/daily/2026-10-01/3"]',
    streak: '{"last":"2026-10-01","length":2}',
    "adventure-reached": "7",
    theme: "dark",
    tutorial: "1",
  });
  assert.deepEqual(backup, {
    version: 1,
    puzzles: { "/daily/2026-10-01/3": "v1|s" },
    stars: ["/daily/2026-10-01/3"],
    streak: { last: "2026-10-01", length: 2 },
    adventureReached: 7,
  });
  assert.deepEqual(settings, { theme: "dark", tutorial: "1" });
});

test("unreadable stars and streak drop out instead of failing the move", () => {
  const { backup } = sortStoredKeys({ stars: "[oops", streak: "" });
  assert.equal(backup.stars, undefined);
  assert.equal(backup.streak, undefined);
});

test("refpuzzle.com has closed: remove the domain move (see domain-move.ts)", () => {
  assert.ok(new Date().toISOString().slice(0, 10) < "2027-06-01");
});
