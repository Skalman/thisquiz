import type { AnchorAriaRoles, AnchorHTMLAttributes } from "preact";
import { classNames } from "../../lib/classNames.ts";

/**
 * An anchor's attributes for a link that always goes somewhere: an `href`, and
 * only the roles Preact's `<a>` allows alongside one.
 */
export type LinkAttributes = Omit<AnchorHTMLAttributes, "class" | "className" | "href" | "role"> &
  Extract<AnchorAriaRoles, { href: unknown }>;

/** A text link in running prose: the accent color, underlined on hover. */
export function Link({ class: extraClass, ...rest }: LinkAttributes & { class?: string }) {
  return <a class={classNames("text-accent hover:underline", extraClass)} {...rest} />;
}
