import { describe, expect, it } from 'vitest';
import { parseChord } from './chords';
import { QUALITIES, acceptSuggestion, capitaliseRoots, suggestChords } from './chordSuggest';

const symbols = (text: string, used: string[] = [], limit?: number) => suggestChords(text, used, limit).items.map((i) => i.symbol);

describe('chord autosuggest', () => {
  it('every offered quality parses', () => {
    for (const q of QUALITIES) expect(parseChord('C' + q).kind, `C${q}`).toBe('chord');
  });

  it('a bare root offers the common qualities, most common first (the typed text itself is not repeated)', () => {
    expect(symbols('D', [], 5)).toEqual(['Dm', 'D7', 'Dmaj7', 'Dm7', 'Dm7b5']);
  });

  it('completes the quality being typed', () => {
    expect(symbols('Dm7')).toEqual(['Dm7b5']);
    expect(symbols('G7', [], 4)).toEqual(['G7b9', 'G7#9', 'G7alt', 'G7sus4']);
    expect(symbols('Cma')).toEqual(['Cmaj7', 'Cmaj9', 'Cmaj7#11', 'Cmaj13']);
  });

  it('flat and sharp roots; a lowercase root is capitalised', () => {
    expect(symbols('Bbm', [], 2)).toEqual(['Bbm7', 'Bbm7b5']);
    expect(symbols('f#m7', [], 2)).toEqual(['F#m7', 'F#m7b5']);
    expect(symbols('e', [], 1)).toEqual(['E']);
  });

  it("chords already in the progression come first", () => {
    expect(symbols('G', ['Dm7', 'G7alt', 'Cmaj7'], 2)).toEqual(['G7alt', 'Gm']);
  });

  it('case-insensitive fallback', () => {
    expect(symbols('CMAJ', [], 1)).toEqual(['Cmaj7']);
    expect(symbols('Cmi', [], 1)).toEqual(['Cm']);
  });

  it('only the last symbol is completed', () => {
    const s = suggestChords('Dm7 G', [], 1);
    expect(s).toEqual({ from: 4, items: [{ symbol: 'Gm', tones: 'G B♭ D' }] });
    expect(acceptSuggestion('Dm7 G', s.from, 'G7')).toBe('Dm7 G7');
  });

  it('N.C., slash chords, nonsense and empty text', () => {
    expect(symbols('n')).toEqual(['N.C.']);
    expect(symbols('C/')).toEqual([]);
    expect(symbols('X')).toEqual([]);
    expect(symbols('')).toEqual([]);
    expect(symbols('Dm7 ')).toEqual([]);
    expect(symbols('Cqq')).toEqual([]);
  });

  it('a bare m means minor: no maj chords until the a', () => {
    expect(symbols('Dm')).not.toContain('Dmaj7');
  });

  it('shows the tones', () => {
    expect(suggestChords('Dm', [], 1).items[0]).toEqual({ symbol: 'Dm7', tones: 'D F A C' });
  });

  it('root letters are capitalised as typed; a b after a root stays a flat; qualities stay lower case', () => {
    expect(capitaliseRoots('d')).toBe('D');
    expect(capitaliseRoots('bbm7')).toBe('Bbm7');
    expect(capitaliseRoots('ebmaj7')).toBe('Ebmaj7');
    expect(capitaliseRoots('g7/b')).toBe('G7/B');
    expect(capitaliseRoots('dm7 g7')).toBe('Dm7 G7');
    // A quality typed after a space keeps its case: no root is followed by i or u (dim, aug).
    expect(capitaliseRoots('B dim')).toBe('B dim');
    expect(capitaliseRoots('B Dim')).toBe('B dim'); // the D capitalised at "B d" goes back down at the i
    expect(capitaliseRoots('c aug')).toBe('C aug');
    expect(capitaliseRoots('b d')).toBe('B D');
    expect(capitaliseRoots('c6/9 cm(add9) csus4 caug cdim7 c7alt')).toBe('C6/9 Cm(add9) Csus4 Caug Cdim7 C7alt');
    expect(capitaliseRoots('n.c.')).toBe('n.c.');
  });
});
