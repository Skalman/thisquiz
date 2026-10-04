import { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { useForceUpdate, useRevalidated } from "./lib/hooks.ts";
import { LocationProvider, Router, Route, useLocation } from "preact-iso";
import { tinykeys } from "tinykeys";
import { PuzzleView } from "./components/PuzzleView.tsx";
import { KeyboardHelp } from "./components/KeyboardHelp.tsx";
import { planImport, applyImport, planChanges } from "./lib/backup.ts";
import type { ImportPlan } from "./lib/backup.ts";
import { joinSync } from "./lib/sync.ts";
// QR components lazy-loaded via dynamic import (no preact dependency in chunks)
import type { Puzzle } from "./engine/types.ts";
import {
  ARCHIVE_PATH,
  DAILY_PATH,
  LEVELS,
  dailyPuzzlePath,
  fetchDaily,
  dayNumber,
  isValidDate,
  movedDailyPath,
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
import type { TutorialDestination } from "./components/TutorialPanel.tsx";
import { guarded } from "./lib/keyboard.ts";
import { t } from "./i18n/index.ts";
import { replayLogoAnimation } from "./components/Logo.tsx";
import { ImportPreview } from "./components/ImportPreview.tsx";
import { DailyHeader } from "./components/DailyHeader.tsx";
import { ArchivePage } from "./components/ArchivePage.tsx";
import { ErrorOverlay } from "./components/ErrorOverlay.tsx";
// Remove support for refpuzzle.com after 2027-06-01.
import { MoveBanner } from "./components/MoveBanner.tsx";
import { SafeAreaSimulator } from "./components/SafeAreaSimulator.tsx";
import { InlineHelp } from "./components/InlineHelp.tsx";
import { DifficultyTabs } from "./components/DifficultyTabs.tsx";
import { PrintSheet } from "./components/PrintSheet.tsx";
import { Loading } from "./components/ui/Loading.tsx";
import { NoticePage } from "./components/ui/NoticePage.tsx";
import { Redirect } from "./components/ui/Redirect.tsx";
import { Link } from "./components/ui/Link.tsx";
import { adoptDebugParam, useDebugRevision } from "./lib/debug.ts";
import type { ComponentChildren } from "preact";
import { DesignContext, useSectionDesign } from "./components/DesignContext.tsx";
import { AdventureMap, AdventurePuzzlePage } from "./components/AdventurePage.tsx";
import { OverviewPage } from "./components/OverviewPage.tsx";
import { ADVENTURE_PATH } from "./puzzles/adventure.ts";
import { useThemeColorWatch } from "./lib/theme.ts";
import { inSection } from "./lib/design.ts";
// Remove support for refpuzzle.com after 2027-06-01.
import { IMPORT_PATH } from "./lib/domain-move.ts";
import { fillSettings, readHandoff, type Handoff } from "./lib/handoff.ts";

adoptDebugParam();

// Old daily addresses move before the first render; bookmarks and shared links keep working.
const movedPath = movedDailyPath(window.location.pathname);
if (movedPath !== null) {
  window.history.replaceState(
    window.history.state,
    "",
    movedPath + window.location.search + window.location.hash,
  );
}

/** The overview; a first visit, with no progress and no tutorial, starts in the tutorial. */
function HomeRoute() {
  // Deep links land where they point, and crawlers index the overview.
  const [toTutorial] = useState(() => !tutorialDone() && !hasAnyProgress() && !isCrawler());
  return toTutorial ? <Redirect to="/tutorial" /> : <OverviewPage />;
}

function DailyTodayRoute() {
  return <DayView dateStr={useToday()} />;
}

/**
 * The guided tutorial, without the app's chrome: a lone cell, then its fixed
 * puzzles in turn. Finishing offers the Adventure or today; skipping goes
 * back to the page whose link opened it, or else to the overview.
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
  const next = () => setStage(stage + 1);
  const destinations: TutorialDestination[] = [
    {
      label: s.tutorial.playAdventure,
      testId: "tutorial-adventure",
      onClick: () => leaveFor(ADVENTURE_PATH),
    },
    { label: s.tutorial.playDaily, testId: "tutorial-daily", onClick: () => leaveFor(DAILY_PATH) },
  ];
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
            destinations: last ? destinations : undefined,
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
      route(dailyPuzzlePath(dateStr, level), true);
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
      <DailyHeader
        onKeyboardHelp={() => setShowKeyboardHelp(true)}
        onPrint={puzzles ? () => window.print() : undefined}
        onShare={currentPuzzle ? () => shareRef.current?.open() : undefined}
      />
      <div class="flex items-center gap-4 px-4 py-2 text-section text-muted">
        {!isToday && (
          <Link href={ARCHIVE_PATH} class="text-body">
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
    </>
  );
}

function DayRoute() {
  const s = t();
  const loc = useLocation();
  // `/daily/<date>/<level>`.
  const parts = loc.path.split("/").filter(Boolean);
  const dateStr = parts[1] ?? "";
  const level = Number(parts[2]) || undefined;
  if (!dateStr || !isValidDate(dateStr)) {
    return (
      <NoticePage title={s.notFound.noPuzzle} message={s.app.noPuzzle}>
        <Link href={DAILY_PATH}>{s.notFound.backToToday}</Link>
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

// Remove support for refpuzzle.com after 2027-06-01.
/** Storage handed over from the old site, merged the way a sync is. */
function ImportRoute() {
  const s = t();
  const [packed] = useState(() => window.location.hash.slice(1));
  const [status, setStatus] = useState<"reading" | "ready" | "error">("reading");
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  useEffect(() => {
    // The payload leaves the address bar, so a copied or reloaded URL doesn't carry it.
    history.replaceState(null, "", IMPORT_PATH);
    if (!packed) {
      setStatus("error");
      return;
    }
    readHandoff(packed)
      .then((read) => {
        // Settings alone, or progress already here, need no say-so.
        if (!planChanges(read.plan)) {
          fillSettings(read.settings);
          window.location.replace(read.path);
          return;
        }
        setHandoff(read);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [packed]);

  function finish(read: Handoff, imported: boolean) {
    if (imported) applyImport(read.plan);
    fillSettings(read.settings);
    setHandoff(null);
    window.location.replace(read.path);
  }

  return (
    <NoticePage
      title={status === "error" ? s.move.importFailedTitle : undefined}
      message={status === "error" ? s.move.importFailed : undefined}
    >
      {status === "reading" && <Loading />}
      {status === "error" && <Link href="/">{s.notFound.backToPuzzles}</Link>}
      {handoff && (
        <ImportPreview
          plan={handoff.plan}
          onConfirm={() => finish(handoff, true)}
          onCancel={() => finish(handoff, false)}
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

/** The page's frame, in the current section's design. */
function AppFrame({ children }: { children: ComponentChildren }) {
  const design = useSectionDesign();
  // The Adventure's arrows behind the page, set before the paint.
  const { path } = useLocation();
  const arrows = inSection(path, ADVENTURE_PATH);
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-arrows", arrows);
  }, [arrows]);
  return (
    <DesignContext.Provider value={design}>
      <div class="mx-auto max-w-272 p-safe-4" data-design={design}>
        {children}
      </div>
    </DesignContext.Provider>
  );
}

export function App() {
  useThemeColorWatch();
  const debugRevision = useDebugRevision();
  return (
    <LocationProvider>
      {/* Remade whole when Debug switches change, the address kept. */}
      <AppFrame key={debugRevision}>
        <ErrorOverlay />
        {/* Remove support for refpuzzle.com after 2027-06-01. */}
        <MoveBanner />
        <Router>
          <Route path="/" component={HomeRoute} />
          <Route path="/tutorial" component={TutorialRoute} />
          <Route path={ADVENTURE_PATH} component={AdventureMap} />
          <Route path={`${ADVENTURE_PATH}/:world`} component={AdventureMap} />
          <Route path={`${ADVENTURE_PATH}/:step/:size`} component={AdventurePuzzlePage} />
          <Route path={DAILY_PATH} component={DailyTodayRoute} />
          <Route path={ARCHIVE_PATH} component={ArchivePage} />
          <Route path={`${DAILY_PATH}/:date/:level`} component={DayRoute} />
          <Route path="/sync" component={SyncRoute} />
          {/* Remove support for refpuzzle.com after 2027-06-01. */}
          <Route path={IMPORT_PATH} component={ImportRoute} />
          <Route path="/playground" component={PlaygroundRoute} />
          <Route default component={NotFound} />
        </Router>
        {import.meta.env.DEV && <SafeAreaSimulator />}
      </AppFrame>
    </LocationProvider>
  );
}
