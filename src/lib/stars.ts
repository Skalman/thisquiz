/**
 * The stars earned: one per puzzle solved without hints, kept apart from the
 * board, so clearing a board to play it again keeps its star.
 */

const STARS_KEY = "refpuzzle:stars";

/** The ids of the puzzles with a star. */
export function loadStars(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STARS_KEY) ?? "[]");
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is string => typeof id === "string"));
    }
  } catch {}
  return new Set();
}

/** Adds stars for `ids`; one already held stays as it is. */
export function addStars(ids: Iterable<string>): void {
  const stars = loadStars();
  for (const id of ids) stars.add(id);
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify([...stars].sort()));
  } catch {}
}
