import { useMemo } from "preact/hooks";
import type { Marks } from "../engine/types.ts";
import type { ArrowSpec, StepCopy, TutorialPuzzle } from "../puzzles/tutorial.ts";
import { currentStep } from "../puzzles/tutorial.ts";
import { usePressGuard } from "./usePressGuard.ts";
import { pointerKind } from "../lib/pointer.ts";
import { t } from "../i18n/index.ts";

export interface TutorialState {
  /** The words to show: the step's, or the solved line once solved. */
  message: StepCopy | null;
  /** Every copy the panel may show, to size it by. */
  copies: StepCopy[];
  arrow: ArrowSpec | null;
  /** Names the step, so its arrow redraws only when the step changes. */
  arrowKey: string;
  /** Whether a press on this cell counts; a cell step drops quick doubles. */
  acceptsPress: (qi: number, oi: number) => boolean;
}

/** The tutorial's current step, and which cells take presses. */
export function useTutorial(
  puzzle: TutorialPuzzle | null,
  marks: Marks[],
  completed: boolean,
): TutorialState | null {
  const takePress = usePressGuard();
  const view = useMemo(() => {
    if (!puzzle) return null;
    const s = t().tutorial;
    const stepCopy = s.steps(pointerKind());
    const solved = puzzle.solved ? s.solved[puzzle.solved] : null;
    const step = completed ? null : currentStep(puzzle.steps, marks);
    const copies = puzzle.steps.map((x) => stepCopy[x.key]);
    return {
      target: step?.target ?? null,
      message: step ? stepCopy[step.key] : solved,
      copies: solved ? [...copies, solved] : copies,
      arrow: step?.arrow ?? null,
      arrowKey: step?.key ?? "",
    };
  }, [puzzle, marks, completed]);
  if (!view) return null;
  const { target, ...shown } = view;
  return {
    ...shown,
    acceptsPress: (qi, oi) => {
      if (target?.type === "solve") return true;
      if (target === null || target.qi !== qi || target.oi !== oi) return false;
      return takePress();
    },
  };
}
