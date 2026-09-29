import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren, Ref } from "preact";
import type { ExplainStep } from "../engine/hint-types.ts";
import { arrowNavHandler } from "../lib/keyboard.ts";
import { t } from "../i18n/index.ts";
import { HintStep } from "./HintStep.tsx";
import { IconUndo, IconRedo, IconPin, IconHint, IconReplay } from "./Icons.tsx";
import { Button, ButtonLink } from "./ui/Button.tsx";

function HintBox({ children }: { children: ComponentChildren }) {
  return (
    <div
      class="mt-3 flex items-center justify-between gap-2 rounded-lg border border-accent bg-accent-soft px-4 py-2.5 text-body text-accent"
      data-testid="hint-panel"
    >
      {children}
    </div>
  );
}

/** The hint so far, with a button for its next step while there is one. */
export function HintPanel({ step, onMore }: { step: ExplainStep; onMore?: () => void }) {
  const s = t();
  return (
    <HintBox>
      <HintStep step={step} />
      {onMore && (
        <Button variant="outline" size="sm" class="shrink-0" onClick={onMore}>
          {s.puzzle.more}
        </Button>
      )}
    </HintBox>
  );
}

/** Every step of the hint at once, the way debug mode shows it. */
export function DebugHintPanel({ steps }: { steps: ExplainStep[] }) {
  return (
    <HintBox>
      <ol class="list-decimal">
        {steps.map((step, i) => (
          // oxlint-disable-next-line react/no-array-index-key
          <li key={i}>
            <HintStep step={step} />
          </li>
        ))}
      </ol>
    </HintBox>
  );
}

/** The Checkpoint button's verdict; a click anywhere on it dismisses it. */
export function CheckpointNote({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const s = t();
  return (
    <div
      class="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border bg-surface px-4 py-2.5 text-body text-muted"
      role="status"
      onClick={onDismiss}
    >
      <span>{text}</span>
      <button
        class="ms-auto flex-none cursor-pointer text-[1.1em] leading-none opacity-70 hover:opacity-100"
        aria-label={s.aria.dismiss}
        onClick={onDismiss}
      >
        &times;
      </button>
    </div>
  );
}

/** The controls a press can land on, for the toolbar's arrow keys and tab stop. */
export const ENABLED_CONTROL = "button:not(:disabled)";

/** Undo, redo, checkpoint and hint, as one arrow-key toolbar. */
export function PuzzleControls({
  toolbarRef,
  checkpointRef,
  hintRef,
  canUndo,
  canRedo,
  canCheckpoint,
  onUndo,
  onRedo,
  onCheckpoint,
  onHint,
  onHintIntent,
}: {
  toolbarRef: Ref<HTMLDivElement>;
  checkpointRef: Ref<HTMLButtonElement>;
  hintRef: Ref<HTMLButtonElement>;
  canUndo: boolean;
  canRedo: boolean;
  canCheckpoint: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCheckpoint: () => void;
  onHint: () => void;
  /** A pointer or focus nearing the Hint button, so the solution can load ahead. */
  onHintIntent: () => void;
}) {
  const s = t();
  return (
    <div
      ref={toolbarRef}
      class="flex flex-none items-center gap-1 py-2"
      role="toolbar"
      onKeyDown={arrowNavHandler(ENABLED_CONTROL)}
    >
      <Button
        variant="outline-muted"
        size="icon"
        icon={<IconUndo />}
        onClick={onUndo}
        disabled={!canUndo}
        title={s.puzzle.undo}
      />
      <Button
        variant="outline-muted"
        size="icon"
        icon={<IconRedo />}
        onClick={onRedo}
        disabled={!canRedo}
        title={s.puzzle.redo}
      />
      <Button
        variant="ghost"
        size="md-compact"
        icon={<IconPin class="text-valid in-disabled:text-inherit" />}
        ref={checkpointRef}
        onClick={onCheckpoint}
        disabled={!canCheckpoint}
      >
        {s.puzzle.checkpoint}
      </Button>
      <Button
        variant="ghost"
        size="md-compact"
        icon={<IconHint class="text-pending" />}
        ref={hintRef}
        onClick={onHint}
        onMouseEnter={onHintIntent}
        onFocus={onHintIntent}
        onTouchStart={onHintIntent}
        title={s.puzzle.hint}
      >
        {s.puzzle.hint}
      </Button>
    </div>
  );
}

/** How long Play again calls attention to itself after a cue. */
const CUE_MS = 1800;

/** Clears the board for another run; two presses, since it's final. */
function PlayAgainButton({ onPlayAgain, cue }: { onPlayAgain: () => void; cue: number }) {
  const s = t();
  const [armed, setArmed] = useState(false);
  const [cued, setCued] = useState(false);
  useEffect(() => {
    if (cue === 0) return undefined;
    setCued(true);
    const timer = setTimeout(() => setCued(false), CUE_MS);
    return () => clearTimeout(timer);
  }, [cue]);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      // Keyed on the cue to restart the animation.
      key={cue}
      // Both looks have borders, so arming keeps the size.
      variant={armed ? "danger" : "outline-muted"}
      class={
        cued
          ? "motion-safe:animate-attention motion-reduce:bg-accent-soft motion-reduce:outline-3 motion-reduce:outline-accent"
          : undefined
      }
      icon={<IconReplay size="1em" />}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onPlayAgain();
      }}
    >
      {armed ? s.puzzle.playAgainConfirm : s.puzzle.playAgain}
    </Button>
  );
}

/** The solved board's ways onward, held to the row's end. */
export function CompletionBar({
  barRef,
  nextRef,
  quiet,
  hasNext,
  replayCue,
  onPlayAgain,
  onSummary,
  onNext,
}: {
  barRef: Ref<HTMLDivElement>;
  /** A callback, so one ref takes whichever element renders: the button or the link. */
  nextRef: (el: HTMLElement | null) => void;
  /** While the solved dialog shows the same ways onward. */
  quiet: boolean;
  hasNext: boolean;
  /** Bumped per press on the solved board, cueing Play again. */
  replayCue: number;
  onPlayAgain: () => void;
  onSummary: () => void;
  onNext: () => void;
}) {
  const s = t();
  // Only the colors change, so going quiet doesn't resize the button.
  const nextVariant = quiet ? "next-muted" : "next";
  return (
    <div
      ref={barRef}
      class="ms-auto flex flex-none items-center gap-2 self-start py-2"
      data-testid="completion-bar"
      aria-label={s.puzzle.solved}
    >
      <PlayAgainButton onPlayAgain={onPlayAgain} cue={replayCue} />
      <Button variant="ghost" onClick={onSummary}>
        {s.puzzle.summary}
      </Button>
      {hasNext ? (
        <Button variant={nextVariant} ref={nextRef} onClick={onNext}>
          {s.puzzle.nextPuzzle} &rarr;
        </Button>
      ) : (
        <ButtonLink variant={nextVariant} ref={nextRef} href="/archive">
          {s.daily.archive} &rarr;
        </ButtonLink>
      )}
    </div>
  );
}
