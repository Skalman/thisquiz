import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import { useForceUpdate, useRevalidated } from "./lib/hooks.ts";
import { LocationProvider, Router, Route, useLocation } from "preact-iso";
import { tinykeys } from "tinykeys";
import { PuzzleView } from "./components/PuzzleView.tsx";
import { KeyboardHelp } from "./components/KeyboardHelp.tsx";
import { planImport, applyImport } from "./lib/backup.ts";
import type { ImportPlan } from "./lib/backup.ts";
import { joinSync } from "./lib/sync.ts";
// QR components lazy-loaded via dynamic import (no preact dependency in chunks)
import type { Puzzle } from "./engine/types.ts";
import {
  LEVELS,
  fetchDaily,
  dayNumber,
  isValidDate,
  puzzleId,
  parseCompactPuzzle,
} from "./puzzles/daily.ts";
import { dayStates, resumeLevel } from "./puzzles/progress.ts";
import { useToday } from "./lib/today.ts";
import { decodePlaygroundHash } from "./lib/playground.ts";
import {
  TUTORIAL_PUZZLES,
  TUTORIAL_ID,
  markTutorialDone,
  tutorialDone,
  tutorialOpener,
} from "./puzzles/tutorial.ts";
import { hasAnyProgress } from "./lib/store.ts";
import { isCrawler } from "./lib/crawler.ts";
import { track, getClientInfo } from "./lib/analytics.ts";
import { Button } from "./components/ui/Button.tsx";
import { TutorialOpening } from "./components/TutorialOpening.tsx";
import { guarded } from "./lib/keyboard.ts";
import { t } from "./i18n/index.ts";
import { replayLogoAnimation } from "./components/Logo.tsx";
import { ImportPreview } from "./components/ImportPreview.tsx";
import { AppHeader } from "./components/AppHeader.tsx";
import { ArchivePage } from "./components/ArchivePage.tsx";
import { useBackupFlow, BackupDialogs } from "./components/BackupFlow.tsx";
import { ErrorOverlay } from "./components/ErrorOverlay.tsx";
import { SafeAreaSimulator } from "./components/SafeAreaSimulator.tsx";
import { InlineHelp } from "./components/InlineHelp.tsx";
import { DifficultyTabs } from "./components/DifficultyTabs.tsx";
import { PrintSheet } from "./components/PrintSheet.tsx";
import { PageFooter } from "./components/PageFooter.tsx";
import { Loading } from "./components/ui/Loading.tsx";
import { NoticePage } from "./components/ui/NoticePage.tsx";
import { Link } from "./components/ui/Link.tsx";
import { adoptDebugParam } from "./lib/debug.ts";
import { DesignContext, useStoredDesign } from "./components/DesignContext.tsx";

adoptDebugParam();

function DailyPage() {
  const dateStr = useToday();
  const { route } = useLocation();
  // A device with no progress and no finished tutorial starts there; deep
  // links land where they point, and crawlers index the day.
  const [toTutorial] = useState(() => !tutorialDone() && !hasAnyProgress() && !isCrawler());
  useEffect(() => {
    if (toTutorial) route("/tutorial", true);
  }, [toTutorial, route]);
  if (toTutorial) return <Loading />;
  return <DayView dateStr={dateStr} />;
}

/**
 * The guided tutorial, without the app's chrome: a lone cell, then its fixed
 * puzzles in turn; finishing or skipping goes to today.
 */
function TutorialRoute() {
  const s = t();
  const { route } = useLocation();
  // 0 is the lone cell; the puzzles follow.
  const [stage, setStage] = useState(0);
  const script = stage > 0 ? TUTORIAL_PUZZLES[stage - 1] : null;
  const last = stage === TUTORIAL_PUZZLES.length;
  // The last puzzle solved: nothing left to skip.
  const [finished, setFinished] = useState(false);
  const puzzle = useMemo(
    () => (script ? { ...parseCompactPuzzle(script.compact), id: TUTORIAL_ID } : null),
    [script],
  );
  // Back to `to`: a step back when a link opened the tutorial from there.
  const leaveFor = (to: string | null) => {
    if (to !== null && to === tutorialOpener()) window.history.back();
    else route(to ?? "/", true);
  };
  const next = () => (last ? leaveFor("/") : setStage(stage + 1));
  function skip() {
    markTutorialDone();
    track("tutorial_skipped", getClientInfo());
    leaveFor(tutorialOpener());
  }
  function solved() {
    if (!last) return;
    markTutorialDone();
    track("tutorial_completed", getClientInfo());
    setFinished(true);
  }
  return (
    // Centered in the viewport, less the page padding.
    <div class="flex min-h-screen-safe-4 flex-col justify-center">
      {/* Pinned to the viewport's corner, over the arrow; first in tab order. */}
      {!finished && (
        <Button
          variant="ghost"
          class="fixed top-safe-4 right-safe-4 z-10 bg-page"
          onClick={skip}
          data-testid="tutorial-skip"
        >
          {s.tutorial.skip}
        </Button>
      )}
      {script && puzzle ? (
        <PuzzleView
          key={stage}
          puzzle={puzzle}
          dateStr={TUTORIAL_ID}
          level={1}
          ephemeral
          tutorial={{
            puzzle: script,
            nextLabel: last ? s.tutorial.play : s.tutorial.next,
            onSolved: solved,
          }}
          onNextPuzzle={next}
          onChanged={() => {}}
        />
      ) : (
        <TutorialOpening onNext={next} />
      )}
    </div>
  );
}

