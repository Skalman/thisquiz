import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "preact/hooks";
import { tinykeys } from "tinykeys";
import type { Puzzle } from "../engine/types.ts";
import { FRESH_MARKS, LETTERS } from "../engine/types.ts";
import { deriveState, isValid, V_NEUTRAL } from "../engine/state.ts";
import type { Validity } from "../engine/state.ts";
import { findMistake } from "../engine/mistake.ts";
import { wasmReady, createPuzzleHandle, type PuzzleHandle } from "../lib/wasm.ts";
import { loadState, saveState, loadMeta, cloneStates } from "../lib/store.ts";
import type { FailMarker, HintMarker, QuestionState } from "../lib/store.ts";
import { decodeShareHash, getPuzzleUrl } from "../lib/share.ts";
import { guarded, initRovingTabindex } from "../lib/keyboard.ts";
import { debugEnabled } from "../lib/debug.ts";
import { track, getClientInfo } from "../lib/analytics.ts";
import { extendStreak } from "../lib/streak.ts";
import { t } from "../i18n/index.ts";
import { QuestionRow } from "./QuestionRow.tsx";
import type { SweepKind } from "./OptionButton.tsx";
import {
  HistoryStrip,
  ENABLED_HISTORY_STEP,
  describeDiff,
  lastCheckpointIdx,
} from "./HistoryStrip.tsx";
import { questionOutcomes, storedSolveStats } from "../lib/solve-summary.ts";
import { TutorialArrow } from "./TutorialArrow.tsx";
import { IconStar } from "./Icons.tsx";
import { NudgeCallout } from "./NudgeCallout.tsx";
import { useForceUpdate, useVisibleTimeout } from "../lib/hooks.ts";
import { useAnalytics, type TrackedPuzzle } from "./useAnalytics.ts";
import { useHintEngine } from "./useHintEngine.ts";
import { PuzzleShareDialog, type ShareMode } from "./PuzzleShareDialog.tsx";
import { SolvedDialog } from "./SolvedDialog.tsx";
import { useIdleNudge } from "./useIdleNudge.ts";
import { useTutorial } from "./useTutorial.ts";
import { confetti } from "../lib/confetti.ts";
import { TutorialNext, TutorialPanel, type TutorialDestination } from "./TutorialPanel.tsx";
import { rememberTutorialOpener, type TutorialPuzzle } from "../puzzles/tutorial.ts";
import { ButtonLink } from "./ui/Button.tsx";
import {
  CheckpointNote,
  CompletionBar,
  DebugHintPanel,
  HintPanel,
  ENABLED_CONTROL,
  PuzzleControls,
} from "./PuzzleDock.tsx";
import { LEVELS, todayDateStr } from "../puzzles/daily.ts";
import { useDesign } from "./DesignContext.tsx";
import { classNames, tw } from "../lib/classNames.ts";
import type { Design } from "../lib/design.ts";

/** A short board: one centered column. */
const SHORT_BOARD = tw`mx-auto py-4 *:last:border-b-0`;

/** A short board's width once wide; the Adventure's dock keeps to it too. */
const SHORT_WIDTH: Record<Design, string> = {
  zen: tw`lg:max-w-[min(50%,25rem)]`,
  play: tw`xl:max-w-[min(50%,25rem)]`,
};

/** The question grid; play's goes two-column at a wider width. */
const BOARD_GRID: Record<Design, { short: string; long: string }> = {
  zen: {
    short: classNames(tw`lg:grid lg:grid-cols-1`, SHORT_WIDTH.zen),
    long: tw`lg:grid lg:grid-flow-col lg:grid-cols-2 lg:gap-x-6`,
  },
  play: {
    short: classNames(tw`xl:grid xl:grid-cols-1`, SHORT_WIDTH.play),
    long: tw`xl:grid xl:grid-flow-col xl:grid-cols-2 xl:gap-x-6`,
  },
};

/** The mark shortcuts, one per option letter. */
const OPTION_KEYS = LETTERS.map((letter) => letter.toLowerCase());

/** Sweep duration: longest animation, stagger and slack. */
const SWEEP_MS = 1000;

/** The longest stagger in a sweep: the far corner's delay, in ms. */
const SWEEP_STAGGER_MS = 450;

/** How long a granted checkpoint's note stays up while the tab is visible. */
const NOTE_MS = 25_000;

/** Sweep geometry: board span, each cell's diagonal offset and delay. */
function placeSweep(grid: HTMLElement) {
  const cells = Array.from(grid.querySelectorAll<HTMLElement>("[data-sweep]"));
  const diagonals = cells.map((cell) => {
    const { left, top } = cell.getBoundingClientRect();
    return left + top;
  });
  const first = Math.min(...diagonals);
  const { width, height } = grid.getBoundingClientRect();
  const span = width + height;
  grid.style.setProperty("--sweep-span", `${span}px`);
  cells.forEach((cell, i) => {
    const distance = diagonals[i] - first;
    cell.style.setProperty("--sweep-d", `${distance}px`);
    cell.style.setProperty(
      "--sweep-delay",
      `${Math.round((distance / span) * SWEEP_STAGGER_MS)}ms`,
    );
  });
}

/** A blank board: every question with every option unmarked. */
function freshBoard(puzzle: Puzzle): QuestionState[] {
  return puzzle.questions.map(() => ({ marks: [...FRESH_MARKS] }));
}

/**
 * Where this mount picks up: a shared board from the URL, the stored one, or a
 * blank board with a one-step track. Read once — playground mode never touches
 * the store, and a different puzzle arrives as a fresh mount, not new props.
 *
 * A link brings the sharer's markers along with the board. They record someone
 * else's hints and refusals, so the board is adopted and the markers dropped —
 * every later save and summary on this device then counts only what's earned
 * here.
 */
