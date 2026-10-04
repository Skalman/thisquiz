// Inlined Lucide icons (https://lucide.dev, MIT license)
// Each is a minimal SVG at 24x24 viewBox, rendered at 1em.

interface Props {
  size?: string;
  class?: string;
  strokeWidth?: number;
}

const defaults = { size: "1em" };

function I({ d, size, class: cls, strokeWidth }: Props & { d: string }) {
  const s = size ?? defaults.size;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth ?? 2}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cls}
    >
      <path d={d} />
    </svg>
  );
}

function IM({ paths, size, class: cls, strokeWidth }: Props & { paths: string[] }) {
  const s = size ?? defaults.size;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth ?? 2}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cls}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// Undo
export function IconUndo(p: Props) {
  return <IM {...p} paths={["M3 7v6h6", "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"]} />;
}

// Redo
export function IconRedo(p: Props) {
  return <IM {...p} paths={["M21 7v6h-6", "M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"]} />;
}

// Bookmark/Pin (checkpoint)
export function IconPin(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M12 17v5",
        "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
      ]}
    />
  );
}

// Lightbulb (hint)
export function IconHint(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
        "M9 18h6",
        "M10 22h4",
      ]}
    />
  );
}

// Check (correct mark)
export function IconCheck(p: Props) {
  return <I {...p} d="M20 6 9 17l-5-5" />;
}

export function IconWarning(p: Props) {
  return <I {...p} d="M12 2 1 21h22L12 2zm0 7v6m0 2v2" />;
}

// Bare exclamation (a refused checkpoint). No enclosing circle — the badge or
// pill it sits in is the enclosure. Deliberately not X-based either: the bare X
// is the elimination mark in the same history strip.
export function IconAlert(p: Props) {
  return <IM {...p} paths={["M12 7v6", "M12 19h.01"]} />;
}

// X (incorrect mark)
export function IconX(p: Props) {
  return <IM {...p} paths={["M18 6 6 18", "m6 6 12 12"]} />;
}

// Play (start)
export function IconPlay({ size, class: cls }: Props) {
  const s = size ?? defaults.size;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      class={cls}
    >
      <path d="M6 3l14 9-14 9V3z" />
    </svg>
  );
}
export function IconPause({ size, class: cls }: Props) {
  const s = size ?? defaults.size;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      class={cls}
    >
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

// Chevron down (dropdown)
export function IconChevronDown(p: Props) {
  return <I {...p} d="m6 9 6 6 6-6" />;
}

// Refresh (replay)
export function IconReplay(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
        "M21 3v5h-5",
        "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
        "M3 21v-5h5",
      ]}
    />
  );
}

// Printer
export function IconPrint(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",
        "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",
        "M6 14h12v8H6z",
      ]}
    />
  );
}

// Calendar (history)
export function IconCalendar(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M8 2v4",
        "M16 2v4",
        "M3 10h18",
        "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
      ]}
    />
  );
}

// Help circle
export function IconHelp(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
        "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
        "M12 17h.01",
      ]}
    />
  );
}

// Clock (elapsed time)
export function IconClock(p: Props) {
  return <IM {...p} paths={["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6l4 2"]} />;
}

// Share
export function IconShare(p: Props) {
  return (
    <IM {...p} paths={["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "m16 6-4-4-4 4", "M12 2v13"]} />
  );
}

export function IconScan(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M3 7V5a2 2 0 0 1 2-2h2",
        "M17 3h2a2 2 0 0 1 2 2v2",
        "M21 17v2a2 2 0 0 1-2 2h-2",
        "M7 21H5a2 2 0 0 1-2-2v-2",
      ]}
    />
  );
}

export function IconDot({ size, class: cls }: Props) {
  const s = size ?? defaults.size;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 24 24" class={cls}>
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}

// Star (an Adventure puzzle solved without hints), filled.
export function IconStar({ size, class: cls }: Props) {
  const s = size ?? defaults.size;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 24 24" class={cls}>
      <path
        fill="currentColor"
        d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
      />
    </svg>
  );
}

// Gem (a diamond: every hundred Adventure steps)
export function IconDiamond(p: Props) {
  return <IM {...p} paths={["M6 3h12l4 6-10 13L2 9Z", "M11 3 8 9l4 13 4-13-3-6", "M2 9h20"]} />;
}

// Flame (the streak)
export function IconFlame(p: Props) {
  return (
    <I
      {...p}
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
    />
  );
}

// House (the overview)
export function IconHome(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
        "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      ]}
    />
  );
}

// Arrow left (back)
export function IconArrowLeft(p: Props) {
  return <IM {...p} paths={["m12 19-7-7 7-7", "M19 12H5"]} />;
}

// Gear (settings)
export function IconSettings(p: Props) {
  return (
    <IM
      {...p}
      paths={[
        "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
        "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
      ]}
    />
  );
}
