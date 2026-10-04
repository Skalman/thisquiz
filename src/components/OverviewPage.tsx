import { Fragment, type ComponentChildren } from "preact";
import { useId, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { AboutDialog } from "./AboutDialog.tsx";
import { DiamondGoal, PathStep, Rewards, useExpandedStep } from "./AdventureStep.tsx";
import { Brand } from "./Brand.tsx";
import { useBackupFlow, BackupDialogs } from "./BackupFlow.tsx";
import { DebugDialog } from "./DebugDialog.tsx";
import { DesignContext } from "./DesignContext.tsx";
import { LevelRail } from "./LevelRail.tsx";
import { IconChevronDown, IconFlame, IconSettings } from "./Icons.tsx";
import { Logo } from "./Logo.tsx";
import { SettingsDialog } from "./SettingsDialog.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
import { isInstalled, useInstall } from "./useInstall.ts";
import { ButtonLink } from "./ui/Button.tsx";
import { Link } from "./ui/Link.tsx";
import { t } from "../i18n/index.ts";
import { classNames, tw } from "../lib/classNames.ts";
import { debugEnabled } from "../lib/debug.ts";
import type { Design } from "../lib/design.ts";
import { useForceUpdate, useRevalidated } from "../lib/hooks.ts";
import { currentStreak, solvedToday } from "../lib/streak.ts";
import { useToday } from "../lib/today.ts";
import {
  ADVENTURE_PATH,
  STEPS_PER_WORLD,
  adventureProgress,
  firstStepOf,
} from "../puzzles/adventure.ts";
import { ARCHIVE_PATH, DAILY_PATH, LEVELS, dayNumber } from "../puzzles/daily.ts";
import { dayStates, isSolved } from "../puzzles/progress.ts";
import { rememberTutorialOpener } from "../puzzles/tutorial.ts";

/** A window's frame, in the overview's play look. */
const WINDOW = tw`rounded-xl border-2 shadow-lip [--lip:var(--border)]`;

/** A window is pressable as a whole: it tints on hover and dips like a button, unless a press lands on its own controls. */
const WINDOW_PRESS = tw`cursor-pointer hover:bg-hover active:not-has-[a:active,button:active]:translate-y-0.5 active:not-has-[a:active,button:active]:shadow-none motion-safe:transition-[translate,box-shadow,background-color] motion-safe:duration-100`;

/**
 * One section of the app, seen from the overview: what's there, and the way in.
 * A press anywhere on it goes to `href`, the same place as its Play link, which
 * stays the way in for the keyboard and screen readers. A press on a link or
 * button of its own, one something inside already handled, a modified click or
 * the end of a text selection stays put.
 */
function SectionWindow({
  title,
  testId,
  href,
  contentDesign = "play",
  links,
  children,
}: {
  title: string;
  testId: string;
  href: string;
  /** The section's own look for what's inside; the frame keeps the overview's. */
  contentDesign?: Design;
  /** More ways in, after Play. */
  links?: ComponentChildren;
  children: ComponentChildren;
}) {
  const s = t();
  const { route } = useLocation();
  const titleId = useId();
  return (
    <section
      class={classNames("flex flex-col gap-3 bg-surface p-4", WINDOW, WINDOW_PRESS)}
      aria-labelledby={titleId}
      data-testid={testId}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        if (e.target instanceof Element && e.target.closest("a, button")) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (window.getSelection()?.isCollapsed === false) return;
        route(href);
      }}
    >
      <h2 id={titleId} class="text-dialog font-bold">
        {title}
      </h2>
      <DesignContext.Provider value={contentDesign}>
        {/* Laid out as the window's own children. */}
        <div class="contents" data-design={contentDesign}>
          {children}
          <div class="mt-auto flex flex-wrap items-center gap-3">
            <ButtonLink variant="primary" href={href} data-testid={`${testId}-play`}>
              {s.overview.play} &rarr;
            </ButtonLink>
            {links}
          </div>
        </div>
      </DesignContext.Provider>
    </section>
  );
}