function DayView({ dateStr, initialLevel }: { dateStr: string; initialLevel?: number }) {
  const s = t();
  const { route } = useLocation();
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  // Filled by the puzzle view; the header's Share row opens its sheet through it.
  const shareRef = useRef<{ open: () => void } | null>(null);
  const [puzzles, setPuzzles] = useState<Record<string, Puzzle> | null>(null);
  const [loading, setLoading] = useState(true);
  const forcePuzzleUpdate = useForceUpdate();
  const backup = useBackupFlow({ onChanged: forcePuzzleUpdate });
  useRevalidated();

  const initialHash = window.location.hash.slice(1) || null;
  // A level in the path is the one asked for; otherwise the day opens wherever
  // it was left. Only the mount decides — a rollover past midnight keeps the
  // level on screen rather than moving it out from under the solver.
  const [activeLevel, setActiveLevel] = useState(() =>
    initialLevel && LEVELS.includes(initialLevel) ? initialLevel : resumeLevel(dayStates(dateStr)),
  );

  const selectLevel = useCallback(
    (level: number) => {
      setActiveLevel(level);
      route(`/${dateStr}/${level}`, true);
      replayLogoAnimation();
    },
    [dateStr, route],
  );

  // Page-level keyboard shortcuts
  useEffect(() => {
    const g = guarded;
    const unsubscribe = tinykeys(window, {
      "[": g(() => {
        if (activeLevel > 1) selectLevel(activeLevel - 1);
      }),
      "]": g(() => {
        if (activeLevel < LEVELS.length) selectLevel(activeLevel + 1);
      }),
      Escape: (ev: KeyboardEvent) => {
        // Priority: dialog handled natively > menu > overlay
        const target = ev.target;
        if (target instanceof HTMLElement && target.closest("dialog")) return;
        setShowKeyboardHelp(false);
      },
    });

    // "?" bypasses tinykeys — tinykeys rejects shiftKey when Shift isn't in
    // the binding, and "?" inherently requires Shift on most layouts. Matching
    // event.key directly is layout-independent.
    function handleQuestion(ev: KeyboardEvent) {
      if (ev.key !== "?") return;
      const el = ev.target;
      if (
        el instanceof HTMLElement &&
        (el.closest("dialog") ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT")
      )
        return;
      setShowKeyboardHelp((shown) => !shown);
    }
    window.addEventListener("keydown", handleQuestion);

    return () => {
      unsubscribe();
      window.removeEventListener("keydown", handleQuestion);
    };
  }, [activeLevel, selectLevel]);

  // A fast date change can resolve out of order, so only the newest fetch wins.
  useEffect(() => {
    let canceled = false;
    setLoading(true);
    replayLogoAnimation();
    void fetchDaily(dateStr).then((data) => {
      if (canceled) return;
      setPuzzles(data);
      setLoading(false);
    });
    return () => {
      canceled = true;
    };
  }, [dateStr]);

  const currentPuzzle = puzzles?.[`${activeLevel}`] ?? null;
  const pid = puzzleId(dateStr, activeLevel);

  const handleChanged = forcePuzzleUpdate;

  const handleNextLevel = useCallback(() => {
    if (activeLevel < LEVELS.length) selectLevel(activeLevel + 1);
  }, [activeLevel, selectLevel]);

  const today = useToday();
  const isToday = dateStr === today;

  return (
    <>
      <AppHeader
        onKeyboardHelp={() => setShowKeyboardHelp(true)}
        onPrint={puzzles ? () => window.print() : undefined}
        onShare={currentPuzzle ? () => shareRef.current?.open() : undefined}
        onBackup={backup.openBackup}
      />
      <div class="flex items-center gap-4 px-4 py-2 text-section text-muted">
        {!isToday && (
          <Link href="/archive" class="text-body">
            &larr; {s.daily.archive}
          </Link>
        )}
        <span class="font-semibold text-default">
          {s.daily.dayLabel(dayNumber(dateStr), dateStr)}
        </span>
      </div>

      <DifficultyTabs dateStr={dateStr} activeLevel={activeLevel} onSelect={selectLevel} />

      {loading && <Loading />}

      {!loading && !currentPuzzle && <Loading>{s.app.noPuzzle}</Loading>}

      {!loading && currentPuzzle && (
        <PuzzleView
          key={pid}
          puzzle={currentPuzzle}
          dateStr={dateStr}
          level={activeLevel}
          initialHash={activeLevel === initialLevel ? initialHash : null}
          shareRef={shareRef}
          onNextPuzzle={handleNextLevel}
          onChanged={handleChanged}
        />
      )}

      {showKeyboardHelp && <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />}

      <InlineHelp />

      {puzzles && <PrintSheet dateStr={dateStr} puzzles={puzzles} />}

      <BackupDialogs backup={backup} exportFilename={`refpuzzle-backup-${dateStr}.json`} />
    </>
  );
}

/** The archive's old slug; kept so bookmarks and shared links survive. */
function ArchiveRedirect() {
  const { route } = useLocation();
  useEffect(() => {
    route("/archive", true);
  }, [route]);
  return null;
}

function DayRoute() {
  const s = t();
  const loc = useLocation();
  const parts = loc.path.split("/").filter(Boolean);
  const dateStr = parts[0] ?? "";
  const level = Number(parts[1]) || undefined;
  if (!dateStr || !isValidDate(dateStr)) {
    return (
      <NoticePage title={s.notFound.noPuzzle} message={s.app.noPuzzle}>
        <Link href="/">{s.notFound.backToToday}</Link>
      </NoticePage>
    );
  }
  return <DayView dateStr={dateStr} initialLevel={level} />;
}

function SyncRoute() {
  const s = t();
  const code = window.location.hash.slice(1);
  const [status, setStatus] = useState<"joining" | "done" | "error">("joining");
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);

  useEffect(() => {
    if (!/^\d{6}$/.test(code)) {
      setStatus("error");
      return;
    }
    joinSync(code)
      .then((json) => {
        try {
          setImportPlan(planImport(json));
          setStatus("done");
        } catch {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [code]);

  return (
    <NoticePage title={status === "error" ? s.sync.expired : undefined}>
      {status === "joining" && <Loading />}
      {status === "error" && <Link href="/">{s.notFound.backToPuzzles}</Link>}
      {importPlan && (
        <ImportPreview
          plan={importPlan}
          onConfirm={() => {
            applyImport(importPlan);
            setImportPlan(null);
            window.location.href = "/";
          }}
          onCancel={() => {
            window.location.href = "/";
          }}
        />
      )}
    </NoticePage>
  );
}

function PlaygroundRoute() {
  const hash = window.location.hash.slice(1);
  type State =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; puzzle: Puzzle; stateHash: string | null };
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!hash) {
      setState({ status: "error" });
      return;
    }
    decodePlaygroundHash(hash)
      .then((decoded) => {
        if (!decoded) {
          setState({ status: "error" });
          return;
        }
        setState({
          status: "ready",
          puzzle: parseCompactPuzzle(decoded.compact),
          stateHash: decoded.stateHash,
        });
      })
      .catch(() => setState({ status: "error" }));
  }, [hash]);

  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <Loading>Invalid puzzle hash.</Loading>;
  return (
    <PuzzleView
      key={hash}
      puzzle={state.puzzle}
      dateStr="playground"
      level={1}
      initialHash={state.stateHash}
      ephemeral
      onNextPuzzle={() => {}}
      onChanged={() => {}}
    />
  );
}

function NotFound() {
  const s = t();
  return (
    <NoticePage title={s.notFound.title} message={s.notFound.pageNotFound}>
      <Link href="/">{s.notFound.backToPuzzles}</Link>
    </NoticePage>
  );
}

/** The page footer, left off the tutorial. */
function Footer() {
  const { path } = useLocation();
  return path === "/tutorial" ? null : <PageFooter />;
}

export function App() {
  const design = useStoredDesign();
  return (
    <LocationProvider>
      <DesignContext.Provider value={design}>
        <div class="mx-auto max-w-272 p-safe-4">
          <ErrorOverlay />
          <Router>
            <Route path="/" component={DailyPage} />
            <Route path="/archive" component={ArchivePage} />
            <Route path="/past" component={ArchiveRedirect} />
            <Route path="/sync" component={SyncRoute} />
            <Route path="/playground" component={PlaygroundRoute} />
            <Route path="/tutorial" component={TutorialRoute} />
            <Route path="/:date/:level" component={DayRoute} />
            <Route default component={NotFound} />
          </Router>
          <Footer />
          {import.meta.env.DEV && <SafeAreaSimulator />}
        </div>
      </DesignContext.Provider>
    </LocationProvider>
  );
}
