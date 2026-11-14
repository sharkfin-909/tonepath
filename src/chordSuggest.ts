// Pure `chordSuggest` module: completions for the chord symbol being typed (SPEC §4.2).
// The last whitespace-separated token is completed: root (A–G, accidental) + a known quality starting with what
// follows it. Chords already in the progression come first; every suggestion parses as a chord.

import { chordNoteNames, parseChord } from './chords';
import { prettyName } from './spelling';

/** Qualities offered, most common first. Every one is valid in our grammar (checked by the tests). */
export const QUALITIES = [
  '', 'm', '7', 'maj7', 'm7', 'm7b5', 'dim7', '6', 'm6', '9', 'maj9', 'm9', '13', 'm11',
  '7b9', '7#9', '7alt', '7sus4', 'sus4', 'sus2', '7#11', '7b13', '7#5', '7b5', '7b9b13', '7#9b13',
  'maj7#11', 'm(maj7)', 'dim', 'aug', '6/9', 'add9', 'm(add9)', '11', 'maj13', 'm13', '9sus4', '13sus4', '13b9', '9#11',
];

export interface ChordSuggestion {
  /** The full symbol to put in place of the token. */
  symbol: string;
  /** Its chord tones for the list, e.g. `D F A C`. */
  tones: string;
}

export interface Suggestions {
  /** Where the token being completed starts in the text. */
  from: number;
  items: ChordSuggestion[];
}

const NONE: Suggestions = { from: 0, items: [] };

/** Suggestions for `text` with the cursor at its end. `used` = chords already in the progression. */
export function suggestChords(text: string, used: string[] = [], limit = 8): Suggestions {
  const from = Math.max(text.lastIndexOf(' '), text.lastIndexOf('\t')) + 1;
  const token = text.slice(from);
  if (token === '' || token.includes('/') || /\s/.test(token)) return NONE;

  if (/^n\.?c?\.?$/i.test(token)) return { from, items: [{ symbol: 'N.C.', tones: 'no chord' }] };

  // A lowercase root letter is accepted and capitalised in the suggestions.
  const m = /^([A-Ga-g])(#|b|♯|♭)?/.exec(token);
  if (!m) return NONE;
  const root = m[1].toUpperCase() + (m[2] ?? '');
  const q = token.slice(m[0].length);

  const seen = new Set<string>();
  const items: ChordSuggestion[] = [];
  const offer = (symbol: string) => {
    if (items.length >= limit || seen.has(symbol) || symbol === token) return;
    const c = parseChord(symbol);
    if (c.kind !== 'chord') return;
    seen.add(symbol);
    items.push({ symbol, tones: chordNoteNames(c).map(prettyName).join(' ') });
  };

  const typedRoot = (s: string) => /^([A-G])(#|b|♯|♭)?/.exec(s)?.[0];
  for (const u of used) if (typedRoot(u) === root && u.slice(root.length).startsWith(q)) offer(u);
  // A bare `m` means minor: `maj` qualities wait until the `a` is typed.
  const fits = (quality: string) => quality.startsWith(q) && !(q === 'm' && quality.startsWith('ma'));
  for (const quality of QUALITIES) if (fits(quality)) offer(root + quality);
  if (items.length === 0) {
    // Case-insensitive fallback: `Cmaj` → `Cmaj7`, `CM` → `Cmaj7`, `Cmi` → `Cm7`.
    const lq = q.toLowerCase().replace(/^mi(?!n)/, 'm');
    for (const quality of QUALITIES) if (quality.toLowerCase().startsWith(lq)) offer(root + quality);
  }
  return { from, items };
}

/** The text with the token at `from` replaced by `symbol`. */
export function acceptSuggestion(text: string, from: number, symbol: string): string {
  return text.slice(0, from) + symbol;
}
