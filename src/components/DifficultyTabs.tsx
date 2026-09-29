import { useEffect, useRef } from "preact/hooks";
import { IconCheck, IconDot, IconWarning } from "./Icons.tsx";
import { LEVELS, puzzleId } from "../puzzles/daily.ts";
import { hasState } from "../lib/store.ts";
import { levelProgress, type LevelProgress } from "../puzzles/progress.ts";
import { arrowNavHandler } from "../lib/keyboard.ts";
import { LEVEL_COLOR } from "./ui/styles.ts";
import { t } from "../i18n/index.ts";
import { classNames, tw } from "../lib/classNames.ts";
import type { Design } from "../lib/design.ts";
import { useDesign } from "./DesignContext.tsx";

/** The slot the status icon sits in, ahead of the level's name. */
const TAB_ICON = tw`mr-[0.25em] inline-flex align-middle`;

/** The row of tabs, scrolling sideways without a scrollbar. */
const TABLIST = tw`mb-2 flex overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden`;

/** The row's look: zen's trough, play's bare row. */
const TABLIST_LOOK: Record<Design, string> = {
  zen: tw`rounded-lg bg-hover p-0.5`,
  // Bottom padding keeps the lips unclipped.
  play: tw`gap-1.5 px-0.5 pt-1 pb-2`,
};

/** A tab: its share of the row, and its one-line label. */
const TAB = tw`group flex-[1_0_auto] cursor-pointer py-1.5 text-center text-chrome whitespace-nowrap md:flex-1`;

/** A tab's look: zen underlined, play a pill, solid when selected. */
const TAB_LOOK: Record<Design, string> = {
  zen: tw`rounded-t-md border-b-2 border-b-[color-mix(in_srgb,var(--level-color)_75%,transparent)] px-2.5 text-muted transition-all duration-150 first:rounded-bl-md last:rounded-br-md hover:bg-hover aria-selected:border-b-(--level-color) aria-selected:bg-surface aria-selected:font-semibold aria-selected:text-(--level-color) aria-selected:shadow-raised`,
  play: tw`rounded-pill border-2 border-(--level-color) bg-[color-mix(in_srgb,var(--level-color)_18%,var(--bg-surface))] bg-(image:--gloss) px-3 font-semibold text-default shadow-lip [--lip:var(--level-color)] motion-safe:transition-[translate,box-shadow] motion-safe:duration-100 active:translate-y-0.5 active:shadow-none aria-selected:bg-(--level-color) aria-selected:font-extrabold aria-selected:text-[color-mix(in_srgb,var(--level-color),black_72%)] aria-selected:[--lip:color-mix(in_srgb,var(--level-color),black_30%)]`,
};

/**
 * The icon ahead of a level's name: needing a recheck, solved, or begun. On
 * play's selected tab, in the tab's text color.
 */
function TabStatus({ progress, design }: { progress: LevelProgress; design: Design }) {
  const icon = classNames(TAB_ICON, design === "play" && "group-aria-selected:text-current");
  switch (progress) {
    case "stale":
      return (
        <span class={`${icon} text-invalid`}>
          <IconWarning size="0.9em" />{" "}
        </span>
      );
    case "solved":
      return (
        <span class={`${icon} text-valid`}>
          <IconCheck size="0.9em" class="stroke-3 group-aria-selected:stroke-4" />{" "}
        </span>
      );
    case "started":
      return (
        <span class={`${icon} text-accent group-aria-selected:scale-140`}>
          <IconDot size="0.9em" />{" "}
        </span>
      );
    default:
      return null;
  }
}

/** One tab per level of the day, each showing how far along it is. */
export function DifficultyTabs({
  dateStr,
  activeLevel,
  onSelect,
}: {
  dateStr: string;
  activeLevel: number;
  onSelect: (level: number) => void;
}) {
  const s = t();
  const design = useDesign();
  const tabsRef = useRef<HTMLDivElement>(null);

  const progress = LEVELS.map((level) => levelProgress(hasState(puzzleId(dateStr, level))));
  const activeProgress = progress[activeLevel - 1];

  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const tab = container.children[activeLevel - 1];
    if (!(tab instanceof HTMLElement)) return;
    // Center the tab horizontally without affecting vertical scroll (scrollIntoView would
    // also scroll the page vertically when the tab isn't fully in view).
    const tabRect = tab.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const delta = tabRect.left + tabRect.width / 2 - (containerRect.left + containerRect.width / 2);
    container.scrollTo({ left: container.scrollLeft + delta, behavior: "smooth" });
  }, [activeLevel, activeProgress]);

  return (
    <div
      ref={tabsRef}
      class={classNames(TABLIST, TABLIST_LOOK[design])}
      role="tablist"
      onKeyDown={arrowNavHandler('[role="tab"]')}
    >
      {LEVELS.map((level, i) => (
        <button
          key={level}
          role="tab"
          aria-selected={activeLevel === level}
          tabIndex={activeLevel === level ? 0 : -1}
          data-progress={progress[i] ?? undefined}
          class={classNames(TAB, TAB_LOOK[design], LEVEL_COLOR[i])}
          onClick={() => onSelect(level)}
        >
          <TabStatus progress={progress[i]} design={design} />
          <span class="text-chrome">{s.difficulty[level]}</span>
        </button>
      ))}
    </div>
  );
}
