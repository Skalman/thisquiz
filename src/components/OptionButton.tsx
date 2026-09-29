import type { ComponentChildren } from "preact";
import type { OptionLabelKind, OptionMark } from "../engine/types.ts";
import { LETTERS } from "../engine/types.ts";
import { IconCheck, IconPin, IconX } from "./Icons.tsx";
import { LETTER_VARS, LetterChip } from "./LetterChip.tsx";
import { useDesign } from "./DesignContext.tsx";
import { classNames, tw } from "../lib/classNames.ts";
import type { Design } from "../lib/design.ts";

/** Why a cell sweeps: verified, or a press refused. */
export type SweepKind = "settle" | "refuse";

interface Props {
  index: number;
  questionIndex: number;
  label: string;
  /** What the label stands for, so the play design can decorate it. */
  labelKind: OptionLabelKind;
  mark: OptionMark;
  implied?: boolean;
  /** Its question is answered; play hides its crosses. */
  answered?: boolean;
  /** Verified by a checkpoint: still clickable, but the click only sweeps. */
  checkpointed?: boolean;
  /** Solved, or another option answers it: the press only sweeps. */
  blocked?: boolean;
  /** Shows the lock pin: verified, and no verified answer covers it. */
  showLock?: boolean;
  sweep?: boolean;
  sweepKind?: SweepKind;
  focused?: boolean;
  onClick: () => void;
}

/** A cell, in either design: one line, focus ring over its neighbors. */
const CELL = tw`inline-flex items-center text-option whitespace-nowrap focus-visible:z-1 focus-visible:-outline-offset-1`;

const CELL_LOOK: Record<Design, string> = {
  zen: tw`gap-[0.45em] rounded-md border px-1 py-1.5 text-left text-default transition-[background,border-color,opacity] duration-100 hover:not-aria-disabled:bg-hover`,
  // A candy pill with a pressable lip; its own layer.
  play: tw`relative gap-2 rounded-pill border-2 bg-(image:--gloss) py-2.5 font-semibold will-change-[transform,translate] motion-safe:transition-[translate,box-shadow,opacity] motion-safe:duration-100 active:not-aria-disabled:translate-y-0.5 active:not-aria-disabled:shadow-none`,
};

/** Play's open cell: letter-colored edge, tint and lip. */
const PLAY_OPEN = tw`border-(--letter) bg-(--letter-soft) text-default shadow-lip [--lip:var(--letter)]`;

/** Play's answer: solid letter fill, deeper lip. */
const PLAY_ANSWER = tw`border-(--letter) bg-(--letter) text-(--on-letter) shadow-lip [--lip:color-mix(in_srgb,var(--letter),black_30%)]`;

/**
 * The checkpointed sweep, in the pin's green: one diagonal wave over the cells
 * a checkpoint just settled, or the one cell a click bounced off. Each cell's
 * overlay paints its window of one shared gradient, a square three board spans
 * (width plus height) wide, shifted by the cell's diagonal distance from the
 * sweep's origin (`--sweep-d`, set from script; `background-attachment: fixed`
 * would do it alone, but not on iOS). The wave moves as a background position
 * rather than a transform, so it stays unclipped in the padding box: overflow
 * would make the cell a scroll container, clip-path eats the border edge.
 * Along the gradient: a ramp to 50%, a 1.4-span plateau, a 0.4-span tail.
 */
const SWEEP = tw`relative after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-[linear-gradient(135deg,transparent_20%,var(--tint)_26.67%,var(--tint)_45%,transparent_50%)] after:bg-size-[calc(3*var(--sweep-span))_calc(3*var(--sweep-span))] after:bg-no-repeat after:animate-checkpoint-sweep after:[--tint:color-mix(in_srgb,var(--valid)_35%,transparent)] motion-reduce:after:animate-none motion-reduce:after:bg-none motion-reduce:after:bg-[color-mix(in_srgb,var(--valid)_25%,transparent)]`;

/** Play's sweeps: a hop per verified cell, a wiggle on refusal. */
const PLAY_SWEEP: Record<SweepKind, string> = {
  settle: tw`motion-safe:animate-hop`,
  refuse: tw`motion-safe:animate-wiggle motion-reduce:outline-2 motion-reduce:outline-offset-2 motion-reduce:outline-invalid`,
};

/** The lock pin's pulse, in wave order when settling. */
const LOCK_CUE: Record<SweepKind, string> = {
  settle: tw`motion-safe:animate-lock-settle motion-reduce:scale-125`,
  refuse: tw`motion-safe:animate-sticker-pulse motion-reduce:scale-125`,
};

/** The top-right sticker row, outside the layout. */
const STICKERS = tw`pointer-events-none absolute -top-3 -right-1 flex items-center -space-x-1.5`;

/** One play sticker. */
const STICKER = tw`inline-flex size-6 items-center justify-center rounded-full text-on-accent shadow-floating ring-2 ring-(--bg-surface)`;

