import type { ButtonHTMLAttributes, HTMLAttributes } from "preact";
import type { LinkAttributes } from "./Link.tsx";
import { forwardRef } from "preact/compat";
import { classNames, tw } from "../../lib/classNames.ts";
import type { Design } from "../../lib/design.ts";
import { useDesign } from "../DesignContext.tsx";

/** The surface's edge, per design; play's padding clears the rows' corners. */
const POPOVER: Record<Design, string> = {
  zen: tw`rounded-md border border-strong py-1`,
  play: tw`rounded-xl border-2 border-strong p-1.5`,
};

/** A dropdown menu's surface, hanging under the right edge of what opens it. */
export const MenuPopover = forwardRef<
  HTMLDivElement,
  Omit<HTMLAttributes<HTMLDivElement>, "class" | "className">
>(function MenuPopover(props, ref) {
  const design = useDesign();
  return (
    <div
      ref={ref}
      role="menu"
      class={classNames(
        "absolute top-full right-0 z-20 mt-1 flex min-w-30 flex-col bg-surface text-chrome whitespace-nowrap shadow-dropdown",
        POPOVER[design],
      )}
      {...props}
    />
  );
});

/** A row: roomier below the `md` breakpoint, where it is a touch target. */
const ITEM = tw`w-full cursor-pointer items-center gap-[0.4em] px-3 py-2.5 text-left text-default hover:bg-hover md:py-1.5`;

/** A row's corners, per design. */
const ITEM_SHAPE: Record<Design, string | undefined> = {
  zen: undefined,
  play: tw`rounded-lg`,
};

interface ItemOptions {
  /** Shown only from the `md` breakpoint up. */
  desktopOnly?: boolean;
  /** Shown only below the `md` breakpoint. */
  mobileOnly?: boolean;
  class?: string;
}

function itemClass({
  desktopOnly,
  mobileOnly,
  design,
  class: extraClass,
}: ItemOptions & { design: Design }): string {
  const display = desktopOnly ? "hidden md:flex" : mobileOnly ? "flex md:hidden" : "flex";
  return classNames(ITEM, ITEM_SHAPE[design], display, extraClass);
}

/**
 * A row of a menu; `data-menu-item` enrolls it in the menu's arrow keys. The
 * role can be overridden, e.g. for a radio choice.
 */
export const MenuItem = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes, "class" | "className"> & ItemOptions
>(function MenuItem({ desktopOnly, mobileOnly, class: extraClass, ...rest }, ref) {
  const design = useDesign();
  return (
    <button
      ref={ref}
      role="menuitem"
      data-menu-item
      class={itemClass({ desktopOnly, mobileOnly, design, class: extraClass })}
      {...rest}
    />
  );
});

/** A menu row that navigates. */
export function MenuLink({
  desktopOnly,
  mobileOnly,
  class: extraClass,
  ...rest
}: LinkAttributes & ItemOptions) {
  const design = useDesign();
  return (
    <a
      role="menuitem"
      data-menu-item
      class={itemClass({ desktopOnly, mobileOnly, design, class: extraClass })}
      {...rest}
    />
  );
}
