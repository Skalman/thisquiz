import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { useLocation, useRoute } from "preact-iso";
import {
  DiamondGoal,
  PathStep,
  Rewards,
  STEP_CIRCLE_WIDTH,
  useExpandedStep,
} from "./AdventureStep.tsx";
import { IconArrowLeft, IconChevronDown, IconHome } from "./Icons.tsx";
import { PuzzleView } from "./PuzzleView.tsx";
import { Button, ButtonLink } from "./ui/Button.tsx";
import { Dialog } from "./ui/Dialog.tsx";
import { Link } from "./ui/Link.tsx";
import { Loading } from "./ui/Loading.tsx";
import { NoticePage } from "./ui/NoticePage.tsx";
import { Redirect } from "./ui/Redirect.tsx";
import { t } from "../i18n/index.ts";
import { classNames, tw } from "../lib/classNames.ts";
import { useForceUpdate } from "../lib/hooks.ts";
import { loadStars } from "../lib/stars.ts";
import {
  ADVENTURE_PATH,
  STEPS_PER_WORLD,
  worldMapPath,
  worldOf,
  adventureProgress,
  adventurePuzzle,
  fetchAdventureLists,
  loadedAdventureLists,
  setLastPlayed,
  holdReached,
  recordSolve,
  reachedStep,
  sizeByKey,
  firstStepOf,
  type AdventureLists,
  type AdventureProgress,
} from "../puzzles/adventure.ts";
import { DAILY_PATH } from "../puzzles/daily.ts";

/** The puzzle lists: undefined while loading, null if they failed. */
function useAdventureLists(): AdventureLists | null | undefined {
  // Already loaded, they're there for the first render.
  const [lists, setLists] = useState<AdventureLists | null | undefined>(
    () => loadedAdventureLists() ?? undefined,
  );
  useEffect(() => {
    if (lists !== undefined) return undefined;
    let canceled = false;
    void fetchAdventureLists().then((loaded) => {
      if (!canceled) setLists(loaded);
    });
    return () => {
      canceled = true;
    };
  }, [lists]);
  return lists;
}

/**
 * An Adventure page's top line: the way back or the rewards, an optional
 * title, and the way home. Stuck where it rests, so scrolling never moves it;
 * it lets presses through to the path, except on its own pieces.
 */
function GameBar({ start, title }: { start: ComponentChildren; title?: ComponentChildren }) {
  const s = t();
  return (
    <header class="pointer-events-none sticky top-safe-4 z-20 -mx-safe-4 mb-4 grid grid-cols-[1fr_auto_1fr] grid-rows-[2.75rem] items-center gap-3 px-safe-4 py-2 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
      <div class="flex items-center justify-start">{start}</div>
      {title || <span />}
      <div class="flex items-center justify-end">
        <ButtonLink
          variant="outline-muted"
          size="icon"
          href="/"
          icon={<IconHome />}
          aria-label={s.overview.home}
          title={s.overview.home}
          data-testid="home"
        />
      </div>
    </header>
  );
}

/** A bar piece that isn't a button: a frosted pill, so it reads over the path. */
const BAR_PILL = tw`rounded-pill bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] px-3 py-1 backdrop-blur-md`;

/** How many locked steps the map shows past the reached one. */
const LOCKED_AHEAD = 5;

/** The fewest steps the map shows, so a new path doesn't look empty. */
const MIN_SHOWN = 10;

/** A step `ahead` past the reached one fades with distance, out to the last of `lockedShown`. */
function fadeAhead(ahead: number, lockedShown: number): number {
  return ahead <= 0 ? 1 : 1 - ahead / (lockedShown + 1);
}

/** From one step's center to the next, in rem. */
const STEP_SPACING = 4.5;

/** How steeply each row of the path runs down, in degrees. */
const SLOPE = 10;

/** Steps per row, the one on the turn after it included. */
const ROW_STEPS = 4;

/** How far the step on a turn bulges past the row's end, in rem. Small, so an expanded step's sizes stay on screen. */
const TURN_BULGE = 1.75;

/**
 * A step's place on a world's map, in rem: its offset from the center,
 * and its depth from the top. The path snakes down: a row across at `SLOPE`,
 * a step on the turn, a row back, each row and turn the mirror of the last,
 * and every step `STEP_SPACING` from the next. The first step is a row's
 * second, so the path starts at the center.
 */
