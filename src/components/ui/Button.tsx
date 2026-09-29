import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentChildren } from "preact";
import { forwardRef } from "preact/compat";
import { classNames, tw } from "../../lib/classNames.ts";
import type { Design } from "../../lib/design.ts";
import { useDesign } from "../DesignContext.tsx";

/**
 * The app's button looks: the accent fill; the solved green that leads onward,
 * and its muted copy for while the solved dialog carries the loud one; the
 * accent outline, and its muted copy; bare muted text; and danger's red.
 */
export type ButtonVariant =
  | "primary"
  | "next"
  | "next-muted"
  | "outline"
  | "outline-muted"
  | "ghost"
  | "danger";

/** Shared per design: zen's box, play's candy pill. */
const BASE: Record<Design, string> = {
  zen: tw`rounded-md`,
  play: tw`rounded-pill border-2 bg-(image:--gloss) font-bold whitespace-nowrap shadow-lip motion-safe:transition-[translate,box-shadow] motion-safe:duration-100 active:not-disabled:translate-y-0.5 active:not-disabled:shadow-none disabled:opacity-40 disabled:shadow-none`,
};

const FILLED = tw`font-semibold whitespace-nowrap`;
const MUTED = tw`text-muted hover:not-disabled:bg-hover hover:not-disabled:text-default`;

/** Colors and border; borderless looks leave it to callers. */
const ZEN_LOOK: Record<ButtonVariant, string> = {
  primary: tw`${FILLED} shrink-0 bg-accent text-on-accent hover:opacity-90`,
  next: tw`${FILLED} border-2 border-valid bg-valid-fill text-default hover:opacity-90`,
  "next-muted": tw`${FILLED} border-2 bg-surface text-muted hover:opacity-90`,
  outline: tw`${FILLED} border border-accent text-accent hover:bg-accent hover:text-on-accent`,
  "outline-muted": tw`${MUTED} border disabled:opacity-30`,
  ghost: tw`${MUTED} disabled:opacity-35`,
  danger: tw`border border-invalid bg-invalid-soft text-invalid`,
};

/** Quiet: surface on a border-colored lip. */
const QUIET = tw`bg-surface [--lip:var(--border)]`;

const PLAY_LOOK: Record<ButtonVariant, string> = {
  primary: tw`shrink-0 border-accent bg-accent text-on-accent [--lip:color-mix(in_srgb,var(--accent),black_30%)]`,
  next: tw`border-valid bg-valid-fill text-default [--lip:var(--valid)]`,
  "next-muted": tw`${QUIET} text-muted`,
  outline: tw`border-accent bg-surface text-accent [--lip:var(--accent)]`,
  "outline-muted": tw`${QUIET} text-default`,
  ghost: tw`${QUIET} text-default`,
  danger: tw`border-invalid bg-invalid-soft text-invalid [--lip:var(--invalid)]`,
};

const LOOK: Record<Design, Record<ButtonVariant, string>> = {
  zen: ZEN_LOOK,
  play: PLAY_LOOK,
};

/**
 * Small for inline follow-ups, large for a dialog's lead or rows, icon for a
 * square glyph button; `md-compact` is `md` with tight padding, for the header's
 * tight controls.
 */
export type ButtonSize = "sm" | "md" | "md-compact" | "lg" | "icon";

/** Shared layout and cursor for every button. */
const LAYOUT = tw`inline-flex cursor-pointer items-center justify-center gap-[0.3em] disabled:cursor-default`;

/** Type size, the same in either design. */
const TEXT: Record<ButtonSize, string> = {
  sm: tw`text-caption`,
  md: tw`text-chrome`,
  "md-compact": tw`text-chrome`,
  lg: tw`text-section`,
  icon: tw`text-section`,
};

/** Padding, or the square's size: play's buttons are roomier. */
const PAD: Record<Design, Record<ButtonSize, string>> = {
  zen: {
    sm: tw`px-2 py-0.5`,
    md: tw`px-3 py-1.5`,
    "md-compact": tw`px-1.5 py-1.5`,
    lg: tw`px-5 py-2.5`,
    icon: tw`size-8`,
  },
  play: {
    sm: tw`px-3 py-1`,
    md: tw`px-4 py-2`,
    "md-compact": tw`px-3.5 py-2`,
    lg: tw`px-6 py-3`,
    icon: tw`size-10`,
  },
};

interface Styling {
  variant: ButtonVariant;
  size?: ButtonSize;
  /** Added to the look and size; for what they leave alone, like width, margins or a shadow. */
  class?: string;
}

/** Button classes, also for elements dressed as buttons. */
export function buttonClass({
  variant,
  size = "md",
  design,
  class: extraClass,
}: Styling & { design: Design }): string {
  return classNames(
    LAYOUT,
    BASE[design],
    LOOK[design][variant],
    TEXT[size],
    PAD[design][size],
    extraClass,
  );
}

type Styled<Attributes> = Omit<Attributes, "class" | "className" | "size" | "icon"> &
  Styling & {
    /** Leads the label, at its default size (the text's own); alone, it is the whole button. */
    icon?: ComponentChildren;
  };

export const Button = forwardRef<HTMLButtonElement, Styled<ButtonHTMLAttributes>>(function Button(
  { variant, size, class: extraClass, icon, children, ...rest },
  ref,
) {
  const design = useDesign();
  return (
    <button ref={ref} class={buttonClass({ variant, size, design, class: extraClass })} {...rest}>
      {icon}
      {children}
    </button>
  );
});

/** A link in a button's clothes. */
export const ButtonLink = forwardRef<HTMLAnchorElement, Styled<AnchorHTMLAttributes>>(
  function ButtonLink({ variant, size, class: extraClass, icon, children, ...rest }, ref) {
    const design = useDesign();
    return (
      <a ref={ref} class={buttonClass({ variant, size, design, class: extraClass })} {...rest}>
        {icon}
        {children}
      </a>
    );
  },
);
