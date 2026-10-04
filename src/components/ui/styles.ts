import { tw } from "../../lib/classNames.ts";

/** Each level's color as `--level-color`, in tab order: the tabs and the level rail read it. */
export const LEVEL_COLOR = [
  tw`[--level-color:var(--level-color-1)]`,
  tw`[--level-color:var(--level-color-2)]`,
  tw`[--level-color:var(--level-color-3)]`,
  tw`[--level-color:var(--level-color-4)]`,
  tw`[--level-color:var(--level-color-5)]`,
  tw`[--level-color:var(--level-color-6)]`,
];