function pathPoint(index: number): { x: number; y: number } {
  const slope = (SLOPE * Math.PI) / 180;
  const across = STEP_SPACING * Math.cos(slope);
  const down = STEP_SPACING * Math.sin(slope);
  // The turn's step sits a spacing from both the row's end and the next row's start.
  const turnDrop = Math.sqrt(STEP_SPACING ** 2 - TURN_BULGE ** 2);
  const rowEnd = ((ROW_STEPS - 2) * across) / 2;
  const rowDepth = (ROW_STEPS - 2) * down + 2 * turnDrop;

  const row = Math.floor((index + 1) / ROW_STEPS);
  const along = (index + 1) % ROW_STEPS;
  const direction = row % 2 === 0 ? 1 : -1;
  const top = row * rowDepth - down;
  if (along === ROW_STEPS - 1) {
    return { x: direction * (rowEnd + TURN_BULGE), y: top + (ROW_STEPS - 2) * down + turnDrop };
  }
  return { x: direction * (along * across - rowEnd), y: top + along * down };
}

/** Every world reached so far, with its stars and diamond, each a way to its map. */
function WorldsDialog({ progress, onClose }: { progress: AdventureProgress; onClose: () => void }) {
  const s = t();
  const { route } = useLocation();
  return (
    <Dialog title={s.adventure.worldsTitle} onClose={onClose}>
      <ul class="flex flex-col gap-2">
        {Array.from({ length: progress.reachedWorld }, (_, i) => i + 1).map((world) => (
          <li key={world}>
            <Button
              variant="outline"
              class="w-full"
              onClick={() => {
                onClose();
                route(worldMapPath(world));
              }}
              data-testid="world-list-item"
            >
              {s.adventure.world(world)}
              <Rewards
                stars={progress.starsInWorld(world)}
                diamonds={world < progress.reachedWorld ? 1 : 0}
              />
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/** After a world's diamond: the next world, and after the first, the daily puzzles too. */
function WorldEnd({ world }: { world: number }) {
  const s = t();
  const next = (
    <ButtonLink variant="next" href={worldMapPath(world + 1)} data-testid="world-next">
      {s.adventure.world(world + 1)} &rarr;
    </ButtonLink>
  );
  if (world > 1) return <div class="mt-4 flex justify-center">{next}</div>;
  return (
    <div
      class="mt-4 rounded-lg border border-valid bg-valid-soft px-4 py-3 text-body"
      data-testid="adventure-first-diamond"
    >
      <p class="mb-1 font-semibold">{s.adventure.firstDiamond.title}</p>
      <p class="mb-3">{s.adventure.firstDiamond.text}</p>
      <div class="flex flex-wrap gap-3">
        {next}
        <ButtonLink variant="outline" href={DAILY_PATH} data-testid="adventure-daily">
          {s.adventure.firstDiamond.daily}
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * A world's map, at `/adventure/<world>`; at `/adventure`, the one
 * where the player is. One not reached yet sends back to that one.
 */
export function AdventureMap() {
  const s = t();
  const param = useRoute().params.world;
  const progress = adventureProgress();
  const world = param === undefined ? worldOf(progress.lastPlayed) : Number(param);
  const named = param === undefined || (String(world) === param && world >= 1);
  // Loaded early, so the first puzzle opened from here shows at once.
  useEffect(() => {
    void fetchAdventureLists();
  }, []);

  if (named && world > progress.reachedWorld) return <Redirect to={ADVENTURE_PATH} />;
  if (!named) {
    return (
      <NoticePage title={s.notFound.title} message={s.adventure.noWorld}>
        <Link href={ADVENTURE_PATH}>{s.adventure.backToMap}</Link>
      </NoticePage>
    );
  }
  // Fresh for each world: no step expanded, and scrolled to its own place.
  return <MapView key={world} world={world} progress={progress} />;
}

function MapView({ world, progress }: { world: number; progress: AdventureProgress }) {
  const s = t();
  const path = useRef<HTMLDivElement>(null);
  const [expandedStep, toggleStep] = useExpandedStep();
  const [listing, setListing] = useState(false);

  // Where the player is sits mid-screen from the first paint, or, on a world
  // they're past, its end. A microtask lands after the router's own scroll to the
  // top, still before the paint.
  useLayoutEffect(() => {
    queueMicrotask(() =>
      path.current
        ?.querySelector("[data-ringed], [data-end]")
        ?.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  }, []);

  const { reached, lastPlayed } = progress;
  const first = firstStepOf(world);
  const done = reached >= first + STEPS_PER_WORLD;
  const reachedInWorld = reached - first + 1;
  const shown = done
    ? STEPS_PER_WORLD
    : Math.min(STEPS_PER_WORLD, Math.max(reachedInWorld + LOCKED_AHEAD, MIN_SHOWN));
  const steps = Array.from({ length: shown }, (_, i) => progress.stepAt(first + i));
  const title = s.adventure.world(world);

  return (
    <>
      <GameBar
        start={
          <span class={BAR_PILL}>
            <Rewards stars={progress.stars} diamonds={progress.diamonds} />
          </span>
        }
        title={
          // Numbered on screen once there's more than one, and a way to the others.
          progress.reachedWorld > 1 && (
            <h1>
              <button
                type="button"
                class={classNames(
                  BAR_PILL,
                  "flex cursor-pointer items-center gap-1 text-section font-semibold tabular-nums",
                )}
                aria-haspopup="dialog"
                onClick={() => setListing(true)}
                data-testid="world-title"
              >
                {title}
                <IconChevronDown size="0.9em" class="text-muted" />
              </button>
            </h1>
          )
        }
      />
      {progress.reachedWorld === 1 && <h1 class="sr-only">{title}</h1>}

      <div class="mx-auto max-w-150 p-2 sm:p-4">
        {/* Half a screen of room below, so the reached step can scroll to the middle; the path
            starts at the top, so a new one opens with its first step there. */}
        <div ref={path} class="pt-4 pb-[50svh]">
          <ol
            class="relative"
            style={{ height: `${pathPoint(shown - 1).y + STEP_CIRCLE_WIDTH}rem` }}
          >
            {steps.map((stepProgress, i) => {
              const { x, y } = pathPoint(i);
              return (
                <PathStep
                  key={stepProgress.step}
                  progress={stepProgress}
                  ringed={stepProgress.step === lastPlayed}
                  expanded={expandedStep === stepProgress.step}
                  onToggle={() => toggleStep(stepProgress.step)}
                  class="absolute top-0 left-1/2"
                  style={{
                    transform: `translate(${x - STEP_CIRCLE_WIDTH / 2}rem, ${y}rem)`,
                    opacity: fadeAhead(stepProgress.step - reached, shown - reachedInWorld),
                  }}
                />
              );
            })}
          </ol>
          {shown === STEPS_PER_WORLD && (
            <div class="mt-3 py-2" data-end>
              <DiamondGoal world={world} earned={done} />
              {done && <WorldEnd world={world} />}
            </div>
          )}
        </div>
      </div>

      {listing &&
        createPortal(
          <WorldsDialog progress={progress} onClose={() => setListing(false)} />,
          document.body,
        )}
    </>
  );
}

/**
 * One Adventure puzzle, at `/adventure/<step>/<size>`; a locked
 * step sends back to the map.
 */
export function AdventurePuzzlePage() {
  const s = t();
  const params = useRoute().params;
  const stepParam = params.step ?? "";
  const step = Number(stepParam);
  const size = sizeByKey(params.size ?? "");
  const lists = useAdventureLists();
  const forceUpdate = useForceUpdate();

  // Only the plain spelling of a step, at or past where its size joins, names a puzzle.
  const named = String(step) === stepParam && size !== undefined && step >= size.joins;
  const locked = named && step > reachedStep();

  // Shown, this is where the player is; read before any solve moves the reached
  // step. Held, so the board's own Play again keeps the steps after it unlocked.
  const wasReachedStep = useRef(false);
  useEffect(() => {
    if (!named || locked) return;
    wasReachedStep.current = step === reachedStep();
    holdReached();
    setLastPlayed(step);
  }, [named, locked, step]);

  if (locked) return <Redirect to={ADVENTURE_PATH} />;
  if (named && lists === undefined) return <Loading />;
  if (lists === null) {
    return (
      <NoticePage title={s.adventure.loadFailed}>
        <Link href="/">{s.overview.home}</Link>
      </NoticePage>
    );
  }
  const puzzle = named && lists ? adventurePuzzle(lists, step, size) : null;
  if (!named || !puzzle) {
    return (
      <NoticePage title={s.notFound.noPuzzle} message={s.adventure.notFound}>
        <Link href={ADVENTURE_PATH}>{s.adventure.backToMap}</Link>
      </NoticePage>
    );
  }

  /** A solve unlocks the next step; solving the reached step moves the player on to it. */
  const solved = (withoutHints: boolean) => {
    recordSolve(step, size, withoutHints);
    if (wasReachedStep.current) setLastPlayed(step + 1);
    forceUpdate();
  };
  const mapPath = worldMapPath(worldOf(step));

  return (
    // The viewport less the page padding: the bar on top, the board centered on
    // the screen — the bottom padding matches the bar's height, 4.75rem in flow.
    <div class="flex min-h-screen-safe-4 flex-col pb-19">
      <GameBar
        start={
          <ButtonLink
            variant="outline-muted"
            size="icon"
            href={mapPath}
            icon={<IconArrowLeft />}
            aria-label={s.adventure.backToMap}
            title={s.adventure.backToMap}
            data-testid="adventure-back"
          />
        }
        title={
          <h1 class={classNames(BAR_PILL, "text-section font-semibold tabular-nums")}>
            {s.adventure.puzzleTitle(step)}
          </h1>
        }
      />

      <div class="flex flex-1 flex-col justify-center">
        <PuzzleView
          key={puzzle.id}
          puzzle={puzzle}
          dateStr="adventure"
          level={1}
          adventure={{ mapPath, starred: loadStars().has(puzzle.id), onSolved: solved }}
          onNextPuzzle={() => {}}
          onChanged={forceUpdate}
        />
      </div>
    </div>
  );
}
