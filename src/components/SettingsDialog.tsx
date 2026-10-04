import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { Button } from "./ui/Button.tsx";
import { Dialog } from "./ui/Dialog.tsx";
import { t } from "../i18n/index.ts";
import { switchWithTransition } from "../lib/switchTransition.ts";
import { updateThemeColor } from "../lib/theme.ts";

const THEME_MODES = ["auto", "light", "dark"] as const;
type ThemeMode = (typeof THEME_MODES)[number];

const THEME_KEY = "refpuzzle:theme";

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    return attr === "light" || attr === "dark" ? attr : "auto";
  });
  function select(next: ThemeMode) {
    const html = document.documentElement;
    switchWithTransition(() => {
      try {
        if (next === "auto") {
          html.removeAttribute("data-theme");
          localStorage.removeItem(THEME_KEY);
        } else {
          html.setAttribute("data-theme", next);
          localStorage.setItem(THEME_KEY, next);
        }
      } catch {}
      updateThemeColor();
    });
    setMode(next);
  }
  return { mode, select };
}

/** One setting: a label over a row of choices, one of them on. */
function Choices<Value extends string>({
  label,
  options,
  value,
  names,
  onSelect,
}: {
  label: string;
  options: readonly Value[];
  value: Value;
  names: Record<Value, ComponentChildren>;
  onSelect: (value: Value) => void;
}) {
  return (
    <div class="mb-5">
      <p class="mb-2 text-section font-semibold">{label}</p>
      <div class="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <Button
            key={option}
            variant={option === value ? "primary" : "outline-muted"}
            aria-pressed={option === value}
            onClick={() => onSelect(option)}
          >
            {names[option]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The app's settings: the theme. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = t();
  const theme = useTheme();
  return (
    <Dialog title={s.settings.title} onClose={onClose}>
      <Choices
        label={s.settings.theme}
        options={THEME_MODES}
        value={theme.mode}
        names={s.settings.themeModes}
        onSelect={theme.select}
      />
    </Dialog>
  );
}
