// Remove support for refpuzzle.com after 2027-06-01.
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { t } from "../i18n/index.ts";
import { getClientInfo, track } from "../lib/analytics.ts";
import { NEW_ORIGIN } from "../lib/domain-move.ts";
import { currentPhase, handoffUrl, onLegacyHost } from "../lib/handoff.ts";
import { useBackupFlow, BackupDialogs } from "./BackupFlow.tsx";
import { Button, ButtonLink } from "./ui/Button.tsx";

/**
 * The old site's call to move. In a browser tab, one press carries the
 * progress over in the link. An installed app can't hand its storage to the
 * new one, so it walks through installing the new site and syncing the two.
 */
export function MoveBanner() {
  if (!onLegacyHost()) return null;
  const urgent = currentPhase() === "urgent";
  return getClientInfo().standalone ? (
    <InstalledMove urgent={urgent} />
  ) : (
    <BrowserMove urgent={urgent} />
  );
}

function Frame({
  urgent,
  body,
  children,
}: {
  urgent: boolean;
  body: string;
  children: ComponentChildren;
}) {
  const s = t();
  return (
    <section
      class={`mb-4 rounded-lg border-2 px-4 py-3 print:hidden ${urgent ? "border-invalid bg-invalid-soft" : "border-accent bg-accent-soft"}`}
      data-testid="move-banner"
    >
      <h2 class="mb-1 text-section font-bold">{urgent ? s.move.urgentTitle : s.move.title}</h2>
      <p class="mb-3">{body}</p>
      {children}
    </section>
  );
}

function BrowserMove({ urgent }: { urgent: boolean }) {
  const s = t();
  const [busy, setBusy] = useState(false);

  async function move() {
    setBusy(true);
    track("domain_move", { via: "link", ...getClientInfo() });
    window.location.href = await handoffUrl();
  }

  return (
    <Frame urgent={urgent} body={urgent ? s.move.urgentBrowserBody : s.move.browserBody}>
      <Button variant="primary" size="lg" disabled={busy} onClick={() => void move()}>
        {s.move.moveButton}
      </Button>
    </Frame>
  );
}

function InstalledMove({ urgent }: { urgent: boolean }) {
  const s = t();
  const backup = useBackupFlow();
  // Ready before the press, so opening the new site stays a direct response to
  // it; rebuilt per page and as a press starts, to carry the latest progress.
  const { url } = useLocation();
  const [newSite, setNewSite] = useState(`${NEW_ORIGIN}/`);
  const refresh = () => void handoffUrl().then(setNewSite);
  useEffect(refresh, [url]);

  return (
    <Frame urgent={urgent} body={urgent ? s.move.urgentInstalledBody : s.move.installedBody}>
      <ol class="mb-3 list-decimal space-y-1 pl-6">
        {s.move.installedSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div class="flex flex-wrap gap-2">
        <ButtonLink
          variant="primary"
          size="lg"
          href={newSite}
          target="_blank"
          onPointerDown={refresh}
        >
          {s.move.openNewSite}
        </ButtonLink>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            track("domain_move", { via: "sync", ...getClientInfo() });
            backup.openSync();
          }}
        >
          {s.sync.title}
        </Button>
      </div>
      <BackupDialogs backup={backup} exportFilename="thisquiz-backup.json" />
    </Frame>
  );
}