/** Today's six levels, and the way in. */
function DailyWindow() {
  const s = t();
  const today = useToday();
  const states = dayStates(today);
  const solved = states.filter(isSolved).length;
  return (
    <SectionWindow
      title={s.overview.daily}
      testId="overview-daily"
      href={DAILY_PATH}
      contentDesign="zen"
      links={
        <Link href={ARCHIVE_PATH} class="text-body">
          {s.daily.archive}
        </Link>
      }
    >
      <p class="text-body">{s.overview.dailyPitch}</p>
      <p class="text-body text-muted">{s.daily.dayLabel(dayNumber(today), today)}</p>
      <LevelRail
        states={states}
        class="w-full [--level-solved:7px] [--level-started:3px] [--level-strength:100%]"
      />
      <p class="text-body">{s.overview.levelsSolved(solved, LEVELS.length)}</p>
    </SectionWindow>
  );
}

/** How many steps the window shows on either side of the reached one. */
const STEPS_EACH_SIDE = 2;

/** Where the path stands: the rewards, the steps around the reached one, and the way in. */
function AdventureWindow() {
  const s = t();
  const progress = adventureProgress();
  const [expandedStep, toggleStep] = useExpandedStep();
  // Within the world the step is in, ending at the diamond still to earn.
  const worldStart = firstStepOf(progress.reachedWorld);
  const worldEnd = worldStart + STEPS_PER_WORLD - 1;
  const first = Math.max(
    worldStart,
    Math.min(progress.reached - STEPS_EACH_SIDE, worldEnd - 2 * STEPS_EACH_SIDE),
  );
  const strip = Array.from({ length: 2 * STEPS_EACH_SIDE + 1 }, (_, i) =>
    progress.stepAt(first + i),
  );
  return (
    <SectionWindow title={s.adventure.title} testId="overview-adventure" href={ADVENTURE_PATH}>
      <Rewards stars={progress.stars} diamonds={progress.diamonds} />
      <ol class="flex items-center gap-2 py-1">
        {strip.map((stepProgress) => (
          <Fragment key={stepProgress.step}>
            <PathStep
              progress={stepProgress}
              ringed={stepProgress.step === progress.reached}
              circle="small"
              expanded={expandedStep === stepProgress.step}
              onToggle={() => toggleStep(stepProgress.step)}
            />
            {/* The world's end, its diamond the one to aim for. */}
            {stepProgress.step === worldEnd && (
              <li>
                <DiamondGoal world={progress.reachedWorld} earned={false} small />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </SectionWindow>
  );
}

/** The streak, while it runs: the days so far, and a reminder until today has a solve. */
function Streak() {
  const s = t();
  const today = useToday();
  const days = currentStreak(today);
  if (days === 0) return null;
  return (
    <p
      class="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-body"
      data-testid="streak"
    >
      <span class="inline-flex items-center gap-1 font-semibold">
        <IconFlame class="text-pending" />
        {s.overview.streak(days)}
      </span>
      {!solvedToday(today) && <span class="text-muted">{s.overview.streakKeep}</span>}
    </p>
  );
}

/**
 * An item in the overview's list: quieter than a button on a phone, so the windows'
 * Play leads. From `md` up, a compact candy pill in play's quiet look, as wide as
 * its label. The line height is set, so a link and a button come out alike.
 */
const LIST_ITEM = tw`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-body leading-6 font-semibold text-default hover:bg-hover md:w-auto md:rounded-pill md:border-2 md:bg-surface md:bg-(image:--gloss) md:py-2 md:font-bold md:shadow-lip md:[--lip:var(--border)] md:hover:bg-surface md:active:translate-y-0.5 md:active:shadow-none md:motion-safe:transition-[translate,box-shadow] md:motion-safe:duration-100`;

/**
 * The list's frame: a card of rows on a phone, a centered row of pills from `md`
 * up, where a full-width row would sit far from its own chevron.
 */
const LIST_FRAME = tw`divide-y overflow-hidden bg-surface md:flex md:flex-wrap md:items-center md:justify-center md:gap-3 md:divide-y-0 md:overflow-visible md:border-0 md:bg-transparent md:shadow-none`;

/**
 * An item's label, after its icon, and a chevron toward what it opens on a phone.
 * There every item keeps an icon's room, so the labels line up; a pill without
 * an icon drops it.
 */
function ItemLabel({ label, icon }: { label: string; icon?: ComponentChildren }) {
  return (
    <>
      <span class="flex items-center gap-2">
        {icon ?? <span class="w-[1em] md:hidden" aria-hidden="true" />}
        {label}
      </span>
      <IconChevronDown size="0.9em" class="-rotate-90 text-muted md:hidden" />
    </>
  );
}

type OverviewDialog = "install" | "settings" | "about" | "debug";

/** The front page: a window onto each section, then the app's own things. */
export function OverviewPage() {
  const s = t();
  const forceUpdate = useForceUpdate();
  const backup = useBackupFlow({ onChanged: forceUpdate });
  const install = useInstall();
  const [dialog, setDialog] = useState<OverviewDialog | null>(null);
  const close = () => setDialog(null);
  useRevalidated();
  const installLabel = isInstalled() ? s.install.shareApp : s.install.button;
  const showDebug = import.meta.env.DEV || debugEnabled();

  const item = (label: string, onClick: () => void, testId: string, icon?: ComponentChildren) => (
    <li>
      <button type="button" class={LIST_ITEM} onClick={onClick} data-testid={testId}>
        <ItemLabel label={label} icon={icon} />
      </button>
    </li>
  );
  const frame = classNames(WINDOW, LIST_FRAME);

  return (
    <div class="mx-auto max-w-200">
      <header class="mb-6 flex flex-col items-center gap-1 pt-2 text-center">
        <h1 class="flex items-center gap-3 text-display font-normal tracking-tight">
          <Logo />
          <span>
            <Brand />
            {import.meta.env.DEV && <span class="font-bold text-(--dev-badge)"> (dev)</span>}
          </span>
        </h1>
        <p class="text-body text-muted">{s.puzzleList.subtitle}</p>
        <Streak />
      </header>

      <div class="mb-8 grid gap-4 md:grid-cols-2">
        <AdventureWindow />
        {/* A window onto the daily puzzles: framed like the page, its contents in their own look. */}
        <DailyWindow />
      </div>

      {/* The two a player reaches for first, set apart from the rest. */}
      <nav class="flex flex-col gap-4 md:gap-6" aria-label={s.overview.more}>
        <ul class={frame}>
          <li>
            <a
              class={LIST_ITEM}
              href="/tutorial"
              onClick={rememberTutorialOpener}
              data-testid="overview-tutorial"
            >
              <ItemLabel label={s.tutorial.title} />
            </a>
          </li>
          {item(
            s.settings.title,
            () => setDialog("settings"),
            "overview-settings",
            <IconSettings strokeWidth={2.5} />,
          )}
        </ul>
        <ul class={frame}>
          {item(installLabel, () => setDialog("install"), "overview-install")}
          {item(s.backup.button, backup.openBackup, "overview-backup")}
          {item(s.about.title, () => setDialog("about"), "overview-about")}
          {showDebug && item(s.overview.debug, () => setDialog("debug"), "overview-debug")}
        </ul>
      </nav>

      {dialog === "install" && (
        <ShareDialog
          url={`${window.location.origin}/`}
          title={installLabel}
          onClose={close}
          installAction={install?.type === "native" ? install.fire : undefined}
          installMessage={install?.type === "instructions" ? install.message : undefined}
        />
      )}
      {dialog === "settings" && <SettingsDialog onClose={close} />}
      {dialog === "about" && <AboutDialog onClose={close} />}
      {dialog === "debug" && <DebugDialog onClose={close} />}

      <BackupDialogs backup={backup} exportFilename="refpuzzle-backup.json" />
    </div>
  );
}
