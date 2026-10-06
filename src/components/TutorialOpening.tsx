import { useState } from "preact/hooks";
import type { OptionMark } from "../engine/types.ts";
import { OptionButton } from "./OptionButton.tsx";
import { TutorialNext, TutorialPanel } from "./TutorialPanel.tsx";
import { BrandTitle } from "./BrandTitle.tsx";
import { classNames } from "../lib/classNames.ts";
import { usePressGuard } from "./usePressGuard.ts";
import { pointerKind } from "../lib/pointer.ts";
import { t } from "../i18n/index.ts";

/** A cell's marks, in press order. */
const MARK_CYCLE: OptionMark[] = ["unmarked", "incorrect", "correct"];

/** The line for each mark after the full cycle, by press count mod 3. */
const LINE_AFTER = [3, 1, 2];

/** The tutorial's opening: one lone cell, pressed through its marks. */
export function TutorialOpening({ onNext }: { onNext: () => void }) {
  const s = t().tutorial;
  const [presses, setPresses] = useState(0);
  const takePress = usePressGuard();
  const lines = s.cellSteps(pointerKind());
  const done = presses >= lines.length - 1;
  const mark = MARK_CYCLE[presses % 3];

  return (
    <div class="flex flex-col items-center gap-4">
      {/* A welcome, fading at the first press; its space stays, so nothing shifts. */}
      <BrandTitle
        inert
        class={classNames(
          "motion-safe:transition-[opacity,visibility] motion-safe:duration-500",
          presses > 0 && "invisible opacity-0",
        )}
      />
      <TutorialPanel
        message={{ text: lines[presses === 0 ? 0 : LINE_AFTER[presses % 3]] }}
        steps={lines.map((text) => ({ text }))}
      />
      <div class="flex w-32 *:flex-1">
        <OptionButton
          index={0}
          questionIndex={0}
          label="1"
          labelKind="count"
          mark={mark}
          focused
          onClick={() => {
            // After the full cycle, every press counts.
            if (!done && !takePress()) return;
            setPresses((n) => n + 1);
          }}
        />
      </div>
      <TutorialNext shown={done} class="mt-4" onClick={onNext} />
    </div>
  );
}
