import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { useLocation } from "preact-iso";
import { IconDiamond, IconStar } from "./Icons.tsx";
import { LETTER_VARS } from "./LetterChip.tsx";
import { Button } from "./ui/Button.tsx";
import { Dialog } from "./ui/Dialog.tsx";
import { LETTERS } from "../engine/types.ts";
import { t } from "../i18n/index.ts";
import { classNames, tw } from "../lib/classNames.ts";
import {
  adventurePuzzlePath,
  clearForReplay,
  type AdventureSize,
  type StepProgress,
  type StepStatus,
} from "../puzzles/adventure.ts";

/** A step's color: its newest size's, so the path changes color where a size joins. */
function stepColor(progress: StepProgress): string {
  return LETTER_VARS[progress.sizes.length - 1];
}

const STEP_CIRCLE = tw`relative flex items-center justify-center rounded-full border-2 font-bold tabular-nums`;

const CIRCLE_SIZE = { large: tw`size-14 text-section`, small: tw`size-10 text-chrome` };

/** A large step circle's width, in rem: `size-14`'s. */
export const STEP_CIRCLE_WIDTH = 3.5;

/** Colored through the letter variables. */
const STEP_LOOK: Record<StepStatus, string> = {
  locked: tw`border-muted bg-surface text-muted opacity-60`,
  next: tw`border-(--letter) bg-(--letter) text-(--on-letter)`,
  done: tw`border-(--letter) bg-(--letter-soft) text-(--letter-text)`,
};

/** The ringed step: an accent ring, set off from the circle by the page color. */
const RINGED = tw`ring-4 ring-accent ring-offset-3 ring-offset-(--bg)`;

/** Play's candy finish, on the circles a press acts on; the gloss is set per look. */
const PLAY_CIRCLE = tw`shadow-lip [--lip:color-mix(in_srgb,var(--letter),black_30%)] active:translate-y-0.5 active:shadow-none`;

/** The stars earned at a step or size, pinned to its circle's corner. */
function StarBadge({ stars }: { stars: number }) {
  if (stars === 0) return null;
  return (
    <span class="absolute -top-1.5 -right-1.5 flex items-center text-caption font-bold text-default">
      <IconStar size="1.25rem" class="text-pending" />
      {stars > 1 && stars}
    </span>
  );
}

function stepLabel(progress: StepProgress): string {
  const s = t();
  return progress.status === "done"
    ? s.adventure.step.done(progress.step, progress.starredSizes.size)
    : s.adventure.step[progress.status](progress.step);
}

/** A step's circle as it looks: its number in its color, and the ring if ringed. */
function stepLook(progress: StepProgress, ringed: boolean, circle: keyof typeof CIRCLE_SIZE) {
  return classNames(
    STEP_CIRCLE,
    CIRCLE_SIZE[circle],
    stepColor(progress),
    STEP_LOOK[progress.status],
    progress.status !== "locked" &&
      classNames(
        PLAY_CIRCLE,
        // The next step is a full letter color; done ones are soft.
        progress.status === "next" ? "bg-(image:--gloss-bright)" : "bg-(image:--gloss)",
      ),
    ringed && RINGED,
  );
}

/**
 * Which step is expanded into its sizes, if any, and the way to expand or close one.
 * One at a time; it closes on a press anywhere but on it, its sizes or a
 * dialog one of them opened, or on Escape.
 */
