import { letterIdx } from "../engine/types.ts";
import { classNames, tw } from "../lib/classNames.ts";

/** Points the `--letter*` variables at one letter's colors. */
export const LETTER_VARS = [
  tw`[--letter-soft:var(--letter-a-soft)] [--letter-text:var(--letter-a-text)] [--letter:var(--letter-a)] [--on-letter:var(--on-letter-a)]`,
  tw`[--letter-soft:var(--letter-b-soft)] [--letter-text:var(--letter-b-text)] [--letter:var(--letter-b)] [--on-letter:var(--on-letter-b)]`,
  tw`[--letter-soft:var(--letter-c-soft)] [--letter-text:var(--letter-c-text)] [--letter:var(--letter-c)] [--on-letter:var(--on-letter-c)]`,
  tw`[--letter-soft:var(--letter-d-soft)] [--letter-text:var(--letter-d-text)] [--letter:var(--letter-d)] [--on-letter:var(--on-letter-d)]`,
  tw`[--letter-soft:var(--letter-e-soft)] [--letter-text:var(--letter-e-text)] [--letter:var(--letter-e)] [--on-letter:var(--on-letter-e)]`,
];

/** An answer letter, circled in its own color. */
export function LetterChip({ letter, class: extraClass }: { letter: string; class?: string }) {
  return (
    <span
      class={classNames(
        "inline-flex size-[1.6em] shrink-0 items-center justify-center rounded-full bg-(--letter) align-middle text-[0.85em] leading-none font-bold text-(--on-letter) ring-2 ring-(--bg-surface)",
        LETTER_VARS[letterIdx(letter)],
        extraClass,
      )}
    >
      {letter}
    </span>
  );
}
