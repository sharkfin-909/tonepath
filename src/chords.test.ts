// Test table 1 (SPEC §14.1): every quality, synonym, alteration and rejection row of §4.3,
// with the implied tones of §5.1.
import { describe, expect, it } from 'vitest';
import { chordNoteNames, interpretation, parseChord, splitSymbols } from './chords';

/** Spelled tones (root first, low → high), plus `/bass` when there is one; or the parse kind. */
function tones(text: string): string {
  const c = parseChord(text);
  if (c.kind !== 'chord') return c.kind;
  return chordNoteNames(c).join(' ') + (c.bass ? ` /${c.bass}` : '');
}

describe('roots', () => {
  it.each([
    ['C', 'C E G'],
    ['F#', 'F# A# C#'],
    ['F♯', 'F# A# C#'],
    ['Bb', 'Bb D F'],
    ['B♭', 'Bb D F'],
    ['Cb', 'Cb Eb Gb'],
    ['E#', 'E# A B#'], // G## simplified (§5.3)
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));

  it.each(['c', 'c7', 'H7', 'x', '#C', 'Cx'])('%s is invalid', (sym) => expect(tones(sym)).toBe('invalid'));
});

describe('triads', () => {
  it.each([
    ['C', 'C E G'],
    ['Cm', 'C Eb G'],
    ['Cdim', 'C Eb Gb'],
    ['Caug', 'C E G#'],
    ['C+', 'C E G#'],
    ['Csus2', 'C D G'],
    ['Csus4', 'C F G'],
    ['C5', 'C G'],
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));
});

describe('sixths', () => {
  it.each([
    ['C6', 'C E G A'],
    ['Cm6', 'C Eb G A'],
    ['C6/9', 'C E G A D'],
    ['Cm6/9', 'C Eb G A D'],
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));
});

describe('sevenths', () => {
  it.each([
    ['C7', 'C E G Bb'],
    ['Cmaj7', 'C E G B'],
    ['Cm7', 'C Eb G Bb'],
    ['Cm7b5', 'C Eb Gb Bb'],
    ['Cdim7', 'C Eb Gb A'],
    ['Cm(maj7)', 'C Eb G B'],
    ['C7sus4', 'C F G Bb'],
    ['Caug7', 'C E G# Bb'],
    ['C7#5', 'C E G# Bb'],
    ['Cmaj7#5', 'C E G# B'],
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));
});

describe('extensions (implied tones per §5.1)', () => {
  it.each([
    ['C9', 'C E G Bb D'],
    ['Cmaj9', 'C E G B D'],
    ['Cm9', 'C Eb G Bb D'],
    ['C11', 'C G Bb D F'],
    ['Cm11', 'C Eb G Bb D F'],
    ['C13', 'C E G Bb D A'],
    ['Cmaj13', 'C E G B D A'],
    ['Cm13', 'C Eb G Bb D F A'],
    ['Cadd9', 'C E G D'],
    ['Cadd11', 'C E G F'],
    ['Cmadd9', 'C Eb G D'],
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));
});

describe('alterations', () => {
  it.each([
    ['C7b5', 'C E Gb Bb'],
    ['C7#5', 'C E G# Bb'],
    ['C7b9', 'C E G Bb Db'],
    ['C7#9', 'C E G Bb D#'],
    ['C7#11', 'C E G Bb F#'],
    ['C7b13', 'C E G Bb Ab'],
    ['C7b9#11', 'C E G Bb Db F#'],
    ['C7(b9,#11)', 'C E G Bb Db F#'],
    ['C7(b9, #11)', 'C E G Bb Db F#'],
    ['C7(b9)(#11)', 'C E G Bb Db F#'],
    ['C7b9#9', 'C E G Bb Db D#'],
    ['C7#5#9', 'C E G# Bb D#'],
    ['C7#9b13', 'C E G Bb D# Ab'],
    ['C7b9b13', 'C E G Bb Db Ab'],
    ['C7b5#5', 'C E Gb G# Bb'],
    ['Cmaj7#11', 'C E G B F#'],
    ['C13b9', 'C E G Bb Db A'],
    ['C9#11', 'C E G Bb D F#'],
    ['C7♭9♯11', 'C E G Bb Db F#'],
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));

  it('#5 and b13 are kept once (as the #5)', () => expect(tones('C7#5b13')).toBe('C E G# Bb'));
  it('exact duplicates collapse', () => expect(tones('C7b9b9')).toBe(tones('C7b9')));
});

describe('alt', () => {
  it.each(['Calt', 'C7alt', 'Calt7', 'CALT'])('%s = 7#5#9', (sym) => expect(tones(sym)).toBe('C E G# Bb D#'));
});

describe('slash chords', () => {
  it.each([
    ['C/E', 'C E G /E'],
    ['C/Bb', 'C E G /Bb'],
    ['C/A#', 'C E G /A#'],
    ['Dm7/G', 'D F A C /G'],
    ['C6/9/E', 'C E G A D /E'],
    ['C/B♭', 'C E G /Bb'],
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));

  it.each(['C/e', 'C/H', 'C/'])('%s is invalid', (sym) => expect(tones(sym)).toBe('invalid'));
});

