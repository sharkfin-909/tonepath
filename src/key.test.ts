// The Key (CONTEXT.md): the notes of a slot's scale, shared keys, steps between roots, the key's simple chords.
import { describe, expect, it } from 'vitest';
import { suggestChords } from './chordSuggest';
import { slotHarmony } from './harmony';
import { keyChords, keyOf, sameKey, stepsUp } from './key';

const h = (chord: string, scale?: string) => slotHarmony({ chord, scale });

describe('key of a slot', () => {
  it('the notes of its scale; the major key it is a mode of', () => {
    expect(keyOf(h('G7'))).toMatchObject({ pcs: [0, 2, 4, 5, 7, 9, 11], major: 0 }); // G Mixolydian: key of C
    expect(keyOf(h('Bbm7'))!.names).toEqual(['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb']);
    expect(keyOf(h('G7alt'))!.major).toBeNull(); // altered: not a mode of a major key
    expect(keyOf(h('N.C.'))).toBeNull();
    expect(keyOf(h('C7sus4b9'))).toBeNull(); // no scale fits
  });

  it('same key = same notes (any scale type); steps up between roots', () => {
    expect(sameKey(keyOf(h('Dm7')), keyOf(h('G7')))).toBe(true);
    expect(sameKey(keyOf(h('Dm7')), keyOf(h('A7')))).toBe(false);
    expect(sameKey(keyOf(h('Fmaj7#11')), keyOf(h('C')))).toBe(true); // F Lydian, C Ionian
    expect(sameKey(null, keyOf(h('C')))).toBe(false);
    const c = keyOf(h('C'))!;
    expect([stepsUp(c, 0, 7), stepsUp(c, 7, 5), stepsUp(c, 0, 1)]).toEqual([4, 6, null]);
  });
});

describe("the key's simple chords (SPEC §4.2)", () => {
  const before = (...chords: string[]) => chords.map((chord) => slotHarmony({ chord })).reverse(); // nearest first
  it('no earlier chord: all 7 triads of C', () => {
    expect(keyChords([]).map((k) => k.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  });
  it('after G7 (G Mixolydian, key of C): the other 6', () => {
    expect(keyChords(before('G7')).map((k) => k.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'Am', 'Bdim']);
  });
  it('after Bbm7 (B♭ Dorian, key of A♭), spelled with flats', () => {
    expect(keyChords(before('Bbm7')).map((k) => k.symbol)).toEqual(['Ab', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim']);
  });
  it('skips slots whose scale is not a mode of a major key', () => {
    expect(keyChords(before('Dm7', 'G7alt')).map((k) => k.symbol)).toEqual(['C', 'Em', 'F', 'G', 'Am', 'Bdim']); // G altered → back to Dm7
  });
  it('each carries the key\'s mode, which its chord accepts as a scale (so the key holds)', () => {
    const ks = keyChords([]);
    expect(ks.map((k) => k.scale)).toEqual(['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']);
    for (const k of ks) {
      const h = slotHarmony({ chord: k.symbol, scale: k.scale });
      expect(h.kind === 'chord' && h.scale, k.symbol).toBe(k.scale);
    }
  });
  it('plain triads keep their default scale (the in-key extras come last)', () => {
    const g = slotHarmony({ chord: 'G' });
    const b = slotHarmony({ chord: 'Bdim' });
    expect(g.kind === 'chord' && [g.scale, g.candidates.at(-1)]).toEqual(['ionian', 'mixolydian']);
    expect(b.kind === 'chord' && [b.scale, b.candidates.at(-1)]).toEqual(['whole-half-diminished', 'locrian']);
  });
  it('an empty field lists them; a typed root puts the key\'s chord first', () => {
    const inKey = ['C', 'Dm', 'Em', 'F', 'Am', 'Bdim'];
    expect(suggestChords('', [], 8, inKey).items.map((i) => i.symbol)).toEqual(inKey);
    expect(suggestChords('D', [], 8, inKey).items[0].symbol).toBe('Dm');
  });
});
