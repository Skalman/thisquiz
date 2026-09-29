import { useRef, useEffect } from "preact/hooks";
import logoSvg from "../assets/logo.svg?raw";
import { t } from "../i18n/index.ts";
import { classNames, tw } from "../lib/classNames.ts";
import type { Design } from "../lib/design.ts";
import { useDesign } from "./DesignContext.tsx";

let replayFn: (() => void) | null = null;

export function replayLogoAnimation() {
  replayFn?.();
}

/** The logo's framing, per design; play's lip matches the SVG's fill. */
const LOOK: Record<Design, string> = {
  zen: tw`[&_svg]:rounded-sm`,
  play: tw`relative rounded-[20%] shadow-lip [--lip:color-mix(in_srgb,#6366f1,black_30%)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-(image:--gloss) active:translate-y-0.5 active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-100 [&_svg]:rounded-[20%]`,
};

export function Logo() {
  const s = t();
  const design = useDesign();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const svg = el.querySelector("svg");
    if (!svg) return undefined;

    const replay = () => {
      svg.classList.add("replay");
      void el.offsetHeight;
      svg.classList.remove("replay");
    };

    el.addEventListener("mouseenter", replay);
    el.addEventListener("click", replay);
    el.addEventListener("focus", replay);
    replayFn = replay;
    return () => {
      replayFn = null;
    };
  }, []);
  return (
    <span
      ref={ref}
      class={classNames("inline-block size-[1.4em] cursor-pointer [&_svg]:size-full", LOOK[design])}
      tabIndex={0}
      role="img"
      aria-label={s.aria.logo}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
}