export function useExpandedStep(): [number | null, (step: number) => void] {
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    if (expanded === null) return undefined;
    function onPointerDown(e: PointerEvent) {
      if (e.target instanceof Element && e.target.closest("[data-expanded], dialog")) return;
      setExpanded(null);
      // That press only closes it, unless it lands on a link or button.
      document.addEventListener(
        "click",
        (click) => {
          const onControl = click.target instanceof Element && click.target.closest("a, button");
          // A press that never became a click leaves this waiting; a much later click is another press's.
          if (!onControl && click.timeStamp - e.timeStamp < 2000) click.preventDefault();
        },
        { capture: true, once: true },
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // A dialog's Escape is the dialog's.
      if (e.target instanceof Element && e.target.closest("dialog")) return;
      // Focus goes back to the step, not lost with the sizes.
      document.querySelector<HTMLElement>("[data-expanded] button[aria-expanded]")?.focus();
      setExpanded(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);
  const toggle = (step: number) => setExpanded((was) => (was === step ? null : step));
  return [expanded, toggle];
}

interface StepCircleProps {
  progress: StepProgress;
  /** Ringed, scrolled to on the map, and `aria-current`. */
  ringed: boolean;
  circle?: keyof typeof CIRCLE_SIZE;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * One step on a path, as a list item: a step with one size is that size's
 * puzzle; one with more expands, its sizes around it over the path.
 */
export function PathStep({
  class: placement,
  style,
  ...props
}: StepCircleProps & {
  /** Where it sits, if not in the flow. */
  class?: string;
  style?: Record<string, string | number>;
}) {
  return (
    <li
      class={classNames(placement ?? "relative", props.expanded && "z-10")}
      style={style}
      data-expanded={props.expanded || undefined}
    >
      <StepCircle {...props} />
    </li>
  );
}

function StepCircle({ progress, ringed, circle = "large", expanded, onToggle }: StepCircleProps) {
  const look = stepLook(progress, ringed, circle);
  const attributes = {
    "data-testid": "adventure-step",
    "data-status": progress.status,
    "data-ringed": ringed || undefined,
    "data-step": String(progress.step),
  };
  const content = (
    <>
      {progress.step}
      <StarBadge stars={progress.starredSizes.size} />
    </>
  );
  if (progress.status === "locked") {
    return (
      <span class={look} {...attributes}>
        <span aria-hidden="true">{progress.step}</span>
        <span class="sr-only">{stepLabel(progress)}</span>
      </span>
    );
  }
  const labeled = {
    ...attributes,
    "aria-label": stepLabel(progress),
    "aria-current": ringed ? ("step" as const) : undefined,
  };
  const [only] = progress.sizes;
  if (progress.sizes.length === 1) {
    return (
      <PuzzleLink size={only} progress={progress} class={look} attributes={labeled}>
        {content}
      </PuzzleLink>
    );
  }
  return (
    <>
      {/* Expanded, the step gives way to its sizes. */}
      <button
        type="button"
        class={classNames(
          look,
          "cursor-pointer motion-safe:transition-[scale,opacity] motion-safe:duration-200",
          expanded && "scale-50 opacity-0",
        )}
        aria-expanded={expanded}
        onClick={onToggle}
        {...labeled}
      >
        {content}
      </button>
      {expanded && (
        // Around the step's center, over the path, so expanding it moves nothing.
        <div class="absolute top-1/2 left-1/2 z-10">
          {/* The frost behind the sizes. A press on it closes them, as one on the step
              would; flagged handled, so whatever holds the step leaves it be. */}
          <span
            onClick={(e) => {
              e.preventDefault();
              onToggle();
            }}
            class="absolute -top-28 -left-28 size-56 rounded-full bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] mask-[radial-gradient(closest-side,black_60%,transparent)] backdrop-blur-md motion-safe:animate-spring-out"
            style={{ "--from-x": "0rem", "--from-y": "0rem" }}
          />
          <ul>
            {progress.sizes.map((size, i) => {
              const count = progress.sizes.length;
              const angle = (SIZE_ANGLES[count][i] * Math.PI) / 180;
              const x = sizesRadius(count) * Math.cos(angle);
              const y = sizesRadius(count) * Math.sin(angle);
              return (
                <li
                  key={size.key}
                  class="absolute motion-safe:animate-spring-out"
                  style={{
                    left: `${x - SIZE_CIRCLE_WIDTH / 2}rem`,
                    top: `${y - SIZE_CIRCLE_WIDTH / 2}rem`,
                    "--from-x": `${-x}rem`,
                    "--from-y": `${-y}rem`,
                  }}
                >
                  <SizeCircle size={size} progress={progress} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

/** A size circle's width, in rem: `size-12`'s. */
const SIZE_CIRCLE_WIDTH = 3;

/**
 * Where a step's sizes sit around it, by how many there are: degrees clockwise
 * from the right, read clockwise from the left or the top left. Needs an entry
 * for every count of sizes a step can offer.
 */
const SIZE_ANGLES: Record<number, number[]> = {
  2: [180, 0],
  3: [210, 330, 90],
  4: [180, 270, 0, 90],
};

/** From one size's center to its neighbor's, in rem. */
const SIZE_SPACING = 4.15;

/** From a step's center to its sizes' centers, in rem, so neighbors keep the same spacing however many there are. */
function sizesRadius(count: number): number {
  return SIZE_SPACING / (2 * Math.sin(Math.PI / count));
}

/** An option letter's color, full or soft. */
function letterColor(index: number, soft: boolean): string {
  return `var(--letter-${LETTERS[index].toLowerCase()}${soft ? "-soft" : ""})`;
}

/** The letter colors of a size's options, a stripe each, left to right. */
function columnColors(options: number): string {
  const width = 100 / options;
  const stops = Array.from(
    { length: options },
    (_, i) => `${letterColor(i, false)} ${i * width}% ${(i + 1) * width}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/**
 * One of a step's puzzles, shown by its size: a little board in a circle, a
 * column per option in its letter's color and a row per question, each cell
 * edged in the surface color, so they meet in a soft line. Soft once solved.
 */
function SizeCircle({ size, progress }: { size: AdventureSize; progress: StepProgress }) {
  const s = t();
  const solved = progress.solvedSizes.has(size.key);
  const starred = progress.starredSizes.has(size.key);
  const label = starred
    ? s.adventure.size.starred(size.questions, size.options)
    : solved
      ? s.adventure.size.solved(size.questions, size.options)
      : s.adventure.size.unsolved(size.questions, size.options);
  return (
    <PuzzleLink
      size={size}
      progress={progress}
      class="relative flex size-12 rounded-full bg-surface p-0.5 shadow-lip [--lip:var(--border)] active:translate-y-0.5 active:shadow-none"
      attributes={{ "aria-label": label, "data-testid": "adventure-size", "data-size": size.key }}
    >
      {/* Solved, it's edged in its columns' own colors, as a done step is in its color. */}
      {solved && (
        <span
          class="absolute inset-0 rounded-full"
          style={{ background: columnColors(size.options) }}
        />
      )}
      <span
        class="relative grid size-full overflow-hidden rounded-full"
        style={{ gridTemplateColumns: `repeat(${size.options}, 1fr)` }}
      >
        {Array.from({ length: size.questions * size.options }, (_, cell) => (
          <span
            key={cell}
            class="shadow-[inset_0_0_1.5px_0.5px_color-mix(in_srgb,var(--bg-surface)_70%,transparent)]"
            style={{
              background: letterColor(cell % size.options, solved),
            }}
          />
        ))}
      </span>
      {/* Play's candy finish, over the board. */}
      <span class="pointer-events-none absolute inset-0 rounded-full bg-(image:--gloss-bright)" />
      {starred && <StarBadge stars={1} />}
    </PuzzleLink>
  );
}

/** The way into one puzzle: straight in, or, once solved, an offer to replay it. */
function PuzzleLink({
  size,
  progress,
  class: look,
  attributes,
  children,
}: {
  size: AdventureSize;
  progress: StepProgress;
  class: string;
  attributes: Record<string, string | boolean | undefined>;
  children: ComponentChildren;
}) {
  const [asking, setAsking] = useState(false);
  if (!progress.solvedSizes.has(size.key)) {
    return (
      <a href={adventurePuzzlePath(progress.step, size)} class={look} {...attributes}>
        {children}
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        class={classNames(look, "cursor-pointer")}
        aria-haspopup="dialog"
        onClick={() => setAsking(true)}
        {...attributes}
      >
        {children}
      </button>
      {/* In the body, so presses in it stay out of whatever holds the circle. */}
      {asking &&
        createPortal(
          <ReplayDialog
            step={progress.step}
            size={size}
            starred={progress.starredSizes.has(size.key)}
            onClose={() => setAsking(false)}
          />,
          document.body,
        )}
    </>
  );
}

/** What to do with a solved puzzle: a fresh board, the solve as it stands, or neither. */
function ReplayDialog({
  step,
  size,
  starred,
  onClose,
}: {
  step: number;
  size: AdventureSize;
  starred: boolean;
  onClose: () => void;
}) {
  const s = t();
  const { route } = useLocation();
  const href = adventurePuzzlePath(step, size);
  return (
    <Dialog title={s.adventure.puzzleTitle(step)} onClose={onClose}>
      <p class="mb-4 flex items-center gap-1.5" data-testid="replay-star">
        {starred ? (
          <>
            <IconStar class="text-pending" />
            {s.adventure.replay.starred}
          </>
        ) : (
          s.adventure.starMissed
        )}
      </p>
      <div class="flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={() => {
            clearForReplay(step, size);
            route(href);
          }}
          data-testid="replay-play-again"
        >
          {s.puzzle.playAgain}
        </Button>
        <Button variant="outline" onClick={() => route(href)} data-testid="replay-show-solution">
          {s.adventure.replay.showSolution}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {s.adventure.replay.cancel}
        </Button>
      </div>
    </Dialog>
  );
}

/** The stars earned so far, and the diamonds once there are any. */
export function Rewards({ stars, diamonds }: { stars: number; diamonds: number }) {
  const s = t();
  return (
    <span class="inline-flex items-center gap-3 text-section font-semibold whitespace-nowrap tabular-nums">
      <span class="inline-flex items-center gap-1">
        <IconStar class="text-pending" />
        <span aria-hidden="true" data-testid="adventure-stars">
          {stars}
        </span>
        <span class="sr-only">{s.adventure.starsLabel(stars)}</span>
      </span>
      {diamonds > 0 && (
        <span class="inline-flex items-center gap-1">
          <IconDiamond class="text-accent" />
          <span aria-hidden="true" data-testid="adventure-diamonds">
            {diamonds}
          </span>
          <span class="sr-only">{s.adventure.diamondsLabel(diamonds)}</span>
        </span>
      )}
    </span>
  );
}

/** A world's end: its diamond, bright once earned. */
export function DiamondGoal({
  world,
  earned,
  small = false,
}: {
  world: number;
  earned: boolean;
  /** Sized for the overview's strip of steps. */
  small?: boolean;
}) {
  const s = t();
  return (
    <span
      class={classNames("flex justify-center text-accent", !earned && "opacity-40")}
      data-testid="adventure-diamond"
      data-earned={earned || undefined}
    >
      <IconDiamond size={small ? "1.75rem" : "2.5rem"} />
      <span class="sr-only">{s.adventure.diamond(world, earned)}</span>
    </span>
  );
}
