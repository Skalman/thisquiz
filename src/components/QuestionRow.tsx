import { memo } from "preact/compat";
import type { RenderedQuestion, Marks } from "../engine/types.ts";
import { LETTERS } from "../engine/types.ts";
import type { Validity } from "../engine/state.ts";
import { OptionButton } from "./OptionButton.tsx";
import type { SweepKind } from "./OptionButton.tsx";
import { LetterChip } from "./LetterChip.tsx";
import { useDesign } from "./DesignContext.tsx";
import { classNames, tw } from "../lib/classNames.ts";
import type { Design } from "../lib/design.ts";
import { splitBoardText } from "../lib/boardText.ts";
import { t } from "../i18n/index.ts";

interface Props {
  index: number;
  question: RenderedQuestion;
  marks: Marks;
  validity: Validity;
  disabled?: boolean;
  /** Bitmask of options this question had marked at the last checkpoint. */
  checkpointedMask?: number;
  /** Bitmask of options playing the checkpointed sweep right now. */
  sweepMask?: number;
  sweepKind?: SweepKind;
  focusedOption?: number | null;
  defaultFocus?: boolean;
  onOptionClick: (questionIndex: number, optionIndex: number) => void;
}

/**
 * The bar down a question's left edge, in styles that read without color.
 * Widths stay in px: the pending and invalid states are dotted and double
 * borders, which need whole pixels to render as two lines rather than
 * collapsing to solid at the smaller root font sizes.
 */
const VALIDITY_BAR: Record<Validity, string> = {
  neutral: tw`relative w-(--bar) before:absolute before:inset-y-0 before:right-(--bar-inset) before:left-0 before:rounded-full before:bg-neutral-bar`,
  valid: tw`w-(--bar) rounded-full bg-valid`,
  consistent: tw`w-(--bar) rounded-full bg-valid`,
  pending: tw`w-0 border-l-(length:--bar) border-dotted border-pending`,
  invalid: tw`w-0 border-l-(length:--bar) border-double border-invalid`,
};

/** The bar's gap and width, per design; play's is twice as wide. */
const BAR: Record<Design, string> = {
  zen: tw`mr-2 [--bar-inset:1px] [--bar:4px]`,
  play: tw`mr-3 [--bar-inset:2px] [--bar:8px]`,
};

/** Row spacing per design: zen ruled, play spaced. */
const ROW: Record<Design, string> = {
  zen: tw`border-b py-2 lg:row-span-2 lg:grid-rows-subgrid`,
  // Two columns from the play board's own breakpoint.
  play: tw`py-5 xl:row-span-2 xl:grid-rows-subgrid`,
};
const HEADING: Record<Design, string> = {
  zen: tw`mb-1 flex gap-1.5`,
  // Inline, so text wraps on after the label.
  play: tw`mb-2.5 text-section leading-relaxed`,
};
const OPTIONS_GAP: Record<Design, string> = {
  zen: tw`gap-1`,
  play: tw`gap-1 xs:gap-1.5`,
};

/** Play's question text; tokens never break from their words. */
function PlayText({ text }: { text: string }) {
  return (
    <span class="group-has-focus-visible:text-accent">
      {splitBoardText(text).map((part, i) => {
        if (part.kind === "text") {
          // oxlint-disable-next-line react/no-array-index-key
          return <span key={i}>{part.text}</span>;
        }
        return (
          // oxlint-disable-next-line react/no-array-index-key
          <span key={i} class="whitespace-nowrap">
            {part.lead}
            {part.kind === "letter" ? (
              <LetterChip letter={part.letter} class="mx-[0.2em]" />
            ) : (
              <span class="rounded-full bg-hover px-1.5 font-bold">#{part.number}</span>
            )}
            {part.tail}
          </span>
        );
      })}
    </span>
  );
}

function marksEqual(a: Marks, b: Marks): boolean {
  for (let i = 0; i < 5; i++) if (a[i] !== b[i]) return false;
  return true;
}

export const QuestionRow = memo(
  function QuestionRow({
    index,
    question,
    marks,
    validity,
    disabled,
    checkpointedMask = 0,
    sweepMask = 0,
    sweepKind = "settle",
    focusedOption,
    defaultFocus,
    onOptionClick,
  }: Props) {
    const design = useDesign();
    // Claims stack, one per line.
    const isClaims = question.options.some((option) => option.labelKind === "claim");
    const correctIdx = marks.indexOf("correct");
    const hasCorrect = correctIdx >= 0;
    const isCheckpointed = (oi: number) => ((checkpointedMask >> oi) & 1) === 1;
    const answerVerified = hasCorrect && isCheckpointed(correctIdx);

    return (
      <div
        class={`group grid scroll-mb-20 grid-cols-[auto_1fr] grid-rows-[auto_auto] ${ROW[design]}`}
        data-row={index}
      >
        <div
          class={`row-span-full shrink-0 self-stretch ${BAR[design]} ${VALIDITY_BAR[validity]}`}
          data-validity-bar
        />
        <div class={`col-start-2 ${HEADING[design]}`}>
          {design === "play" ? (
            <>
              <span class="me-1.5 font-extrabold whitespace-nowrap text-accent">
                {t().puzzle.questionLabel(index + 1)}
              </span>
              <PlayText text={question.text} />
            </>
          ) : (
            <>
              <span class="shrink-0 text-body font-bold text-muted group-has-focus-visible:text-accent">
                {index + 1}.
              </span>
              <span class="text-body group-has-focus-visible:text-accent">{question.text}</span>
            </>
          )}
        </div>
        <div
          class={classNames(
            "col-start-2 flex self-start *:flex-1",
            OPTIONS_GAP[design],
            isClaims && "flex-col *:whitespace-normal",
          )}
        >
          {question.options.map((option, oi) => (
            <OptionButton
              key={LETTERS[oi]}
              index={oi}
              questionIndex={index}
              label={option.label}
              labelKind={option.labelKind}
              mark={marks[oi]}
              implied={hasCorrect && marks[oi] === "unmarked"}
              answered={hasCorrect}
              blocked={disabled || (hasCorrect && marks[oi] !== "correct")}
              checkpointed={isCheckpointed(oi)}
              // One pin per verified answer; none once solved.
              showLock={!disabled && isCheckpointed(oi) && (!answerVerified || oi === correctIdx)}
              sweep={((sweepMask >> oi) & 1) === 1}
              sweepKind={sweepKind}
              focused={focusedOption === oi || (defaultFocus && oi === 0)}
              onClick={() => onOptionClick(index, oi)}
            />
          ))}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.index === next.index &&
    prev.question === next.question &&
    marksEqual(prev.marks, next.marks) &&
    prev.validity === next.validity &&
    prev.disabled === next.disabled &&
    prev.checkpointedMask === next.checkpointedMask &&
    prev.sweepMask === next.sweepMask &&
    prev.sweepKind === next.sweepKind &&
    prev.focusedOption === next.focusedOption &&
    prev.defaultFocus === next.defaultFocus &&
    prev.onOptionClick === next.onOptionClick,
);
