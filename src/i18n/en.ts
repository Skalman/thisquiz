import type { PointerKind } from "../lib/pointer.ts";
import type { StepCopy, TutorialSolvedKey, TutorialStepKey } from "../puzzles/tutorial.ts";

function plural(n: number, one: string, other: string): string {
  return n === 1 ? `${n} ${one}` : `${n} ${other}`;
}

/** An Adventure puzzle's size, spelled out. */
function sizeName(questions: number, options: number): string {
  return `${plural(questions, "question", "questions")}, ${plural(options, "option", "options")}`;
}

/** The icon a How-to-play step is illustrated with. */
export type HelpIcon = "incorrect" | "correct" | "checkpoint";

/** Marking verb for the primary pointer: touch → "Tap", mouse → "Click". */
function tapVerb(p: PointerKind): string {
  return p === "coarse" ? "Tap" : "Click";
}

/** A natural question list: "#1", "#1 and #3", "#1, #2 and #3". */
function qList(qis: number[]): string {
  const labels = qis.map((qi) => `#${qi + 1}`);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export default {
  app: {
    title: "This Quiz",
    loading: "Loading...",
    noPuzzle: "No puzzle available for this date.",
  },
  puzzleList: {
    subtitle: "Self-referential logic puzzles",
    questions: "questions",
  },
  difficulty: {
    1: "Relaxed",
    2: "Curious",
    3: "Thoughtful",
    4: "Focused",
    5: "Immersed",
    6: "Deep",
  } as Record<number, string>,
  puzzle: {
    undo: "Undo",
    redo: "Redo",
    hint: "Hint",
    noNextStep: "No obvious next step. Try making an assumption.",
    checkpoint: "Checkpoint",
    // Checkpoint verdicts. The button doesn't warn that the press can be refused,
    // so the two refusals carry the gentle framing instead.
    checkpointSet: "Checkpoint set — everything so far holds up.",
    checkpointWrong: "Not yet — something's off further back.",
    // `n` counts marks, not steps: the pins and retractions in the range don't
    // establish anything.
    verifiedMarks: (n: number) => `Verified moves · ${n}`,
    verifiedTitle: (answered: number, questions: number) =>
      `Verified: ${answered} of ${questions} questions answered`,
    checkpointFailsTitle: (n: number) => plural(n, "refused checkpoint", "refused checkpoints"),
    solved: "Puzzle solved!",
    // The dialog's title when every question went clean.
    solvedPerfect: "✨ Puzzle solved!",
    nextPuzzle: "Next puzzle",
    // Reopens the solved dialog from the banner, without the celebration.
    summary: "Summary",
    // The result card's caption under the time.
    solvedIn: "solved in",
    // The solved dialog's lines, one per measure: a label, and the numbers
    // behind it. The time bands, fastest first, and the history pair are
    // neutral — a slow solve reads as a style, not a rank; hints and oopsies
    // are where the teasing is allowed.
    solvedLines: {
      solvedIn: {
        hot: (time: string) => ({ label: "Hot!", detail: `solved in ${time}` }),
        speedy: (time: string) => ({ label: "Speedy", detail: `solved in ${time}` }),
        smooth: (time: string) => ({ label: "Smooth", detail: `solved in ${time}` }),
        deliberate: (time: string) => ({ label: "Deliberate", detail: `solved in ${time}` }),
      },
      pathfinder: { label: "Pathfinder", detail: "no hints needed" },
      peeker: (n: number) => ({ label: "Peeker", detail: plural(n, "hint", "hints") }),
      freeSpirit: { label: "Free spirit", detail: "no checkpoints" },
      doubleChecker: (n: number) => ({
        label: "Double-checker",
        detail: plural(n, "checkpoint", "checkpoints"),
      }),
      oopsie: (refused: number, pressed: number) => ({
        label: "Oopsie",
        detail: `${refused} of ${plural(pressed, "checkpoint", "checkpoints")} refused`,
      }),
      straightSolver: { label: "Straight solver", detail: "nothing undone" },
      timeTraveler: (n: number) => ({
        label: "Time traveler",
        detail: `reversed course ${n === 1 ? "once" : `${n} times`}`,
      }),
    },
    // Idle nudges (L2+): a callout on the button it names.
    nudge: {
      checkpoint: "Use the checkpoint to check your work!",
      hint: "Want a hint?",
    },
    start: "Start",
    // The play design's question heading, in place of the bare number.
    questionLabel: (n: number) => `Question #${n}:`,
    solvedBadge: "Solved",
    playAgain: "Play again",
    // The armed label: a second press is what actually discards the solve.
    playAgainConfirm: "Clear board?",
    more: "More",
  },
  // The escalating key-diff notes, shared by the Hint button and a refused
  // checkpoint. `qi` is 0-based; `letter` is the answer the note names.
  mistake: {
    vague: "You made an error.",
    question: (qi: number) => `You made an error in #${qi + 1}.`,
    answer: (qi: number, letter: string) => `#${qi + 1} is not ${letter} — try a different answer.`,
    elim: (qi: number, letter: string) => `You incorrectly eliminated #${qi + 1} option ${letter}.`,
  },
  // Hint panel: the navigation pointer the frontend owns — deduce-rule, question,
  // and option prose all come from Rust. `qis` are 0-based question indices.
  hint: {
    tryLooking: (qis: number[]) => `Try looking at ${qList(qis)}.`,
  },
  daily: {
    dayLabel: (num: number, date: string) => `Day #${num} — ${date}`,
    today: "Today",
    archive: "Archive",
    printAll: "Print all puzzles",
    // One archive day, spoken: the level rail carries the same state visually.
    // A stale day's rail reports only the levels needing a recheck, so its
    // label does too. The trailing clause names where the day opens, which the
    // tile shows nowhere else.
    archiveDay: (date: string, solved: number, levels: number, opens: string) =>
      `${date} — ${solved} of ${levels} solved — opens ${opens}`,
    archiveDayStale: (date: string, stale: number, opens: string) =>
      `${date} — ${plural(stale, "level needs", "levels need")} rechecking — opens ${opens}`,
  },
  backup: {
    button: "Sync and backup",
    downloadBackup: "Download backup",
    uploadBackup: "Upload backup",
    uploadPreview: "Upload preview",
    confirmUpload: "Confirm upload",
    cancel: "Cancel",
    ok: "OK",
    uploadFailed: (msg: string) => `Upload failed: ${msg}`,
    puzzlesInBackup: (n: number) => plural(n, "puzzle in file", "puzzles in file"),
    actions: {
      new: "New puzzle — will be added",
      "replace-completed": "Completed in backup — will update yours",
      "replace-longer": "More progress in backup — will update yours",
      "keep-completed": "Already completed — no change",
      "keep-longer": "You're further ahead — no change",
      identical: "Identical — no change",
    } as Record<string, string>,
    // What else the file brings, besides puzzles.
    newStars: (n: number) => `${plural(n, "new star", "new stars")} — will be added`,
    streak: (days: number) => `${days}-day streak — will update yours`,
    adventureReached: (step: number) => `Reached step ${step} in the Adventure — will update yours`,
  },
  aria: {
    close: "Close",
    dismiss: "Dismiss",
    more: "More",
    logo: "This Quiz logo",
  },
  // The front page: a window onto each section, then the app's own things.
  overview: {
    daily: "Daily puzzles",
    // Under the daily window's title: why to come, past the Adventure.
    dailyPitch: "Bigger puzzles. More thinking.",
    levelsSolved: (solved: number, levels: number) => `${solved} of ${levels} solved today`,
    // The streak: days in a row with a puzzle solved.
    streak: (days: number) => `${days}-day streak`,
    // Read out while today has no solve yet; the unlit flame shows it on screen.
    streakOpen: "Solve a puzzle today to keep it going.",
    play: "Play",
    // The label of the list under the windows.
    more: "More",
    debug: "Debug",
    // The way back to the overview, from a page without the header.
    home: "Home",
  },
  settings: {
    title: "Settings",
    theme: "Theme",
    themeModes: { auto: "Auto", light: "Light", dark: "Dark" },
  },
  about: {
    title: "About",
  },
  share: {
    share: "Share",
    copyLink: "Copy link",
    copied: "Copied!",
    // What the link opens: the app, this puzzle blank, or this puzzle with the board so far.
    opens: "What the link opens",
    modes: { app: "App", puzzle: "Puzzle", progress: "Puzzle progress" },
    copyText: "Copy text",
    // The pasteable result: headline, one square per question, then the link.
    // `time` is null for a solve that was never timed on this device.
    resultHeadline: (day: number, level: string, time: string | null) =>
      [`This Quiz Day #${day}`, level, ...(time ? [time] : [])].join(" · "),
    outcomeEmoji: { clean: "🟩", hinted: "🟨", caught: "🟥" },
    // Its own line under perfect squares, on the card and in the pasted text.
    perfectCaption: "↑ all green ✨",
  },
  install: {
    button: "Install app",
    shareApp: "Share app",
    iosSafari: 'Tap the Share button, then "Add to Home Screen"',
    androidFirefox: 'Tap the menu button (⋮), then "Add app to Home screen"',
  },
  help: {
    title: "How to play",
    goal: "Every question is about this grid's own answers — fill it so every statement comes out true.",
    // `icon` names the illustration the step carries.
    howToPlaySteps: (p: PointerKind): { text: string; icon?: HelpIcon }[] => [
      { text: `${tapVerb(p)} an option to eliminate it`, icon: "incorrect" },
      { text: `${tapVerb(p)} again to mark it your answer`, icon: "correct" },
      { text: `${tapVerb(p)} once more to clear it` },
      { text: "The bar beside each question shows the answer's validity" },
      { text: "Set a checkpoint to check and lock in your marks so far", icon: "checkpoint" },
    ],
    whatIs: "What is a self-referential puzzle?",
    descriptionParagraphs: [
      'Each question refers to the puzzle itself: how many questions have a certain answer, which answers appear where, and so on. There is exactly one combination of answers that satisfies every question; this fact may help you find the answer to a particular question. Note that "answers" means the answers you give — the puzzle is entirely self-contained.',
      "Solving one requires logic and deduction: you often can't answer a question in isolation, so you work through the puzzle iteratively — eliminating wrong options, making tentative selections, and revising as new constraints emerge.",
      "The format was created by mathematician Jim Propp, whose original Self-Referential Aptitude Test had 20 questions and only one that could be solved without reference to the others.",
    ],
  },
  sync: {
    title: "Sync devices",
    description: "Transfer your progress between two devices.",
    start: "Start sync",
    enterCode: "Have a code?",
    join: "Join",
    waiting: "Waiting for other device...",
    codePlaceholder: "123456",
    scanQr: "Scan QR code",
    expired: "Code expired or not found",
    error: "Sync failed",
  },
  // Remove support for refpuzzle.com after 2027-06-01.
  // Shown on refpuzzle.com, which closes after the move to thisquiz.app.
  move: {
    title: "Refpuzzle is now This Quiz",
    urgentTitle: "refpuzzle.com closes March 31",
    browserBody:
      "Same puzzles, new name and address: thisquiz.app. Move now, and your progress comes along.",
    urgentBrowserBody:
      "This address closes on March 31, 2027. Move to thisquiz.app now, and your progress comes along.",
    moveButton: "Move to thisquiz.app",
    installedBody: "Same puzzles, new name and address: thisquiz.app. To keep your progress:",
    urgentInstalledBody:
      "This app stops working on March 31, 2027. To keep your progress, move it to thisquiz.app:",
    installedSteps: [
      "Open thisquiz.app and add it to your home screen.",
      'In the new app, tap "Skip tutorial" if the tutorial opens.',
      'Open "Sync and backup", then "Sync devices", and tap "Start sync".',
      'Back here, tap "Sync devices", enter the code, and tap "Join".',
      "Once your progress shows in the new app, remove this one.",
    ],
    openNewSite: "Open thisquiz.app",
    importFailedTitle: "Nothing to import",
    importFailed: "This link holds no progress, or it was cut short.",
  },
  privacy: {
    title: "Privacy",
    paragraphs: [
      "Your progress and settings are stored in your browser and stay on your device.",
      "When you solve a puzzle, anonymous stats (puzzle, time, hints used, browser type) are sent to this site. There are no cookies, no user identifiers, and no third-party trackers.",
      "The web server keeps standard access logs, including IP addresses, for about 30 days.",
    ],
  },
  contact: {
    title: "Hello!",
    // Followed by the contact address.
    body: "Found a bug or have other feedback? Feel free to say hello!",
    // The About dialog's last line.
    signature: "Made with ♥ by Dan",
  },
  // The guided tutorial's hand-written copy; board text comes from Rust.
  tutorial: {
    title: "Tutorial",
    skip: "Skip tutorial",
    // Under the first level's controls.
    takeIt: "Take the tutorial",
    // The lone cell's line before each press, then once it's back to blank.
    cellSteps: (p: PointerKind) => [
      `This is an option. ${tapVerb(p)} it.`,
      `Eliminated. That's how you rule out an option. ${tapVerb(p)} it again.`,
      `Your answer. That's how you choose one. ${tapVerb(p)} it once more.`,
      "Cleared, back where it started.",
    ],
    // A `lead` renders on its own line above `text`.
    steps: (p: PointerKind): Record<TutorialStepKey, StepCopy> => ({
      meetQuestion: {
        lead: "Here's a question. Read it!",
        text: "Questions here always ask about the puzzle's own answers.",
      },
      validityBar: {
        lead: "This is the validity bar. Can this question still work out with your marks?",
        text: `With A eliminated, #1 has no option left, so it's red. The bar only reflects your marks right now. ${tapVerb(p)} A again to fix it.`,
      },
      askSelf: { text: "Your turn!" },
      tryThree: { text: "Three options this time. Can you figure it out?" },
      tryTwo: { text: "Now two questions! They can ask about each other." },
    }),
    // Above a solved puzzle; `done` closes the tutorial.
    solved: {
      first: { text: "Good job, you solved your first puzzle!" },
      self: { text: "Well done, that's two!" },
      three: { text: "Three down!" },
      done: {
        lead: "That's the whole game: choose answers that make every question true.",
        text: "Now pick how to play: the Adventure's path of small puzzles, or the daily puzzles.",
      },
    } satisfies Record<TutorialSolvedKey, StepCopy>,
    next: "Next",
    // The two ways onward, from the last puzzle.
    playAdventure: "Play the Adventure",
    playDaily: "Play today's puzzles",
  },
  // The Adventure: a path of steps, each offering one small puzzle per size.
  adventure: {
    title: "Adventure",
    // Each hundred steps of the path, on a map of its own.
    world: (world: number) => `World ${world}`,
    // The list of worlds' title, opened from a map's title.
    worldsTitle: "Worlds",
    starsLabel: (stars: number) => plural(stars, "star", "stars"),
    diamondsLabel: (diamonds: number) => plural(diamonds, "diamond", "diamonds"),
    // A solved puzzle's way back to the map.
    continue: "Continue",
    // Beside a solved puzzle's bar: the star it earned, or how to earn it.
    starEarned: "Star earned",
    // Solved with hints, with the star from an earlier solve.
    alreadyStarred: "Already starred",
    starMissed: "Solved with hints. Play it again without them for the star.",
    // What to do with a solved puzzle, asked when it is pressed on the map.
    replay: {
      // The star's line; without one, the dialog says `starMissed`, as the solved board does.
      starred: "Solved without hints",
      showSolution: "Show your solution",
      cancel: "Cancel",
    },
    // A puzzle's name, by its step.
    puzzleTitle: (step: number) => `Step ${step}`,
    step: {
      locked: (step: number) => `Step ${step}, locked`,
      next: (step: number) => `Step ${step}, up next`,
      done: (step: number, stars: number) =>
        stars > 0 ? `Step ${step}, done, ${plural(stars, "star", "stars")}` : `Step ${step}, done`,
    },
    // One of a step's puzzles, named by its size.
    size: {
      unsolved: sizeName,
      solved: (questions: number, options: number) => `${sizeName(questions, options)}, solved`,
      starred: (questions: number, options: number) =>
        `${sizeName(questions, options)}, solved without hints`,
    },
    // At a world's end.
    diamond: (world: number, earned: boolean) =>
      earned ? `World ${world}'s diamond, earned` : `World ${world}'s diamond, not yet earned`,
    // Under the first diamond: on to the next world, or to the daily puzzles.
    firstDiamond: {
      title: "Your first diamond!",
      text: "Continue the Adventure, or try the daily puzzles — bigger, for deeper thinking.",
      daily: "Play today's puzzles",
    },
    loadFailed: "The Adventure couldn't load.",
    noWorld: "No such world.",
    notFound: "No such puzzle in the Adventure.",
    backToMap: "Back to the map",
  },
  notFound: {
    noPuzzle: "No puzzle",
    backToToday: "Back to today",
    title: "404",
    pageNotFound: "Page not found",
    backToPuzzles: "Back to puzzles",
  },
  keyboard: {
    title: "Keyboard shortcuts",
    navigation: "Navigation",
    actions: "Actions",
    general: "General",
    jumpToQuestion: "Jump to question",
    prevQuestion: "Previous question",
    nextQuestion: "Next question",
    moveOptions: "Move between options",
    selectOption: "Select option A–E",
    toggleOption: "Toggle option",
    prevNextDifficulty: "Previous/next difficulty",
    undo: "Undo",
    redo: "Redo",
    hint: "Hint",
    checkpoint: "Checkpoint",
    closeCancel: "Close/cancel",
    toggleHelp: "Toggle this help",
    navigateSections: "Navigate between sections",
  },
} as const;