function initialBoardState(
  puzzle: Puzzle,
  initialHash: string | null | undefined,
  ephemeral: boolean | undefined,
) {
  const questionCount = puzzle.questions.length;
  const saved = initialHash
    ? decodeShareHash(initialHash, questionCount)
    : ephemeral
      ? null
      : loadState(puzzle.id, questionCount);
  if (saved && saved.history.length > 0) {
    return initialHash
      ? { ...saved, hints: new Map<number, HintMarker>(), fails: new Map<number, FailMarker>() }
      : saved;
  }
  const blank = freshBoard(puzzle);
  return {
    questions: blank,
    completed: false,
    stale: false,
    history: [cloneStates(blank)],
    historyIdx: 0,
    hints: new Map<number, HintMarker>(),
    fails: new Map<number, FailMarker>(),
  };
}

interface PuzzleViewProps {
  puzzle: Puzzle;
  dateStr: string;
  level: number;
  initialHash?: string | null;
  /** Playground mode: render from the URL only, never touch localStorage. */
  ephemeral?: boolean;
  /** Filled with the view's share dialog, for the page's Share menu item to open. */
  shareRef?: { current: { open: () => void } | null };
  /** Tutorial mode: only the step's cells take presses; controls, history and hints are off. */
  tutorial?: {
    puzzle: TutorialPuzzle;
    /** Destinations in place of Next, each its own button. */
    destinations?: TutorialDestination[];
    onSolved: () => void;
  };
  /** Adventure mode: Hint is the only tool, and a solve leads back to the map. */
  adventure?: {
    /** The map the puzzle is on. */
    mapPath: string;
    /** Whether an earlier solve earned this puzzle its star. */
    starred: boolean;
    onSolved: (withoutHints: boolean) => void;
  };
  onNextPuzzle: () => void;
  onChanged: () => void;
}

