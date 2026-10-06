import { useLayoutEffect, useRef } from "preact/hooks";
import { t } from "../i18n/index.ts";
import { classNames } from "../lib/classNames.ts";
import { arrowPaths, arrowTip, tipOffset, type Box } from "../lib/noteArrow.ts";
import { Brand } from "./Brand.tsx";
import { Logo } from "./Logo.tsx";

/** How far below the name the note hangs, in em of the name. */
const NOTE_DROP = 0.38;
/** The note's left edge past the start of "Quiz", in em, before following the tip. */
const NOTE_INSET = 0.15;
/** The arrow's start: left of the note's edge in em, and down it as a share of its height. */
const START_GAP = 0.22;
const START_HEIGHT = 0.42;
const STROKE = 0.055;

/**
 * The title: logo and name, with the tagline as a handwritten note below whose
 * arrow points up at "This". The note and arrow are placed from the name as
 * rendered, since its width follows the device's font.
 */
export function BrandTitle({ class: extraClass, inert }: { class?: string; inert?: boolean }) {
  const s = t();
  const root = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLParagraphElement>(null);
  const arrow = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const box = root.current;
    const noteEl = note.current;
    const svg = arrow.current;
    const title = box?.querySelector("h1");
    const thisWord = box?.querySelector("[data-brand-word=this]");
    const quizWord = box?.querySelector("[data-brand-word=quiz]");
    if (!box || !noteEl || !svg || !title || !thisWord || !quizWord) return undefined;
    let live = true;

    const place = () => {
      if (!live) return;
      const size = parseFloat(getComputedStyle(box).fontSize);
      const within = (el: Element): Box => {
        const origin = box.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return {
          left: r.left - origin.left,
          top: r.top - origin.top,
          width: r.width,
          height: r.height,
        };
      };

      // The note moves with the tip, so the arrow keeps its shape.
      noteEl.style.marginTop = `${NOTE_DROP * size}px`;
      noteEl.style.marginLeft = `${within(quizWord).left + NOTE_INSET * size + tipOffset(within(thisWord), size)}px`;
      // The note juts out past the name; taking that back out of the box's
      // width centers the name, with the note hanging off to the right.
      box.style.marginRight = `${title.offsetWidth - box.offsetWidth}px`;

      const noteBox = within(noteEl);
      const start = {
        x: noteBox.left - START_GAP * size,
        y: noteBox.top + noteBox.height * START_HEIGHT,
      };
      const { line, head } = arrowPaths(start, arrowTip(within(thisWord), size), size);
      svg.setAttribute("width", String(box.offsetWidth));
      svg.setAttribute("height", String(box.offsetHeight));
      svg.style.strokeWidth = `${Math.max(1.5, STROKE * size)}px`;
      svg.querySelector("[data-arrow=line]")?.setAttribute("d", line);
      svg.querySelector("[data-arrow=head]")?.setAttribute("d", head);
    };

    place();
    // Again when the name's size changes, the note's font arrives, or an eased
    // style switch settles the name where it ends up.
    const observer = new ResizeObserver(place);
    observer.observe(title);
    observer.observe(noteEl);
    void document.fonts.ready.then(place);
    box.addEventListener("transitionend", place);
    box.addEventListener("transitioncancel", place);
    return () => {
      live = false;
      observer.disconnect();
      box.removeEventListener("transitionend", place);
      box.removeEventListener("transitioncancel", place);
    };
  }, []);

  return (
    <div
      ref={root}
      data-testid="brand-title"
      data-placed
      // Room below for the handwriting's descenders, which spill out of its line box.
      class={classNames("relative inline-block pb-[0.25em] text-left text-display", extraClass)}
      inert={inert}
    >
      {/* As wide as the name only, so placing the note can't resize what's observed. */}
      <h1 class="flex w-max items-center gap-[0.3em] font-normal tracking-tight">
        <Logo />
        <span>
          <Brand />
        </span>
      </h1>
      <p
        ref={note}
        data-placed
        class="w-max origin-top-left -rotate-6 font-hand text-[0.56em] leading-none font-semibold text-muted"
      >
        {s.app.tagline.map((line) => (
          <span key={line} class="block">
            {line}
          </span>
        ))}
      </p>
      <svg
        ref={arrow}
        data-placed
        class="pointer-events-none absolute top-0 left-0 overflow-visible text-muted"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path data-arrow="line" />
        <path data-arrow="head" />
      </svg>
    </div>
  );
}
