import { useState } from "preact/hooks";
import { Dialog } from "./ui/Dialog.tsx";
import { Button } from "./ui/Button.tsx";
import {
  reachedStepOverride,
  applyDebugChanges,
  debugEnabled,
  legacyHostPreview, // Remove support for refpuzzle.com after 2027-06-01.
  nudgeSeconds,
  setReachedStepOverride,
  setDebugEnabled,
  setLegacyHostPreview, // Remove support for refpuzzle.com after 2027-06-01.
  setNudgeSeconds,
} from "../lib/debug.ts";
// Remove support for refpuzzle.com after 2027-06-01.
import type { MovePhase } from "../lib/domain-move.ts";
import { tw } from "../lib/classNames.ts";

/** One switch per row, ruled off from the one above. */
const ROW = tw`flex items-start gap-2.5 border-t py-2.5 text-chrome`;
/** The line under a switch's name saying what it does. */
const NOTE = tw`block text-caption text-muted`;

/** Offered waits for the idle nudge, in seconds; null is the shipped one. */
const NUDGE_CHOICES: (number | null)[] = [null, 3, 10, 30];

// Remove support for refpuzzle.com after 2027-06-01.
/** Offered phases of the old site's move; null is this host as it is. */
const LEGACY_HOST_CHOICES: (MovePhase | null)[] = [null, "move", "urgent", "closed"];

/**
 * The development switches. Saving remounts the app, since their readers read
 * once on mount. Dev-only, so the strings stay here instead of in the i18n.
 */
export function DebugDialog({ onClose }: { onClose: () => void }) {
  const [debug, setDebug] = useState(debugEnabled());
  const [nudge, setNudge] = useState(nudgeSeconds());
  const [step, setStep] = useState(String(reachedStepOverride() ?? ""));
  // Remove support for refpuzzle.com after 2027-06-01.
  const [legacyHost, setLegacyHost] = useState(legacyHostPreview());

  function save() {
    setDebugEnabled(debug);
    setNudgeSeconds(nudge);
    const stepNumber = Number(step);
    setReachedStepOverride(Number.isInteger(stepNumber) && stepNumber >= 1 ? stepNumber : null);
    // Remove support for refpuzzle.com after 2027-06-01.
    // The old site's move runs at boot, so a new phase reloads.
    if (legacyHost !== legacyHostPreview()) {
      setLegacyHostPreview(legacyHost);
      window.location.reload();
      return;
    }
    applyDebugChanges();
    onClose();
  }

  return (
    <Dialog title="Debug" onClose={onClose}>
      {/* A form, so Enter in a field saves. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p class="mb-2 text-caption text-muted">For this tab only.</p>

        <label class={ROW}>
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.currentTarget.checked)}
          />
          <span>
            Debug mode
            <small class={NOTE}>Every hint step at once, and any date opens.</small>
          </span>
        </label>

        <fieldset class={ROW} aria-label="Idle nudge wait">
          <span>
            Nudge after
            <small class={NOTE}>Idle wait before the Checkpoint and Hint callouts.</small>
          </span>
          <span class="ms-auto flex flex-wrap gap-2">
            {NUDGE_CHOICES.map((choice) => (
              <label key={String(choice)} class="flex items-center gap-1 whitespace-nowrap">
                <input
                  type="radio"
                  name="debug-nudge"
                  checked={nudge === choice}
                  onChange={() => setNudge(choice)}
                />
                {choice === null ? "default" : `${choice}s`}
              </label>
            ))}
          </span>
        </fieldset>

        <label class={ROW}>
          <span>
            Adventure: reached step
            <small class={NOTE}>
              The path unlocks up to this step, as if every one before it were done. Empty plays the
              path as it is.
            </small>
          </span>
          <input
            type="number"
            min="1"
            class="ms-auto w-20 rounded-md border bg-surface px-2 py-1"
            value={step}
            onInput={(e) => setStep(e.currentTarget.value)}
            data-testid="debug-adventure-reached"
          />
        </label>

        {/* Remove support for refpuzzle.com after 2027-06-01. */}
        <fieldset class={ROW} aria-label="Old site preview">
          <span>
            refpuzzle.com
            <small class={NOTE}>
              The page as the old site shows it in this phase of the move. Leaving goes to this
              site's import, once.
            </small>
          </span>
          <span class="ms-auto flex flex-wrap gap-2">
            {LEGACY_HOST_CHOICES.map((choice) => (
              <label key={String(choice)} class="flex items-center gap-1 whitespace-nowrap">
                <input
                  type="radio"
                  name="debug-legacy-host"
                  checked={legacyHost === choice}
                  onChange={() => setLegacyHost(choice)}
                />
                {choice ?? "off"}
              </label>
            ))}
          </span>
        </fieldset>

        <div class="mt-4 flex justify-end border-t pt-3">
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