export function PuzzleView({
  puzzle,
  dateStr,
  level,
  initialHash,
  ephemeral,
  shareRef,
  tutorial,
  adventure,
  onNextPuzzle,
  onChanged,
}: PuzzleViewProps) {
  const s = t();
  const design = useDesign();
  const debugMode = debugEnabled();

  // Ephemeral (playground) mode persists nothing: the puzzle is fully described
  // by the URL. Gating the saveState calls is sufficient — saveMeta / loadMeta
  // all no-op without an existing entry, and loadState returns null, so no
  // other store touchpoint can write.

  // Resolved before the first paint, so the stored board never flickers in.
  const [initState] = useState(() => initialBoardState(puzzle, initialHash, ephemeral));

  const inAdventure = adventure !== undefined;
  // How events name the puzzle; the tutorial sends none.
  const trackedPuzzle = useMemo<TrackedPuzzle>(
    () =>
      inAdventure
        ? { puzzleId: puzzle.id, mode: "adventure" }
        : ephemeral
          ? { puzzleId: puzzle.id, mode: "playground" }
          : { puzzleId: puzzle.id, mode: "daily", level },
    [inAdventure, ephemeral, puzzle.id, level],
  );
  const analytics = useAnalytics({
    trackedPuzzle,
    initialHash,
    initStarted: initState.history.length > 1,
    initCompleted: initState.completed,
  });
  // Stable, so the callbacks below can depend on them rather than the whole hook.
  const { persist: persistMeta, finish: finishClock } = analytics;

  const [questions, setQuestionsRaw] = useState<QuestionState[]>(initState.questions);
  const questionsRef = useRef<QuestionState[]>(initState.questions);
  function setQuestions(qs: QuestionState[]) {
    questionsRef.current = qs;
    setQuestionsRaw(qs);
  }
  const [validity, setValidity] = useState<Validity[]>(() =>
    new Array(initState.questions.length).fill(V_NEUTRAL),
  );
  const handleRef = useRef<PuzzleHandle | null>(null);
  const [handleReady, setHandleReady] = useState(false);
  useEffect(() => {
    let canceled = false;
    void (async () => {
      await wasmReady();
      if (canceled) return;
      const handle = createPuzzleHandle(puzzle.compact, puzzle.id);
      handleRef.current = handle;
      const initial = handle.checkAllAnswers(
        questionsRef.current.map((q) => q.marks),
        puzzle.optionCount,
      );
      setValidity(initial);
      setHandleReady(true);
    })();
    return () => {
      canceled = true;
      handleRef.current?.free();
      handleRef.current = null;
      setHandleReady(false);
    };
  }, [puzzle]);
  // The undo stack lives in refs, not state: `foldMarkers` and `pushHistory`
  // rewrite it in place, and render reads it directly for the toolbar's enabled
  // set. `forceHistoryUpdate` is what repaints after a mutation.
  const historyRef = useRef<QuestionState[][]>(initState.history);
  const historyIdxRef = useRef(initState.historyIdx);
  const forceHistoryUpdate = useForceUpdate();

  const tabStateRef = useRef({
    started: initState.history.length > 1,
    completed: initState.completed,
    stale: initState.stale,
  });
  // Whether this session made any local change. v1 share URLs carry no
  // completed flag — completion is derived once wasm loads — so this is what
  // separates "you solved it" from "it arrived solved".
  const interactedRef = useRef(false);
  /**
   * A board can arrive already complete without being recorded as such — a
   * shared board that's solved, or a save predating a format change — and only
   * wasm can tell. The verdict is read once, off the board as it arrived: left
   * reacting to live validity it would fire again the moment the player solves,
   * writing this mount snapshot over the history they just built.
   */
  const arrivalRecorded = useRef(false);
  useEffect(() => {
    if (arrivalRecorded.current || ephemeral || !handleReady) return;
    arrivalRecorded.current = true;
    if (interactedRef.current || initState.completed) return;
    if (!validity.every(isValid)) return;
    saveState(puzzle.id, { ...initState, completed: true, stale: false });
    onChanged();
  }, [handleReady, validity, initState, puzzle.id, onChanged, ephemeral]);
  const historyBurstRef = useRef({ lastTime: 0 });

  function trackHistoryBurst() {
    const now = Date.now();
    if (now - historyBurstRef.current.lastTime > 15_000) {
      analytics.update((m) => m.historyBursts++);
    }
    historyBurstRef.current.lastTime = now;
  }

  /**
   * The Checkpoint button's verdict. Shares the hint's slot; only one speaks.
   * Goes on the next board change, a click, or after a stretch on screen.
   */
  const [checkpointNote, setCheckpointNote] = useState<string | null>(null);
  useVisibleTimeout(checkpointNote, NOTE_MS, () => setCheckpointNote(null));

  const [shareMode, setShareMode] = useState<ShareMode | null>(null);
  // Remounts the sheet, so a press while it is open returns it to Puzzle.
  const [sharePress, setSharePress] = useState(0);
  useEffect(() => {
    if (!shareRef) return undefined;
    shareRef.current = {
      open: () => {
        setShareMode("puzzle");
        setSharePress((n) => n + 1);
      },
    };
    return () => {
      shareRef.current = null;
    };
  }, [shareRef]);
  // Celebrating the solve just made, or summarizing a stored one from the bar.
  const [solvedDialog, setSolvedDialog] = useState<"celebrate" | "summary" | null>(null);

  const [focusedQuestion, setFocusedQuestionRaw] = useState<number | null>(null);
  const [focusedOption, setFocusedOptionRaw] = useState<number | null>(null);
  const focusedQuestionRef = useRef<number | null>(null);
  const focusedOptionRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const nextPuzzleRef = useRef<HTMLElement | null>(null);
  const setNextPuzzleRef = useCallback((el: HTMLElement | null) => {
    nextPuzzleRef.current = el;
  }, []);
  const puzzleCompleteRef = useRef<HTMLDivElement>(null);
  // The two buttons a nudge can point at.
  const checkpointBtnRef = useRef<HTMLButtonElement>(null);
  const hintBtnRef = useRef<HTMLButtonElement>(null);
  const numberBuf = useRef({ digits: "", timer: 0 });
  const controlsRef = useRef<HTMLDivElement>(null);
  const historyStripRef = useRef<HTMLDivElement>(null);

  function setFocusedQuestion(v: number | null) {
    focusedQuestionRef.current = v;
    setFocusedQuestionRaw(v);
  }
  function setFocusedOption(v: number | null) {
    focusedOptionRef.current = v;
    setFocusedOptionRaw(v);
  }

  /**
   * Markers on steps a history rewrite discards fold onto the branch point —
   * the step just before the newly added one — rather than being deleted, so
   * no rewind can erase the record. Refusal counts add up and their questions
   * union; hint markers keep the deepest level reached, since that's what the
   * value means, and the earlier marker's question stands.
   */
  function foldMarkers(branchIdx: number) {
    for (const [key, hint] of [...hintMarkers.current]) {
      if (key <= branchIdx) continue;
      hintMarkers.current.delete(key);
      const onto = hintMarkers.current.get(branchIdx);
      hintMarkers.current.set(branchIdx, {
        level: Math.max(onto?.level ?? 0, hint.level),
        qi: onto?.qi ?? hint.qi,
      });
    }
    for (const [key, fail] of [...failMarkers.current]) {
      if (key <= branchIdx) continue;
      failMarkers.current.delete(key);
      const onto = failMarkers.current.get(branchIdx);
      failMarkers.current.set(branchIdx, {
        count: (onto?.count ?? 0) + fail.count,
        qis: [...new Set([...(onto?.qis ?? []), ...fail.qis])],
      });
    }
  }

  function pushHistory(qs: QuestionState[]) {
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    historyRef.current = h.slice(0, idx + 1);
    foldMarkers(idx);

    const cloned = cloneStates(qs);
    if (historyRef.current.length >= 2) {
      const prev = historyRef.current[historyRef.current.length - 2];
      const last = historyRef.current[historyRef.current.length - 1];
      const lastDiff = describeDiff(prev, last);
      const newDiff = describeDiff(last, cloned);
      if (lastDiff.qi >= 0 && lastDiff.qi === newDiff.qi && lastDiff.oi === newDiff.oi) {
        const merged = describeDiff(prev, cloned);
        if (merged.qi < 0) {
          // The step un-did itself out of existence; its markers slide back too.
          historyRef.current.pop();
          historyIdxRef.current = historyRef.current.length - 1;
          foldMarkers(historyIdxRef.current);
        } else {
          historyRef.current[historyRef.current.length - 1] = cloned;
        }
        forceHistoryUpdate();
        return;
      }
    }

    historyRef.current.push(cloned);
    historyIdxRef.current = historyRef.current.length - 1;
    forceHistoryUpdate();
  }

  const hintMarkers = useRef<Map<number, HintMarker>>(initState.hints);
  /**
   * Refused checkpoint presses, keyed by the step the press landed on. History
   * rewrites can't shake them off — `foldMarkers` slides them onto the branch
   * point instead of deleting them. `meta.checkpointFails` tallies the same
   * presses monotonically for scoring.
   */
  const failMarkers = useRef<Map<number, FailMarker>>(initState.fails);

  // Markers move while the board stands still, so `revalidate` never runs for
  // them — they save here instead. Completion and staleness are the board's, so
  // they carry over from the last sweep.
  function saveMarkers() {
    if (ephemeral) return;
    saveState(puzzle.id, {
      questions: questionsRef.current,
      completed: tabStateRef.current.completed,
      stale: tabStateRef.current.stale,
      history: historyRef.current,
      historyIdx: historyIdxRef.current,
      hints: hintMarkers.current,
      fails: failMarkers.current,
    });
  }

  function pushFailMarker(qi: number) {
    const map = failMarkers.current;
    const idx = historyIdxRef.current;
    const at = map.get(idx);
    map.set(idx, {
      count: (at?.count ?? 0) + 1,
      qis: [...new Set([...(at?.qis ?? []), qi])],
    });
    analytics.update((m) => m.checkpointFails++);
    saveMarkers();
    forceHistoryUpdate();
  }

  function pushHintMarker(hintLevel: number, qi: number | null) {
    const map = hintMarkers.current;
    const idx = historyIdxRef.current;
    // Deepest level reached at this step — a fresh press never lowers a level
    // that folded here from rewritten history. The question is whichever a
    // step named first and stays put once set.
    const at = map.get(idx);
    map.set(idx, {
      level: Math.max(at?.level ?? 0, hintLevel),
      qi: at?.qi ?? qi,
    });
    analytics.update((m) => m.hints++);
    saveMarkers();
    forceHistoryUpdate();
  }

  const revalidate = useCallback(
    (qs: QuestionState[]) => {
      const handle = handleRef.current;
      const result: Validity[] = handle
        ? handle.checkAllAnswers(
            qs.map((q) => q.marks),
            puzzle.optionCount,
          )
        : new Array(qs.length).fill(V_NEUTRAL);
      setValidity(result);

      const isCompleted = result.every(isValid);
      // The board just faced the current puzzle version, so a solve retires the
      // stale flag; short of one, the flag stands as the last sweep left it.
      const nowStale = tabStateRef.current.stale && !isCompleted;
      if (!ephemeral) {
        saveState(puzzle.id, {
          questions: qs,
          completed: isCompleted,
          stale: nowStale,
          history: historyRef.current,
          historyIdx: historyIdxRef.current,
          hints: hintMarkers.current,
          fails: failMarkers.current,
        });
      }
      persistMeta();
      const nowStarted = historyRef.current.length > 1;
      if (
        nowStarted !== tabStateRef.current.started ||
        isCompleted !== tabStateRef.current.completed ||
        nowStale !== tabStateRef.current.stale
      ) {
        tabStateRef.current = { started: nowStarted, completed: isCompleted, stale: nowStale };
        onChanged();
      }
    },
    [puzzle, onChanged, persistMeta, ephemeral],
  );

  const completed = validity.length > 0 && validity.every(isValid);

  // The tutorial panel; its arrow starts here.
  const tutorialPanelRef = useRef<HTMLDivElement>(null);
  // Stable between marks, for the tutorial's memo.
  const boardMarks = useMemo(() => questions.map((q) => q.marks), [questions]);
  const script = useTutorial(tutorial?.puzzle ?? null, boardMarks, completed);

  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;

  const hints = useHintEngine(puzzle, {
    questionsRef,
    debugMode,
    pushHintMarker,
    completed,
    questions,
    handleRef,
  });

  function applyChange(next: QuestionState[]) {
    interactedRef.current = true;
    // Puzzle starts are tracked outside the tutorial.
    if (!tutorial) analytics.markStarted();
    pushHistory(next);
    setQuestions(next);
    revalidate(next);
    hints.clear();
    setCheckpointNote(null);
  }

  /**
   * The board the last checkpoint at or behind the cursor verified, or null.
   * Every mark on it is known correct, so those cells are locked; rewinding
   * past the pin unlocks them (and marking there discards it).
   */
  function checkpointBoard(): QuestionState[] | null {
    const cpIdx = lastCheckpointIdx(historyRef.current, historyIdxRef.current);
    return cpIdx > 0 ? historyRef.current[cpIdx] : null;
  }

  /**
   * Cells playing the checkpointed sweep (see `.option-btn.sweep`), as a
   * per-question option bitmask: what a landing checkpoint just settled, or the
   * one cell a click bounced off. Cleared once the animation has run.
   */
  const [sweepMasks, setSweepMasks] = useState<number[] | null>(null);
  const [sweepKind, setSweepKind] = useState<SweepKind>("settle");
  // Bumped per press on the solved board.
  const [replayCue, setReplayCue] = useState(0);
  const sweepTimer = useRef(0);
  function playSweep(masks: number[], kind: SweepKind) {
    clearTimeout(sweepTimer.current);
    setSweepKind(kind);
    setSweepMasks(masks);
    sweepTimer.current = window.setTimeout(() => setSweepMasks(null), SWEEP_MS);
  }
  useEffect(() => () => clearTimeout(sweepTimer.current), []);
  // Layout effect: cells must be placed before the first frame paints.
  useLayoutEffect(() => {
    if (sweepMasks !== null && gridRef.current) placeSweep(gridRef.current);
  }, [sweepMasks]);

  /**
   * What the checkpoint at the cursor settled that the one before it hadn't.
   * A question with an answer contributes only that answer — its eliminations
   * are subsumed by it, so re-announcing them would be noise.
   */
  function newlySettledMasks(): number[] {
    const cpIdx = lastCheckpointIdx(historyRef.current, historyIdxRef.current);
    const prevIdx = lastCheckpointIdx(historyRef.current, cpIdx - 1);
    const prev = prevIdx > 0 ? historyRef.current[prevIdx] : null;
    return historyRef.current[cpIdx].map((q, qi) => {
      const isNew = (oi: number) => prev == null || prev[qi].marks[oi] === "unmarked";
      const answerOi = q.marks.indexOf("correct");
      if (answerOi >= 0) return isNew(answerOi) ? 1 << answerOi : 0;
      let mask = 0;
      for (let oi = 0; oi < puzzle.optionCount; oi++) {
        if (q.marks[oi] === "incorrect" && isNew(oi)) mask |= 1 << oi;
      }
      return mask;
    });
  }

  function handleOptionClick(questionIdx: number, optionIdx: number) {
    setFocusedQuestion(questionIdx);
    setFocusedOption(optionIdx);
    // A cell the press can't change bounces it.
    const refuse = () =>
      playSweep(
        puzzle.questions.map((_q, qi) => (qi === questionIdx ? 1 << optionIdx : 0)),
        "refuse",
      );
    // Solved: the press points to Play again.
    if (completed) {
      refuse();
      setReplayCue((n) => n + 1);
      return;
    }
    // A tutorial press off its step bounces.
    if (script && !script.acceptsPress(questionIdx, optionIdx)) {
      refuse();
      return;
    }
    const verified = checkpointBoard();
    if (verified && verified[questionIdx].marks[optionIdx] !== "unmarked") {
      refuse();
      return;
    }
    const next = cloneStates(questionsRef.current);
    const q = next[questionIdx];
    const current = q.marks[optionIdx];
    const hasCorrect = q.marks.indexOf("correct") >= 0;
    if (hasCorrect && current !== "correct") {
      refuse();
      return;
    }

    if (current === "unmarked") {
      q.marks[optionIdx] = "incorrect";
    } else if (current === "incorrect") {
      const existingCorrect = q.marks.indexOf("correct");
      if (existingCorrect >= 0) q.marks[existingCorrect] = "unmarked";
      q.marks[optionIdx] = "correct";
    } else {
      q.marks[optionIdx] = "unmarked";
    }

    applyChange(next);
  }

  const optionClickRef = useRef(handleOptionClick);
  optionClickRef.current = handleOptionClick;
  const stableOptionClick = useCallback(
    (qi: number, oi: number) => optionClickRef.current(qi, oi),
    [],
  );

  function focusCurrentStep() {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    const diff = describeDiff(historyRef.current[idx - 1], historyRef.current[idx]);
    if (diff.qi >= 0) {
      setFocusedQuestion(diff.qi);
      setFocusedOption(diff.oi);
    }
  }

  function handleUndo() {
    if (historyIdxRef.current <= 0) return;
    trackHistoryBurst();
    historyIdxRef.current--;
    const qs = cloneStates(historyRef.current[historyIdxRef.current]);
    setQuestions(qs);
    revalidate(qs);
    hints.clear();
    setCheckpointNote(null);
    forceHistoryUpdate();
    focusCurrentStep();
  }

  function handleRedo() {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    trackHistoryBurst();
    historyIdxRef.current++;
    const qs = cloneStates(historyRef.current[historyIdxRef.current]);
    setQuestions(qs);
    revalidate(qs);
    hints.clear();
    setCheckpointNote(null);
    forceHistoryUpdate();
    focusCurrentStep();
  }

  function handleJumpTo(idx: number) {
    if (idx < 0 || idx >= historyRef.current.length) return;
    trackHistoryBurst();
    historyIdxRef.current = idx;
    const qs = cloneStates(historyRef.current[idx]);
    setQuestions(qs);
    revalidate(qs);
    hints.clear();
    setCheckpointNote(null);
    forceHistoryUpdate();
  }

  const hasProgress = historyRef.current.length > 1;
  // Nothing to verify on a blank board, and a checkpoint can't checkpoint itself.
  const canCheckpoint =
    historyIdxRef.current > 0 &&
    describeDiff(
      historyRef.current[historyIdxRef.current - 1],
      historyRef.current[historyIdxRef.current],
    ).qi >= 0;

  // Stored puzzles only; the Adventure's nudges are toward Hint alone.
  const nudge = useIdleNudge({
    enabled: !ephemeral && hasProgress && !completed,
    canCheckpoint: canCheckpoint && !adventure,
    progressKey: questions,
  });

  /**
   * Grant a checkpoint if nothing on the board contradicts the key. Marks the
   * last checkpoint verified are locked against editing, so a re-verified
   * range can only have grown — the one way to fail is a wrong new mark, which
   * lands a refusal marker and opens the mistake steps in the hint panel.
   */
  function handleSave() {
    const idx = historyIdxRef.current;
    if (idx < 1 || lastCheckpointIdx(historyRef.current, idx) === idx) return;
    const current = questionsRef.current;
    const marks = current.map((q) => q.marks);

    const { answers, eliminated } = deriveState(marks, puzzle.optionCount);
    const mistake = findMistake(answers, eliminated, hints.getSolution());
    if (mistake) {
      setCheckpointNote(null);
      pushFailMarker(mistake.qi);
      hints.showMistake(mistake, s.puzzle.checkpointWrong);
      return;
    }

    nudge.used("checkpoint");
    analytics.update((m) => m.checkpoints++);
    pushHistory(cloneStates(current));
    // The pin is only in the history ref until something else persists — commit
    // it now so a granted checkpoint survives a reload.
    revalidate(current);
    hints.clear();
    setCheckpointNote(s.puzzle.checkpointSet);
    // Announce what this checkpoint settled that the last one hadn't.
    playSweep(newlySettledMasks(), "settle");
  }

  /** Back to a blank board and an empty track — the solve, and its record, go. */
  function handlePlayAgain() {
    const fresh = freshBoard(puzzle);
    historyRef.current = [cloneStates(fresh)];
    historyIdxRef.current = 0;
    // Explicit, or the next mark's foldMarkers would pile them all onto Start.
    hintMarkers.current = new Map();
    failMarkers.current = new Map();
    setQuestions(fresh);
    revalidate(fresh);
    hints.clear();
    setCheckpointNote(null);
    setReplayCue(0);
    historyBurstRef.current.lastTime = 0;
    analytics.restart();
  }

  // Per-question bitmask of the cells the last checkpoint verified.
  const verifiedBoard = checkpointBoard();
  const checkpointedMasks = puzzle.questions.map((_q, qi) => {
    if (!verifiedBoard) return 0;
    let mask = 0;
    for (let oi = 0; oi < puzzle.optionCount; oi++) {
      if (verifiedBoard[qi].marks[oi] !== "unmarked") mask |= 1 << oi;
    }
    return mask;
  });

  function handleHint() {
    nudge.used("hint");
    hints.handleHint();
  }

  /** The board as it stands, for a progress link; null before the first mark. */
  function progressState() {
    if (!hasProgress) return null;
    return {
      questions,
      completed,
      stale: false,
      history: historyRef.current,
      historyIdx: historyIdxRef.current,
      hints: hintMarkers.current,
      fails: failMarkers.current,
    };
  }

  // Reports the solve and opens its summary.
  useEffect(() => {
    if (!completed || analytics.wasCompleted.current) return undefined;
    // Completion that predates any local change arrived via a share URL or
    // storage — someone else's solve. Acknowledge it, celebrate nothing.
    if (!interactedRef.current) {
      analytics.wasCompleted.current = true;
      return undefined;
    }
    // A tutorial solve reports to the tutorial.
    if (tutorial) {
      analytics.wasCompleted.current = true;
      confetti();
      tutorial.onSolved();
      return undefined;
    }
    // The counters stay on the ledger past the solve, for the summary; this
    // lands the last stretch of time.
    finishClock();
    const m = analytics.meta.current;
    track("puzzle_completed", {
      ...trackedPuzzle,
      elapsedS: m.elapsedS,
      sessions: m.sessions,
      // Zeroes drop to undefined.
      hints: m.hints || undefined,
      checkpoints: m.checkpoints || undefined,
      checkpointFails: m.checkpointFails || undefined,
      historyBursts: m.historyBursts || undefined,
      fromShared: m.fromShared || undefined,
      ...getClientInfo(),
    });
    if (!ephemeral) extendStreak(todayDateStr());
    // An Adventure solve celebrates on the board and leads on from the bar.
    if (adventure) {
      confetti();
      adventure.onSolved(hintMarkers.current.size === 0);
      return undefined;
    }
    setSolvedDialog("celebrate");
    return undefined;
  }, [
    completed,
    trackedPuzzle,
    analytics.meta,
    analytics.wasCompleted,
    finishClock,
    tutorial,
    adventure,
    ephemeral,
  ]);

  // Re-seed the toolbar's roving tabindex whenever its enabled set changes;
  // between those the arrow keys' own position stands.
  useEffect(() => {
    initRovingTabindex(controlsRef.current, ENABLED_CONTROL);
  }, [completed, canUndo, canRedo, canCheckpoint]);

  // The strip's buttons come and go with the history and with the range it has
  // collapsed, neither of which render declares — so this re-seeds every time.
  useEffect(() => {
    initRovingTabindex(historyStripRef.current, ENABLED_HISTORY_STEP);
  });

  // A tutorial puzzle takes focus as it appears, from the Next that led here.
  const inTutorial = tutorial !== undefined;
  useEffect(() => {
    if (!inTutorial) return;
    setFocusedQuestion(0);
    setFocusedOption(0);
  }, [inTutorial]);

  // Scroll focused question into view
  useEffect(() => {
    if (focusedQuestion == null) return;
    const row = gridRef.current?.querySelector(`[data-row="${focusedQuestion}"]`);
    if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedQuestion]);

  // Focus the active option button when focus state changes
  useEffect(() => {
    if (focusedQuestion == null || focusedOption == null) return;
    const btn = gridRef.current?.querySelector(
      `[data-qi="${focusedQuestion}"][data-oi="${focusedOption}"]`,
    );
    if (btn instanceof HTMLElement) btn.focus();
  }, [focusedQuestion, focusedOption]);

  const questionCount = puzzle.questions.length;

  function moveFocus(questionDelta: number, optionDelta: number) {
    const qi = focusedQuestionRef.current ?? 0;
    const oi = focusedOptionRef.current ?? 0;
    const nextQi = (qi + questionDelta + questionCount) % questionCount;
    let nextOi = (oi + optionDelta + puzzle.optionCount) % puzzle.optionCount;
    // When moving between questions, snap to the correct option if the
    // target option is disabled (another option is marked correct)
    if (questionDelta !== 0) {
      const marks = questionsRef.current[nextQi]?.marks;
      if (marks) {
        const correctIdx = marks.indexOf("correct");
        if (correctIdx >= 0) nextOi = correctIdx;
      }
    }
    setFocusedQuestion(nextQi);
    setFocusedOption(nextOi);
  }

  function navigateToQuestion(num: number) {
    if (num < 1 || num > questionCount) return;
    const qi = num - 1;
    setFocusedQuestion(qi);
    const marks = questionsRef.current[qi]?.marks;
    const correctIdx = marks?.indexOf("correct") ?? -1;
    setFocusedOption(correctIdx >= 0 ? correctIdx : (focusedOptionRef.current ?? 0));
  }

  function handleDigit(digit: number) {
    const buf = numberBuf.current;
    clearTimeout(buf.timer);
    buf.digits += String(digit);

    const parsed = parseInt(buf.digits, 10);

    if (buf.digits.length >= 2) {
      if (parsed >= 1 && parsed <= questionCount) {
        navigateToQuestion(parsed);
      } else {
        const first = parseInt(buf.digits[0], 10);
        if (first >= 1 && first <= questionCount) navigateToQuestion(first);
      }
      buf.digits = "";
      return;
    }

    // Single digit — immediately highlight if valid, even if we're still buffering
    if (parsed >= 1 && parsed <= questionCount) {
      setFocusedQuestion(parsed - 1);
      if (focusedOptionRef.current == null) setFocusedOption(0);
    }

    // Is it ambiguous? Only "1" on puzzles with 10+ questions
    if (digit * 10 <= questionCount) {
      buf.timer = window.setTimeout(() => {
        const d = parseInt(buf.digits, 10);
        if (d >= 1 && d <= questionCount) navigateToQuestion(d);
        buf.digits = "";
      }, 500);
    } else {
      if (parsed >= 1 && parsed <= questionCount) navigateToQuestion(parsed);
      buf.digits = "";
    }
  }

  // Grid keyboard navigation
  function handleGridKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveFocus(1, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-1, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveFocus(0, 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(0, -1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedQuestionRef.current != null && focusedOptionRef.current != null) {
          handleOptionClick(focusedQuestionRef.current, focusedOptionRef.current);
        }
        break;
    }
  }

  // The window shortcuts are bound once and outlive the render that armed them,
  // so they call the current handlers through a ref rather than re-binding
  // every one of them on every render.
  const keyActions = {
    markOption: handleOptionClick,
    digit: handleDigit,
    undo: handleUndo,
    redo: handleRedo,
    checkpoint: handleSave,
    moveFocus,
    hint: handleHint,
    completed,
    optionCount: puzzle.optionCount,
  };
  const keyActionsRef = useRef(keyActions);
  keyActionsRef.current = keyActions;

  useEffect(() => {
    // Every shortcut is inert once the board is solved.
    const whileSolving = (fn: (ev: KeyboardEvent) => void) =>
      guarded((ev) => {
        if (!keyActionsRef.current.completed) fn(ev);
      });
    // The browser's own undo stays out of the way whether or not the board is
    // still live, so this one preventDefaults ahead of the solved check.
    const undoRedo = (step: () => void) =>
      guarded((ev) => {
        ev.preventDefault();
        if (!keyActionsRef.current.completed) step();
      });

    const bindings: Record<string, (ev: KeyboardEvent) => void> = {
      j: whileSolving(() => keyActionsRef.current.moveFocus(1, 0)),
      k: whileSolving(() => keyActionsRef.current.moveFocus(-1, 0)),
      // The tutorial has no history, checkpoints or hints; the Adventure has hints alone.
      ...(inTutorial ? {} : { h: whileSolving(() => keyActionsRef.current.hint()) }),
      ...(inTutorial || inAdventure
        ? {}
        : {
            p: whileSolving(() => keyActionsRef.current.checkpoint()),
            "$mod+z": undoRedo(() => keyActionsRef.current.undo()),
            "$mod+Shift+z": undoRedo(() => keyActionsRef.current.redo()),
            "$mod+y": undoRedo(() => keyActionsRef.current.redo()),
          }),
    };
    // An option letter marks that option on the focused question, when the
    // puzzle has it; a digit feeds the question-number buffer.
    // Also live when solved, bouncing like a press.
    OPTION_KEYS.forEach((key, oi) => {
      bindings[key] = guarded(() => {
        const qi = focusedQuestionRef.current;
        const { markOption, optionCount } = keyActionsRef.current;
        if (qi != null && oi < optionCount) markOption(qi, oi);
      });
    });
    for (let digit = 0; digit <= 9; digit++) {
      bindings[String(digit)] = whileSolving(() => keyActionsRef.current.digit(digit));
    }
    return tinykeys(window, bindings);
  }, [inTutorial, inAdventure]);

  // What an Adventure solve's star rests on.
  const withoutHints = hintMarkers.current.size === 0;

  /** The hint and checkpoint notes, beside the controls. */
  const notes = (
    <>
      {!completed && debugMode && hints.debugHints && <DebugHintPanel steps={hints.debugHints} />}
      {!completed && !debugMode && hints.hintText && (
        <HintPanel step={hints.hintText} onMore={hints.hasMore ? hints.handleHint : undefined} />
      )}

      {!completed && checkpointNote && (
        <CheckpointNote text={checkpointNote} onDismiss={() => setCheckpointNote(null)} />
      )}
    </>
  );

  return (
    <>
      <div class="relative">
        {/* Stays up once solved, so the board holds still. */}
        {script && (
          <TutorialPanel message={script.message} steps={script.copies} boxRef={tutorialPanelRef} />
        )}
        {/* Questions */}
        <div
          ref={gridRef}
          class={
            // Short boards get air on both ends; the dock's own border closes the grid.
            puzzle.questions.length <= 3
              ? classNames(SHORT_BOARD, BOARD_GRID[design].short)
              : BOARD_GRID[design].long
          }
          style={{
            gridTemplateRows: `repeat(${Math.ceil(puzzle.questions.length / 2) * 2}, auto)`,
          }}
          onKeyDown={handleGridKeyDown}
          onFocusCapture={() => {
            if (focusedQuestionRef.current == null) {
              setFocusedQuestion(0);
              setFocusedOption(0);
            }
          }}
        >
          {puzzle.questions.map((qDef, qi) => (
            <QuestionRow
              key={qDef.text}
              index={qi}
              question={qDef}
              marks={questions[qi]?.marks ?? FRESH_MARKS}
              validity={validity[qi] ?? "neutral"}
              disabled={completed}
              checkpointedMask={checkpointedMasks[qi]}
              sweepMask={sweepMasks?.[qi] ?? 0}
              sweepKind={sweepKind}
              focusedOption={focusedQuestion === qi ? focusedOption : null}
              defaultFocus={focusedQuestion == null && qi === 0}
              onOptionClick={stableOptionClick}
            />
          ))}
        </div>

        {script && (
          <TutorialArrow
            arrow={script.arrow}
            arrowKey={script.arrowKey}
            gridRef={gridRef}
            textRef={tutorialPanelRef}
          />
        )}

        {/* Idle nudge: a coach message and arrow. Any press takes it away. */}
        {!completed && nudge.kind && (
          <NudgeCallout
            text={s.puzzle.nudge[nudge.kind]}
            targetRef={nudge.kind === "checkpoint" ? checkpointBtnRef : hintBtnRef}
            kind={nudge.kind}
            showMs={nudge.showMs}
          />
        )}

        {/* Stuck to the viewport's bottom while the board's tail is below it; z-index
            clears the tutorial's arrow. The negative top margin lays its border over the
            last row's own; the bottom padding covers the safe-area inset only while stuck.
            The tutorial's dock holds only Next, so it goes unruled. The Adventure's dock
            hangs below its centered board, out of the flow, so the board never moves. */}
        <div
          class={classNames(
            "z-6",
            adventure
              ? classNames("absolute inset-x-0 top-full mx-auto pb-safe-4", SHORT_WIDTH[design])
              : "sticky bottom-0 -mt-px -mb-(--safe-area-inset-bottom) bg-page pb-(--safe-area-inset-bottom)",
            // The daily dock is ruled off from the board.
            !tutorial && !adventure && "border-t",
          )}
          data-testid="puzzle-dock"
        >
          {!adventure && notes}

          {/* Controls and the history track share a line while the track is
              short; a long track wraps onto its own. Solved, the controls go
              and the completion bar stands at the row's end, or centered in
              the Adventure. */}
          <div
            class={classNames("flex flex-wrap items-center gap-x-3", adventure && "justify-center")}
          >
            {!completed && !tutorial && (
              <PuzzleControls
                toolbarRef={controlsRef}
                checkpointRef={checkpointBtnRef}
                hintRef={hintBtnRef}
                hintOnly={inAdventure}
                canUndo={canUndo}
                canRedo={canRedo}
                canCheckpoint={canCheckpoint}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onCheckpoint={handleSave}
                onHint={handleHint}
                onHintIntent={hints.getSolution}
              />
            )}

            {historyRef.current.length > 1 && !tutorial && !adventure && (
              <HistoryStrip
                history={historyRef.current}
                currentIdx={historyIdxRef.current}
                hints={hintMarkers.current}
                fails={failMarkers.current}
                completed={completed}
                onJump={handleJumpTo}
                containerRef={historyStripRef}
              />
            )}

            {tutorial && (
              <div class="ms-auto flex flex-none flex-wrap items-center justify-end gap-2 py-2">
                {tutorial.destinations ? (
                  tutorial.destinations.map((destination) => (
                    <TutorialNext
                      key={destination.testId}
                      shown={completed}
                      label={destination.label}
                      testId={destination.testId}
                      onClick={destination.onClick}
                    />
                  ))
                ) : (
                  <TutorialNext shown={completed} onClick={onNextPuzzle} />
                )}
              </div>
            )}
            {/* An Adventure solve's star, or how to earn it. */}
            {completed && adventure && (
              <p
                class="flex items-center gap-1.5 py-2 text-body font-semibold"
                data-testid="adventure-star-note"
              >
                {withoutHints || adventure.starred ? (
                  <>
                    <IconStar class="text-pending" />
                    {withoutHints ? s.adventure.starEarned : s.adventure.alreadyStarred}
                  </>
                ) : (
                  s.adventure.starMissed
                )}
              </p>
            )}
            {/* The completion bar: the ways onward, at the end of the row.
                The dialog carries its last two while it is up. */}
            {completed && !tutorial && (
              <CompletionBar
                barRef={puzzleCompleteRef}
                nextRef={setNextPuzzleRef}
                quiet={solvedDialog !== null}
                hasNext={level < LEVELS.length}
                continueTo={adventure?.mapPath}
                replayCue={replayCue}
                onPlayAgain={handlePlayAgain}
                onSummary={() => setSolvedDialog("summary")}
                onNext={onNextPuzzle}
              />
            )}

            {/* The first level's way to the tutorial, on a line of its own. */}
            {level === 1 && !ephemeral && !adventure && !completed && (
              <div class="basis-full pb-2">
                <ButtonLink
                  variant="outline"
                  href="/tutorial"
                  onClick={rememberTutorialOpener}
                  data-testid="take-tutorial"
                >
                  {s.tutorial.takeIt} &rarr;
                </ButtonLink>
              </div>
            )}
          </div>
          {adventure && notes}
        </div>
      </div>
      {shareMode && (
        <PuzzleShareDialog
          key={sharePress}
          dateStr={dateStr}
          level={level}
          initialMode={shareMode}
          getProgress={progressState}
          onClose={() => setShareMode(null)}
        />
      )}
      {solvedDialog && (
        <SolvedDialog
          stats={
            solvedDialog === "celebrate"
              ? analytics.meta.current
              : storedSolveStats(
                  ephemeral ? null : loadMeta(puzzle.id),
                  historyRef.current,
                  hintMarkers.current,
                  failMarkers.current,
                )
          }
          dateStr={dateStr}
          level={level}
          outcomes={questionOutcomes(
            puzzle.questions.length,
            hintMarkers.current,
            failMarkers.current,
          )}
          hasNext={level < LEVELS.length}
          shareUrl={getPuzzleUrl(dateStr, level)}
          celebrate={solvedDialog === "celebrate"}
          onNext={onNextPuzzle}
          onClose={() => {
            setSolvedDialog(null);
            // The bar takes the loud copy back on this render; bring it into
            // view and focus its button once it has.
            requestAnimationFrame(() => {
              puzzleCompleteRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              nextPuzzleRef.current?.focus({ preventScroll: true });
            });
          }}
        />
      )}
    </>
  );
}
