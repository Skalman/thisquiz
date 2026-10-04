import { Dialog } from "./ui/Dialog.tsx";
import { Link } from "./ui/Link.tsx";
import { contactAddress } from "../lib/contact.ts";
import { t } from "../i18n/index.ts";

/** What the puzzles are, what the site keeps, and who to write to. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const s = t();
  const contact = contactAddress();
  return (
    <Dialog title={s.about.title} widthClass="max-w-120" onClose={onClose}>
      <h4 class="mb-1.5 text-section font-semibold">{s.help.whatIs}</h4>
      {s.help.descriptionParagraphs.map((x) => (
        <p key={x} class="mb-2">
          {x}
        </p>
      ))}
      <h4 class="mt-4 mb-1.5 text-section font-semibold">{s.privacy.title}</h4>
      {s.privacy.paragraphs.map((x) => (
        <p key={x} class="mb-2">
          {x}
        </p>
      ))}
      {/* Only when this build has an address. */}
      {contact && (
        <>
          <h4 class="mt-4 mb-1.5 text-section font-semibold">{s.contact.title}</h4>
          <p class="mb-2">{s.contact.body}</p>
          <p class="mb-2">
            <Link href={`mailto:${contact}`}>{contact}</Link>
          </p>
        </>
      )}
      <p class="mt-4 text-body text-muted">{s.contact.signature}</p>
    </Dialog>
  );
}
