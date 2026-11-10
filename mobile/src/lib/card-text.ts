// Turns the raw lines that on-device text recognition reads off a card photo into
// search terms: the collector number ("006/165") and a best guess at the card name.

export interface ParsedCardText {
  /** Printed number before the slash, e.g. "006", "TG05". */
  number: string | null;
  /** Number after the slash when it is a plain set size, e.g. 165. */
  setTotal: number | null;
  /** Most likely card name. */
  name: string | null;
  /** Other name-like lines, best first. */
  nameCandidates: string[];
}

// Letter prefixes used by subset numbering: Trainer Gallery, Galarian Gallery, Shiny Vault, ...
const PREFIX = '(?:TG|GG|SV|RC|SH|H)?';
// Text recognition often reads 0 as O and 1 as I or l.
const DIGITISH = '[0-9OoIl|]';
const NUMBER_RE = new RegExp(
  `(?:^|[^A-Za-z0-9])(${PREFIX}${DIGITISH}{1,3})\\s*/\\s*(${PREFIX}${DIGITISH}{2,3})(?![0-9])`,
  'g',
);

const STOP_PREFIXES = [
  'basic',
  'stage',
  'evolves',
  'pokémon',
  'pokemon',
  'trainer',
  'item',
  'supporter',
  'stadium',
  'energy',
  'weakness',
  'resistance',
  'retreat',
  'ability',
  'illus',
  'tool',
  'rule',
  'put ',
  'nintendo',
  '©',
];

function splitPrefix(token: string): [string, string] {
  const m = token.match(/^(TG|GG|SV|RC|SH|H)?(.*)$/);
  return [m?.[1] ?? '', m?.[2] ?? token];
}

function fixDigits(s: string): string | null {
  if (!/[0-9]/.test(s)) return null; // need at least one real digit
  const fixed = s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  return /^[0-9]+$/.test(fixed) ? fixed : null;
}

function findNumber(lines: string[]): Pick<ParsedCardText, 'number' | 'setTotal'> {
  let found: Pick<ParsedCardText, 'number' | 'setTotal'> = { number: null, setTotal: null };
  // The collector number is printed near the bottom, so the last match wins.
  for (const line of lines) {
    for (const m of line.matchAll(NUMBER_RE)) {
      const [leftPrefix, leftDigits] = splitPrefix(m[1]);
      const [rightPrefix, rightDigits] = splitPrefix(m[2]);
      const left = fixDigits(leftDigits);
      const right = fixDigits(rightDigits);
      if (!left || !right) continue;
      found = {
        number: `${leftPrefix}${left}`,
        setTotal: rightPrefix ? null : Number(right),
      };
    }
  }
  return found;
}

function cleanNameLine(line: string): string {
  return line
    .replace(/\bHP\s*\d+\b/gi, '')
    .replace(/\b\d+\s*HP\b/gi, '')
    .replace(/^(BASIC|STAGE\s*[12])\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeName(line: string): boolean {
  if (line.length < 3 || line.length > 28) return false;
  const lower = line.toLowerCase();
  if (STOP_PREFIXES.some((p) => lower.startsWith(p))) return false;
  const letters = (line.match(/\p{L}/gu) ?? []).length;
  const visible = line.replace(/\s/g, '').length;
  if (letters < 3 || letters / visible < 0.75) return false;
  // Names are a few words; attack text and rules are sentences.
  return line.split(' ').length <= 4 && !/[.,:;!?]$/.test(line);
}

export function parseCardText(rawLines: string[]): ParsedCardText {
  const lines = rawLines
    .flatMap((block) => block.split(/\r?\n/))
    .map((l) => l.trim())
    .filter(Boolean);

  const nameCandidates: string[] = [];
  for (const line of lines) {
    const cleaned = cleanNameLine(line);
    if (looksLikeName(cleaned) && !nameCandidates.includes(cleaned)) nameCandidates.push(cleaned);
  }

  return { ...findNumber(lines), name: nameCandidates[0] ?? null, nameCandidates };
}
