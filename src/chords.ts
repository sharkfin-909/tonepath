// Pure `chords` module: our own chord-symbol normaliser (SPEC §4.2–4.3, §5.1).
// Text → root + interval list (tonal interval names, every tone named or implied) + optional bass, or invalid.
// No octaves: classification is by pitch class.

import { transpose, simplify } from '@tonaljs/note';
import { semitones } from '@tonaljs/interval';

export type ChordParse =
  | { kind: 'empty' }
  | { kind: 'nc' }
  | { kind: 'invalid' }
  | { kind: 'chord'; root: string; intervals: string[]; bass?: string };

const NC = /^n\.?c\.?$/i;
const NOTE = /^([A-G])(#|b|♯|♭)?$/;

/** `♯`/`♭` → ASCII; returns null when not an uppercase note name. */
function noteName(text: string): string | null {
  const m = NOTE.exec(text);
  if (!m) return null;
  const acc = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : (m[2] ?? '');
  return m[1] + acc;
}

type Third = 'M' | 'm' | 'none';
type Fifth = 'P' | 'd' | 'A' | 'none';
type Seventh = 'm' | 'M' | 'd' | null;
type Alteration = 'b5' | '#5' | 'b9' | '#9' | '#11' | 'b13';

interface Parts {
  third: Third;
  fifth: Fifth;
  seventh: Seventh;
  sixth: boolean;
  ext: 0 | 9 | 11 | 13;
  add: Set<9 | 11>;
  alterations: Set<Alteration>;
  sus: 2 | 4 | null;
}

/** Parse the quality text after the root (and before any slash bass). Returns null if invalid. */
function parseQuality(raw: string): Parts | null {
  // Parentheses and commas group alterations / qualities; their contents read in sequence.
  if (!/^[^()]*(\([^()]*\)[^()]*)*$/.test(raw)) return null;
  let s = raw
    .replace(/\(([^()]*)\)/g, (_, inner: string) => inner.replace(/[\s,]+/g, ''))
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/△/g, 'Δ');
  if (/[\s,]/.test(s)) return null;

  const p: Parts = {
    third: 'M',
    fifth: 'P',
    seventh: null,
    sixth: false,
    ext: 0,
    add: new Set(),
    alterations: new Set(),
    sus: null,
  };

  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(s);
    if (m) s = s.slice(m[0].length);
    return m;
  };

  if (s === '5') return { ...p, third: 'none' };

  // --- quality ---
  let major7 = false; // a maj / M / Δ token was seen
  let bareDelta = false; // the maj token was Δ / △, which also stands alone for maj7
  let quality: 'major' | 'minor' | 'dim' | 'aug' | 'halfdim' = 'major';
  const majToken = () => {
    // `M` is case-sensitive (major, before a number); `maj` / `ma` are case-insensitive.
    const m = /^(Δ|M(?=\d))/.exec(s) ?? /^(maj|ma(?=\d))/i.exec(s);
    if (!m) return false;
    s = s.slice(m[0].length);
    major7 = true;
    bareDelta = m[0] === 'Δ';
    return true;
  };

  if (take(/^ø/)) {
    quality = 'halfdim';
  } else if (majToken()) {
    // major with a major 7th: Cmaj7, CM7, CΔ
  } else if (take(/^(min|mi)/i) || take(/^m/) || take(/^-/)) {
    quality = 'minor';
    majToken(); // minor-major: m(maj7), mMaj7, -Δ7, mΔ
  } else if (take(/^(dim|°|o)/i)) {
    quality = 'dim';
  } else if (take(/^(aug|\+)/i)) {
    quality = 'aug';
  }

  switch (quality) {
    case 'minor':
      p.third = 'm';
      break;
    case 'dim':
      p.third = 'm';
      p.fifth = 'd';
      break;
    case 'aug':
      p.fifth = 'A';
      break;
    case 'halfdim':
      p.third = 'm';
      p.fifth = 'd';
      p.seventh = 'm';
      break;
  }

  // --- number: 6, 6/9, 7, 9, 11, 13; or alt ---
  const seventhKind = (): Seventh => (major7 ? 'M' : quality === 'dim' ? 'd' : 'm');
  const altWord = () => {
    if (!take(/^alt7?/i)) return false;
    if (quality !== 'major' || major7) return null;
    p.seventh = 'm';
    p.alterations.add('#5').add('#9');
    return true;
  };

  const alt = altWord();
  if (alt === null) return null;
  if (!alt) {
    let num: RegExpExecArray | null;
    if ((num = take(/^6\/9/))) {
      if (quality !== 'major' && quality !== 'minor') return null;
      if (major7) return null;
      p.sixth = true;
      p.add.add(9);
    } else if ((num = take(/^(13|11|9|7|6)/))) {
      const n = Number(num[1]);
      if (n === 6) {
        if ((quality !== 'major' && quality !== 'minor') || major7) return null;
        p.sixth = true;
      } else {
        if (quality === 'halfdim' && n !== 7) return null;
        p.seventh = seventhKind();
        if (quality === 'dim' && n !== 7) return null;
        if (n > 7) p.ext = n as 9 | 11 | 13;
        // `7alt` after the 7
        if (n === 7 && quality === 'major' && !major7) {
          const a = altWord();
          if (a === null) return null;
        }
      }
    } else if (major7) {
      // bare Δ = maj7 (CΔ, mΔ); `maj` / `ma` / `M` need a number
      if (!bareDelta) return null;
      p.seventh = 'M';
    }
    // `+7` / `7+`: aug after the 7th
    if (p.seventh === 'm' && quality === 'major' && take(/^\+/)) p.alterations.add('#5');
  }
  if (quality === 'aug' && p.sixth) return null;
  if (major7 && p.seventh !== 'M') return null;

  // --- sus ---
  const sus = take(/^sus(2|4)/i);
  if (sus) {
    if (quality !== 'major') return null;
    p.third = 'none';
    p.sus = Number(sus[1]) as 2 | 4;
  }

  // --- add9 / add11 ---
  let addTok: RegExpExecArray | null;
  while ((addTok = take(/^add(9|11)/i))) {
    const n = Number(addTok[1]) as 9 | 11;
    if (p.seventh || p.ext) return null;
    if (p.add.has(n)) return null;
    p.add.add(n);
  }

  // --- alterations: b5 #5 b9 #9 #11 b13 (7th chords only) ---
  let alt2: RegExpExecArray | null;
  while ((alt2 = take(/^(b5|#5|b9|#9|#11|b13)/))) {
    if (!p.seventh) return null;
    p.alterations.add(alt2[1] as Alteration);
  }

  if (s.length > 0) return null; // anything left (incl. bare digits like C4, C7b5(5)) is invalid

  // --- contradictions: the same degree altered and named natural, or a 5th the quality already fixed ---
  const a = p.alterations;
  if ((p.fifth === 'd' && a.has('#5')) || (p.fifth === 'A' && a.has('b5'))) return null;
  if (p.ext === 9 && (a.has('b9') || a.has('#9'))) return null;
  if (p.ext === 11 && a.has('#11')) return null;
  if (p.ext === 13 && a.has('b13')) return null;

  return p;
}

/** The chord's tones as tonal interval names, low → high: every tone named or implied (SPEC §5.1). */
function intervalsOf(p: Parts): string[] {
  const out = new Map<string, string>(); // degree key → interval
  out.set('1', '1P');
  if (p.sus === 2) out.set('2', '2M');
  if (p.sus === 4) out.set('4', '4P');
  if (p.third !== 'none') out.set('3', p.third === 'M' ? '3M' : '3m');
  if (p.fifth !== 'none') out.set('5', `5${p.fifth}`);
  if (p.sixth) out.set('6', '6M');
  if (p.seventh) out.set('7', p.seventh === 'M' ? '7M' : p.seventh === 'm' ? '7m' : '7d');

  if (p.ext >= 9) out.set('9', '9M');
  if (p.ext === 11) {
    out.set('11', '11P');
    // Plain / maj 11: no 3rd (SPEC §5.1); m11 keeps its minor 3rd.
    if (p.third === 'M') out.delete('3');
  }
  if (p.ext === 13) {
    out.set('13', '13M');
    if (p.third === 'm') out.set('11', '11P'); // m13 = full stack
  }
  if (p.add.has(9)) out.set('9', '9M');
  if (p.add.has(11)) out.set('11', '11P');

  // Alterations replace the natural tone of their degree (an altered 5th replaces the 5th).
  const a = p.alterations;
  if (a.has('b5') && a.has('#5')) {
    out.set('5', '5d');
    out.set('5#', '5A');
  } else if (a.has('b5')) out.set('5', '5d');
  else if (a.has('#5')) out.set('5', '5A');
  if (a.has('b9') || a.has('#9')) {
    out.delete('9');
    if (a.has('b9')) out.set('9b', '9m');
    if (a.has('#9')) out.set('9#', '9A');
  }
  if (a.has('#11')) out.set('11', '11A');
  // #5 and b13 are the same pitch: kept once, as the #5.
  if (a.has('b13') && !a.has('#5') && p.fifth !== 'A') {
    out.delete('13');
    out.set('13', '13m');
  }

  return [...out.values()].sort((x, y) => (semitones(x) ?? 0) - (semitones(y) ?? 0));
}

/** Parse one chord symbol (no surrounding whitespace). */
export function parseChord(text: string): ChordParse {
  const t = text.trim();
  if (t === '') return { kind: 'empty' };
  if (NC.test(t)) return { kind: 'nc' };

  const rootMatch = /^([A-G])(#|b|♯|♭)?/.exec(t);
  if (!rootMatch) return { kind: 'invalid' };
  const root = noteName(rootMatch[0])!;
  let rest = t.slice(rootMatch[0].length);

  let bass: string | undefined;
  const slash = rest.lastIndexOf('/');
  if (slash >= 0) {
    const b = noteName(rest.slice(slash + 1));
    if (b) {
      bass = b;
      rest = rest.slice(0, slash);
    }
  }

  const parts = parseQuality(rest);
  if (!parts) return { kind: 'invalid' };
  return { kind: 'chord', root, intervals: intervalsOf(parts), ...(bass ? { bass } : {}) };
}

/** Pitch-class names of a parsed chord, root first (at most one accidental; Cb / Fb / E# / B# kept). */
export function chordNoteNames(c: Extract<ChordParse, { kind: 'chord' }>): string[] {
  return c.intervals.map((iv) => {
    const n = transpose(c.root, iv);
    return /(##|bb)/.test(n) ? simplify(n) : n;
  });
}

/** The tooltip text for a chord label (SPEC §4.2): `Dm7 → D F A C`. */
export function interpretation(text: string): string {
  const c = parseChord(text);
  switch (c.kind) {
    case 'empty':
      return 'No chord yet';
    case 'nc':
      return 'N.C. — no chord (intentional silence)';
    case 'invalid':
      return 'Not a recognised chord symbol';
    case 'chord': {
      const tones = chordNoteNames(c).join(' ');
      return `${text.trim()} → ${tones}${c.bass ? ` / ${c.bass} bass` : ''}`;
    }
  }
}

/** Split typed text into chord symbols on whitespace outside parentheses (SPEC §4.2). */
export function splitSymbols(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