/** The lock pin, drawn twice for a crisp surface-colored edge. */
function LockSticker({ cue }: { cue: SweepKind | null }) {
  return (
    <span
      class={classNames(
        "relative inline-flex rotate-[30deg] [filter:drop-shadow(0_1px_1px_rgb(0_0_0/0.3))]",
        cue !== null && LOCK_CUE[cue],
      )}
      data-testid="lock-sticker"
    >
      <IconPin size="1.5rem" strokeWidth={5} class="absolute inset-0 text-(--bg-surface)" />
      <IconPin
        size="1.5rem"
        class="relative fill-valid text-[color-mix(in_srgb,var(--valid),black_15%)]"
      />
    </span>
  );
}

/** The mark sticker: a check or cross, popping in. */
function MarkSticker({ mark }: { mark: "correct" | "incorrect" }) {
  return (
    <span
      class={classNames(
        STICKER,
        "-rotate-12 motion-safe:animate-pop",
        mark === "correct" ? "bg-valid" : "bg-invalid",
      )}
    >
      {mark === "correct" ? (
        <IconCheck size="0.8rem" strokeWidth={4} />
      ) : (
        <IconX size="0.8rem" strokeWidth={4} />
      )}
    </span>
  );
}

/** The zen cell's colors, from its mark and sweep. */
function zenLook(mark: OptionMark, showCross: boolean, sweep: boolean) {
  return classNames(
    sweep
      ? "border-valid"
      : mark === "correct"
        ? "border-accent"
        : showCross
          ? "border-muted"
          : undefined,
    showCross && "border-dashed",
    mark === "correct" ? "bg-accent-soft" : showCross ? "bg-invalid-soft" : "bg-surface",
  );
}

/** Play's colors: tinted, solid when answered, faded when eliminated. */
function playLook(index: number, mark: OptionMark, showCross: boolean) {
  return classNames(
    LETTER_VARS[index],
    mark === "correct" ? PLAY_ANSWER : PLAY_OPEN,
    showCross && "opacity-55 shadow-none",
  );
}

/** Play's label: letters circled, questions as "#n". */
function playLabel(label: string, labelKind: OptionLabelKind): ComponentChildren {
  if (labelKind === "letter") return <LetterChip letter={label} />;
  if (labelKind === "question" || labelKind === "pair") return `#${label}`;
  return label;
}

export function OptionButton({
  index,
  questionIndex,
  label,
  labelKind,
  mark,
  implied,
  answered,
  checkpointed,
  blocked,
  showLock,
  sweep,
  sweepKind = "settle",
  focused,
  onClick,
}: Props) {
  const design = useDesign();
  const play = design === "play";
  const letter = LETTERS[index];
  const title = `${letter}: ${label}`;

  const showCross = mark === "incorrect" || implied === true;
  // The answer's check, or a cross while unanswered.
  const markSticker =
    mark === "correct" || (mark === "incorrect" && answered !== true) ? mark : null;

  return (
    <button
      class={classNames(
        CELL,
        CELL_LOOK[design],
        play ? playLook(index, mark, showCross) : zenLook(mark, showCross, sweep === true),
        // Centered, except claims, which get roomier padding.
        play && (labelKind === "claim" ? "px-4 text-left" : "justify-center px-1.5 text-center"),
        blocked || checkpointed ? "cursor-not-allowed" : "cursor-pointer",
        sweep && (play ? PLAY_SWEEP[sweepKind] : SWEEP),
      )}
      onClick={onClick}
      aria-disabled={checkpointed || blocked}
      title={title}
      aria-label={title}
      tabIndex={focused ? 0 : -1}
      data-qi={questionIndex}
      data-oi={index}
      data-mark={mark}
      data-sweep={sweep || undefined}
    >
      {play ? (
        <>
          {(markSticker !== null || showLock === true) && (
            <span class={STICKERS} aria-hidden="true">
              {/* Keyed on the mark, so a new one pops in afresh. */}
              {markSticker !== null && <MarkSticker key={markSticker} mark={markSticker} />}
              {showLock === true && <LockSticker cue={sweep === true ? sweepKind : null} />}
            </span>
          )}
          <span class="inline-flex items-center gap-1 xs:gap-1.5">
            <span
              class={classNames("font-extrabold", mark !== "correct" && "text-(--letter-text)")}
            >
              {letter}.
            </span>
            {playLabel(label, labelKind)}
          </span>
        </>
      ) : (
        <>
          <span class="inline-flex size-[1.4em] shrink-0 items-center justify-center">
            {mark === "correct" ? (
              <IconCheck size="1.4em" strokeWidth={4} class="text-valid" />
            ) : showCross ? (
              <IconX size="1.4em" strokeWidth={4} class="text-invalid" />
            ) : (
              <span class="inline-block size-[1.4em]" />
            )}
          </span>
          <span class={showCross ? "opacity-45" : undefined}>
            <span class="text-caption font-bold opacity-45">{letter}.</span> {label}
          </span>
        </>
      )}
    </button>
  );
}
