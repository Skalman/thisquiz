# Glossary

The vocabulary the codebase is written in, on both sides of the wasm boundary. The Rust
types named here live in `rust/src/types.rs`.

A puzzle is a grid: `n` **questions** down, `option_count` **options** across.

- **question** — one numbered row, `#1`..`#n`; indexed by `qi`. Carries a question type
  and its options.
- **option** — one lettered choice a question offers, `A`..`E`; indexed by `oi`.
- **cell** — one *question × option* square of the grid, `(qi, oi)` — the thing a player
  marks. `n * option_count` cells in all.

  Never a synonym for a question. A question runs out of options; a cell does not
  "empty". A force resolves a question, not a cell. Say "question" unless both
  coordinates are meant. The frontend keeps the distinction explicit — a row
  carries `data-row`, a cell `data-qi` and `data-oi`.
- **row** — all of one question's cells. Frontend term (the grid line a question
  occupies); Rust just says "question".
- **answer** — the option a question resolves to, as a letter: `Answer`.
- **option value** — `OptionValue`: what an option *means* rather than what letter it is.
  A number — a question index, a count, a letter index, a distance, depending on the
  question type — or `NONE` for "no such question".
- **option label kind** — `render::OptionLabelKind`: what an option's label stands for —
  a letter, a question, a count, a consecutive pair, a `TrueStmt` option's claim, or
  no value (`NONE`), labeled "None". Sent with the rendered board so the frontend can
  decorate labels.
- **mark** — what the player has put on a cell: correct, incorrect, or blank. The engine
  sees marks as `State`'s `answers` (one per question) plus `eliminated` (a bitmask of
  options per question); `deriveState()` in `src/engine/state.ts` does the conversion.
- **eliminate** — rule one option out of a question, setting its `eliminated` bit.
  "Struck out" and "removed" mean the same thing; prefer *eliminate*.
- **force** — conclude that a question must take a given answer.
- **claim** — the proposition an option asserts if chosen: `Claim`, a question type plus
  a value. Every option makes one; a `TrueStmt` option makes someone else's.
- **question type** — `QuestionType`: the kind *with* its parameters, e.g.
  `CountAnswer { answer: B }`. This is what a claim compares against.
- **question type kind** — `QuestionTypeKind`: the same thing with parameters stripped,
  e.g. `CountAnswer`. Used for per-kind tables and coverage counts.
- **board** / **state** — `State`: the answers and eliminations, nothing else. The puzzle
  itself is a `FlatPuzzle`, which never changes during a solve.
- **checkpoint** — a history step that changes no marks, planted only when the board
  matches the key. Its marks are then verified, so they lock: clicking one refuses and
  flashes rather than changing it. Rewinding past the pin unlocks them, at the cost of
  the checkpoint. A safe rewind target, and the boundary the history track collapses at.
  Frontend-only.
- **marker** — a hint or refused-checkpoint record attached to a history step. Sits
  where the event happened; when a rewrite discards its step it folds onto the last
  surviving step instead of vanishing, so rewinding never erases the record. A hint
  marker carries the deepest hint level reached and the question the hint named; a
  fail marker carries the count of refusals and the questions they caught.
  Either may name no question.
- **flags** / **counters** — the two halves of the stored ledger. The flags (`s`
  solved, `st` stale) lead it and say where the puzzle stands; the counters follow
  and accumulate while solving. `docs/encoding.md` has the tokens.
- **level progress** — how far along one level of a day is, as its tab and archive rail
  show it: *stale* (solved, but the puzzle has since changed), *solved*, *started*, or
  untouched. Stale outranks solved, solved outranks started. `levelProgress()` in
  `src/puzzles/progress.ts`; the tabs expose it as `data-progress`. Frontend-only.
- **outcome** — how one question went, for the shared result: *clean* (answered with
  no help), *hinted* (a hint named it), or *caught* (a refused checkpoint named it).
  Read off the markers' questions, so a question no marker named stays clean.
  A catch outranks a hint on the same question.
- **perfect** — every question clean. The result card then adds the all-green
  caption under the squares. *Clean* is about one question, *perfect* the board.
- **nudge** — an idle callout pointing at Checkpoint or Hint for a solver who is
  active but stuck. Daily puzzles only.
- **tutorial** — the guided walk at `/tutorial`: a lone cell pressed through its
  marks, then a few tiny fixed puzzles, each a short script of steps.
  Frontend-only.
- **result card** — the shareable picture of a solve: level, day, time, and one
  square per question in its outcome's color.
- **completion bar** — the row of ways onward that replaces the controls in the dock
  once the board is solved: Play again, Summary, and Next puzzle or Archive; in the
  Adventure, Play again and Continue to the map.
- **section** — one part of the app with its own look: the overview (`/`), the
  tutorial, the Adventure (`/adventure`), and the daily puzzles (`/daily`). The daily
  pages are zen; every other section is play. Unrelated to the `text-section` type size
  and the HTML `<section>` element. The overview shows a **window** onto the Adventure
  and the daily puzzles.
- **Adventure** — an endless path of **steps**, unlocked in turn. Each step offers one
  small puzzle per **size** joined so far: 2×2, then 2×3 from step 30, 3×2 from 60,
  3×3 from 100. Solving any one completes the step. A size is written options ×
  questions, as the grid is wide and tall, and that's also its **size key** (`3x2` is
  2 questions of 3 options). The puzzles come from one list per size
  (`public/puzzles/adventure.json`, from `refpuzzle gen adventure`). Hint is the only
  tool; a solve without hints earns that puzzle's **star**, kept through a replay.
- **step** — on its own, one of the Adventure's. Elsewhere it's always qualified: a
  **history step** (one entry in a board's history), a **tutorial step** (one part of
  a tutorial puzzle's script) or a **hint step** (one level of a hint).
- **world** — a hundred steps of the Adventure on a **map** of its own. Steps count
  along the whole path, so World 2 runs from 101 to 200. Finishing a world earns a
  **diamond** and unlocks the next.
- **step status** — **locked** (not reached yet), **next** (the **reached** step: the
  furthest one unlocked), or **done** (before it).
- **last played** — the step the player last played, kept for the tab's session; the map
  **rings** it. The overview's strip of steps rings the reached step instead.
- **expanded** — a step with more than one size, pressed: its sizes show around it,
  over the path, until a press elsewhere or Escape.
- **streak** — days in a row, by the device's date, with any puzzle solved, except in
  the tutorial and the playground.

## Related

- `docs/engine.md` — what each module does.
- `docs/engine-details.md` — the deduce rules and lookahead in detail.
- `docs/encoding.md` — the saved-state / share-URL string format (v0 and v1).