describe('synonyms', () => {
  const groups: Record<string, string[]> = {
    minor: ['Cm', 'C-', 'Cmin', 'Cmi', 'CMIN', 'CMi'],
    'minor 7': ['Cm7', 'C-7', 'Cmin7', 'Cmi7'],
    maj7: ['Cmaj7', 'CM7', 'Cma7', 'CΔ', 'CΔ7', 'C△', 'C△7', 'CMaj7', 'CMAJ7'],
    'half-dim': ['Cm7b5', 'C-7b5', 'Cø', 'Cø7', 'Cm7(b5)', 'Cm7♭5'],
    dim: ['Cdim', 'C°', 'Co', 'CDIM'],
    dim7: ['Cdim7', 'C°7', 'Co7'],
    aug: ['Caug', 'C+', 'CAUG'],
    aug7: ['Caug7', 'C+7', 'C7+', 'C7#5'],
    'minor-major': ['Cm(maj7)', 'CmMaj7', 'C-Δ7', 'CmΔ', 'Cmmaj7'],
    sus4: ['Csus4', 'CSUS4'],
    add9: ['Cadd9', 'CADD9'],
  };
  for (const [name, syms] of Object.entries(groups)) {
    it(`${name}: ${syms.join(' ')}`, () => {
      const want = tones(syms[0]);
      expect(want).not.toBe('invalid');
      for (const s of syms) expect([s, tones(s)]).toEqual([s, want]);
    });
  }

  it('M vs m is case-sensitive', () => {
    expect(tones('CM7')).toBe('C E G B');
    expect(tones('Cm7')).toBe('C Eb G Bb');
  });
});

describe('typed spelling decides', () => {
  it.each([
    ['A#7', 'A# D E# G#'],
    ['Gb7', 'Gb Bb Db Fb'],
    ['Db7', 'Db F Ab Cb'],
  ])('%s → %s', (sym, want) => expect(tones(sym)).toBe(want));
});

describe('N.C. and empty', () => {
  it.each(['N.C.', 'NC', 'n.c.', 'N.C', 'nc'])('%s is intentional silence', (s) => expect(tones(s)).toBe('nc'));
  it('empty', () => expect(tones('')).toBe('empty'));
});

describe('rejected input', () => {
  it.each([
    ['C4', 'bare digit other than 5/6/7/9/11/13'],
    ['C2', 'bare digit'],
    ['C8', 'bare digit'],
    ['C15', 'beyond 13'],
    ['C7omit3', 'omit'],
    ['C/E/G', 'polychord'],
    ['C|D', 'polychord'],
    ['C9#9', 'same degree raised and natural'],
    ['C7b5(5)', 'altered and natural 5th'],
    ['C11#11', 'altered and natural 11th'],
    ['C13b13', 'altered and natural 13th'],
    ['Cmsus4', 'conflicting 3rds'],
    ['Cdim#5', 'fifth already fixed'],
    ['Caug7b5', 'fifth already fixed'],
    ['C(b9)', 'alteration needs a 7th chord'],
    ['Cmb9', 'alteration needs a 7th chord'],
    ['Cmaj', 'maj needs a number'],
    ['Cmaj6', 'maj with a 6'],
    ['Cdim9', 'dim with an extension'],
    ['Cm7alt', 'alt on a minor chord'],
    ['C7(b9', 'unbalanced parenthesis'],
    ['C maj7', 'space inside a symbol'],
    ['Cadd9add9', 'duplicate add'],
    ['C7add9', 'add on a 7th chord'],
  ])('%s (%s)', (sym) => expect(tones(sym)).toBe('invalid'));
});

describe('interpretation', () => {
  it.each([
    ['Dm7', 'Dm7 → D F A C'],
    ['C/Bb', 'C/Bb → C E G / Bb bass'],
    ['N.C.', 'N.C. — no chord (intentional silence)'],
    ['C4', 'Not a recognised chord symbol'],
    ['', 'No chord yet'],
  ])('%s', (sym, want) => expect(interpretation(sym)).toBe(want));
});

describe('splitSymbols', () => {
  it.each([
    ['Dm7', ['Dm7']],
    ['  Dm7   G7 ', ['Dm7', 'G7']],
    ['C7(b9, #11) F', ['C7(b9, #11)', 'F']],
    // A word that is no chord on its own joins the chord before it, when the two make one: a space before the quality.
    ['C maj7', ['Cmaj7']],
    ['B dim', ['Bdim']],
    ['B dim7 E7', ['Bdim7', 'E7']],
    ['B 7', ['B7']],
    ['C m', ['Cm']],
    ['C aug', ['Caug']],
    ['Bb ø', ['Bbø']],
    ['Dm7 G7', ['Dm7', 'G7']],
    ['C xyz', ['C', 'xyz']], // still two (the second refused later)
    ['A B C', ['A', 'B', 'C']],
    ['', []],
  ])('%j', (text, want) => expect(splitSymbols(text)).toEqual(want));
});
