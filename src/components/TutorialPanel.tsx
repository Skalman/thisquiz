import { useEffect, useState } from "preact/hooks";
import type { StepCopy } from "../puzzles/tutorial.ts";
import { classNames } from "../lib/classNames.ts";
import { COACH_TEXT } from "./coachStyles.ts";
import { Button } from "./ui/Button.tsx";
import { t } from "../i18n/index.ts";

function StepText({
  copy,
  class: extraClass,
  testId,
}: {
  copy: StepCopy;
  class: string;
  testId?: string;
}) {
  return (
    <div
      class={classNames(COACH_TEXT, "col-start-1 row-start-1 max-w-lg space-y-1.5", extraClass)}
      data-testid={testId}
    >
      {copy.lead && <p class="font-semibold">{copy.lead}</p>}
      <p>{copy.text}</p>
    </div>
  );
}

/**
 * The tutorial's text above the board. Every copy in `steps` sits unseen in
 * one grid area, sizing it to the tallest, so nothing moves.
 */
export function TutorialPanel({
  message,
  steps,
  boxRef,
}: {
  message: StepCopy | null;
  steps: StepCopy[];
  boxRef?: { current: HTMLDivElement | null };
}) {
  // Filled after mount: a live region's first content goes unannounced.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div
      ref={boxRef}
      class="mb-8 grid place-items-center px-4 py-1.5 text-center"
      aria-live="polite"
    >
      {steps.map((copy, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <StepText key={`sizer-${i}`} copy={copy} class="invisible" />
      ))}
      {mounted && message && (
        <StepText
          key={`shown-${message.text}`}
          copy={message}
          class="text-default motion-safe:animate-coach-fade-in"
          testId="tutorial-step"
        />
      )}
    </div>
  );
}

/** Where the tutorial can send the player, with its own button. */
export interface TutorialDestination {
  label: string;
  testId: string;
  onClick: () => void;
}

/** The tutorial's Next: holds its place unseen, then fades in when `shown`. */
export function TutorialNext({
  shown,
  label = t().tutorial.next,
  class: extraClass,
  testId = "tutorial-next",
  onClick,
}: {
  shown: boolean;
  label?: string;
  class?: string;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="next"
      class={classNames(shown ? "motion-safe:animate-tutorial-next" : "invisible", extraClass)}
      onClick={onClick}
      data-testid={testId}
    >
      {label} &rarr;
    </Button>
  );
}
