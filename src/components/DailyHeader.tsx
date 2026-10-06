import { useState, useRef, useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import { IconCalendar } from "./Icons.tsx";
import { Brand } from "./Brand.tsx";
import { Logo } from "./Logo.tsx";
import { MenuItem, MenuLink, MenuPopover } from "./ui/Menu.tsx";
import { Button, ButtonLink } from "./ui/Button.tsx";
import { t } from "../i18n/index.ts";
import { arrowNavHandler, menuNavHandler } from "../lib/keyboard.ts";
import { ARCHIVE_PATH } from "../puzzles/daily.ts";

if (import.meta.env.DEV) document.title = `(dev) ${document.title}`;

/** The day's own actions, behind ⋯; below `md` it also carries the toolbar's Archive. */
function MoreMenu({
  onKeyboardHelp,
  onPrint,
  onShare,
}: {
  onKeyboardHelp?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}) {
  const s = t();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Rows the viewport breakpoint hides have no offsetParent; skip those.
  function visibleMenuItems(): HTMLElement[] {
    const items: HTMLElement[] = [];
    for (const el of menuRef.current?.querySelectorAll("[data-menu-item]") ?? []) {
      if (el instanceof HTMLElement && el.offsetParent !== null) items.push(el);
    }
    return items;
  }

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    requestAnimationFrame(() => visibleMenuItems()[0]?.focus());
    return () => document.removeEventListener("click", close);
  }, [open]);

  const handleKeyDown = menuNavHandler(visibleMenuItems, () => {
    setOpen(false);
    buttonRef.current?.focus();
  });

  /** A menu row's click: the menu closes, then `action` runs. */
  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <span class="relative">
      <Button
        ref={buttonRef}
        variant="outline-muted"
        class="font-bold tracking-widest"
        data-toolbar-item
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={s.aria.more}
        aria-haspopup="true"
        aria-expanded={open}
      >
        ⋯
      </Button>
      {open && (
        <MenuPopover ref={menuRef} onKeyDown={handleKeyDown}>
          {onShare && <MenuItem onClick={pick(onShare)}>{s.share.share}</MenuItem>}
          <MenuLink mobileOnly href={ARCHIVE_PATH} onClick={() => setOpen(false)}>
            {s.daily.archive}
          </MenuLink>
          {onKeyboardHelp && (
            <MenuItem desktopOnly onClick={pick(onKeyboardHelp)}>
              {s.keyboard.title}
            </MenuItem>
          )}
          {onPrint && <MenuItem onClick={pick(onPrint)}>{s.daily.printAll}</MenuItem>}
        </MenuPopover>
      )}
    </span>
  );
}

/**
 * The daily pages' header: the brand, home to the overview, and the day's
 * tools. The menu shows only when the page has a tool for it.
 */
export function DailyHeader({
  onKeyboardHelp,
  onPrint,
  onShare,
}: {
  onKeyboardHelp?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}) {
  const s = t();
  const { path } = useLocation();
  const hasMenu = Boolean(onKeyboardHelp ?? onPrint ?? onShare);
  // The archive's own header has nowhere further to send you.
  const showArchive = path !== ARCHIVE_PATH;

  return (
    <header class="relative mb-4 flex items-center justify-between">
      <h1 class="flex items-center gap-2 text-title font-normal">
        <Logo />
        <a href="/" class="leading-tight tracking-tight" data-testid="home">
          <Brand />
        </a>
      </h1>
      {(showArchive || hasMenu) && (
        <div
          class="flex items-center gap-2"
          role="toolbar"
          onKeyDown={arrowNavHandler("[data-toolbar-item]")}
        >
          {showArchive && (
            <span class={hasMenu ? "hidden md:inline-flex" : "inline-flex"}>
              <ButtonLink
                variant="ghost"
                size="md-compact"
                href={ARCHIVE_PATH}
                tabIndex={0}
                icon={<IconCalendar />}
                data-toolbar-item
              >
                {s.daily.archive}
              </ButtonLink>
            </span>
          )}
          {hasMenu && (
            <MoreMenu onKeyboardHelp={onKeyboardHelp} onPrint={onPrint} onShare={onShare} />
          )}
        </div>
      )}
    </header>
  );
}
