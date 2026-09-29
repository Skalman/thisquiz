/** Text kept on a token's line, e.g. "answer " and "?". */
interface Glued {
  lead: string;
  tail: string;
}

/** A run of a question's text, or a token in it the board may decorate. */
export type TextPart =
  | { kind: "text"; text: string }
  | ({ kind: "letter"; letter: string } & Glued)
  | ({ kind: "question"; number: string } & Glued);

/** Letter and question-number tokens in question text. */
const TOKEN = /(?<=answer )([A-E])\b|#(\d+)/g;

/** The word ending a run of text, with the space after it. */
const LEAD = /\S*\s?$/;

/** The non-space characters opening a run of text, up to any next token. */
const TAIL = /^[^\s#]*/;

/** Splits question text at "answer X" letters and "#n" numbers. */
export function splitBoardText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [whole, letter, number] = match;
    const before = text.slice(last, match.index);
    const lead = LEAD.exec(before)?.[0] ?? "";
    const end = match.index + whole.length;
    const tail = TAIL.exec(text.slice(end))?.[0] ?? "";
    const rest = before.slice(0, before.length - lead.length);
    if (rest) parts.push({ kind: "text", text: rest });
    parts.push(
      letter ? { kind: "letter", letter, lead, tail } : { kind: "question", number, lead, tail },
    );
    last = end + tail.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}
