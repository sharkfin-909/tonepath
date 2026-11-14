// Test table 6 (SPEC §14.6): row lengths, t₀, cell steps, spelled degree numbers, anchor stability across a
// ii–V–I — Concert, plus trombone, violin and B♭ tenor sax (written view), and the §8.4 cases.
import { describe, expect, it } from 'vitest';
import { slotHarmony } from './harmony';
import { CONCERT_VIEW, cellCentre, dockHex, hexGrid, hexRadius, slotHex, type SlotHex } from './hex';
import { hexRange, instrumentOf, writtenChord } from './instruments';

const hexFor = (chord: string, scale?: string): SlotHex => {
  const h = slotHex(slotHarmony({ chord, ...(scale ? { scale } : {}) }), CONCERT_VIEW);
  if (!h) throw new Error(`no hex for ${chord}`);
  return h;
};
const row = (hex: SlotHex, r: number) => hex.cells.filter((c) => c.r === r);
/** Degree numbers through one octave of the ladder, from the root up. */
const octaveDegrees = (hex: SlotHex, root: string) => {
  const bottom = row(hex, 0);
  const start = bottom.findIndex((c) => c.name === root);
  const pcs = new Set<number>();
  const out: number[] = [];
  for (const c of bottom.slice(start)) {
    if (pcs.has(c.midi % 12)) break;
    pcs.add(c.midi % 12);
    out.push(c.degree);
  }
  return out;
};

describe('test table 6: hex layout (Concert C3–C6)', () => {
  it('Dm7 (D Dorian): 14·15·15·16 cells, anchor C3, top cell C6', () => {
    const hex = hexFor('Dm7');
    expect(hex.stepsInRange).toBe(22);
    expect(hex.rowLengths).toEqual([14, 15, 15, 16]);
    expect(hex.anchor).toBe(48);
    const top = row(hex, 3);
    expect(top[top.length - 1].midi).toBe(84);
    expect(hex.cells.every((c) => c.inRange)).toBe(true);
  });

  it('cell (r, c) = scale step c + 2r: right = step, up-left = a third, left column = chain of thirds', () => {
    const hex = hexFor('Dm7');
    for (const c of hex.cells) expect(c.step).toBe(c.c + 2 * c.r);
    expect([0, 1, 2, 3].map((r) => row(hex, r)[0].name)).toEqual(['C', 'E', 'G', 'B']);
    expect(row(hex, 0).slice(0, 4).map((c) => c.name)).toEqual(['C', 'D', 'E', 'F']);
  });

  it('Dm7 degrees and roles: D = 1, chord tones white (D F A C), the rest scale tones', () => {
    const hex = hexFor('Dm7');
    expect(row(hex, 0).slice(0, 7).map((c) => `${c.name}${c.degree}${c.role[0]}`)).toEqual([
      'C7c', 'D1c', 'E2s', 'F3c', 'G4s', 'A5c', 'B6s',
    ]);
  });

  it('G7 (Mixolydian) and Cmaj7 (Ionian) degrees', () => {
    expect(octaveDegrees(hexFor('G7'), 'G')).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(octaveDegrees(hexFor('Cmaj7'), 'C')).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('ii–V–I: the anchor and every cell pitch stay put; only fills and rings change', () => {
    const [ii, V, I] = ['Dm7', 'G7', 'Cmaj7'].map((c) => hexFor(c));
    expect(V.anchor).toBe(ii.anchor);
    expect(I.anchor).toBe(ii.anchor);
    expect(V.cells.map((c) => c.midi)).toEqual(ii.cells.map((c) => c.midi));
    expect(I.cells.map((c) => c.midi)).toEqual(ii.cells.map((c) => c.midi));
    const at = (h: SlotHex, midi: number) => h.cells.find((c) => c.midi === midi)!;
    expect([ii, V, I].map((h) => `${at(h, 60).degree}${at(h, 60).role[0]}`)).toEqual(['7c', '4s', '1c']);
  });

  it('8-note scale: G half-whole (G7b9) degrees 1 2 3 3 4 5 6 7', () => {
    const hex = hexFor('G7b9');
    expect(octaveDegrees(hex, 'G')).toEqual([1, 2, 3, 3, 4, 5, 6, 7]);
    expect(hex.rowLengths).toEqual([16, 17, 17, 18]); // 24 steps in C3–C6 (no C in G half-whole)
  });

  it('6-note scale: C whole-tone (C7#5) degrees 1 2 3 4 5 7', () => {
    const hex = hexFor('C7#5');
    expect(octaveDegrees(hex, 'C')).toEqual([1, 2, 3, 4, 5, 7]);
    expect(hex.rowLengths).toEqual([11, 12, 12, 13]); // 19 steps (C3 … C6)
  });

  it('G altered, scale-spelled (override on G7b5b9): degrees 1 2 3 3 5 6 7', () => {
    const hex = hexFor('G7b5b9', 'altered');
    expect(octaveDegrees(hex, 'G')).toEqual([1, 2, 3, 3, 5, 6, 7]);
  });

  it('G7alt: anchor moves to Db3 (lowest in-range altered tone); chord spelling renames the #5 / #9', () => {
    const hex = hexFor('G7alt');
    expect(hex.anchor).toBe(49);
    expect(hex.rowLengths).toEqual([13, 14, 14, 15]);
    const names = row(hex, 0).slice(0, 7).map((c) => `${c.name}${c.degree}`);
    expect(names).toEqual(['Db5', 'D#5', 'F7', 'G1', 'Ab2', 'A#2', 'B3']);
  });

  it('cells common to G7 and G7alt keep their pitch', () => {
    const g7 = new Set(hexFor('G7').cells.map((c) => c.midi));
    const alt = hexFor('G7alt');
    expect(alt.cells.filter((c) => g7.has(c.midi)).length).toBeGreaterThan(0);
  });

  it('no slot hex without a chord (the dock borrows a layout, see §8.4); a no-fit chord gets its chord-tones hex', () => {
    for (const chord of ['', 'N.C.', 'C4']) expect(slotHex(slotHarmony({ chord }))).toBeNull();
    expect(slotHex(slotHarmony({ chord: 'C7sus4b9' }))).not.toBeNull();
  });
});

describe('hexGrid and fitting', () => {
  it('out-of-range cells only in a limited range, and only past the top', () => {
    const tiny = hexGrid(new Set([0, 2, 4, 5, 7, 9, 11]), { lo: 60, hi: 64, limited: true });
    expect(tiny.rowLengths).toEqual([2, 3, 3, 4]);
    expect(tiny.cells.filter((c) => !c.inRange).every((c) => c.midi > 64)).toBe(true);
  });

  it('radius = the largest that fits width and height; grid centred', () => {
    const g = hexGrid(new Set([0, 2, 4, 5, 7, 9, 11]), CONCERT_VIEW);
    const R = hexRadius(g, 1152, 400, 12);
    expect(R).toBeCloseTo(Math.min((1152 - 24) / (Math.sqrt(3) * 16), (400 - 24) / 6.5));
    const xs = g.cells.map((c) => cellCentre(c, g, R, 1152, 400).cx);
    const w = Math.sqrt(3) * R;
    expect((Math.min(...xs) - w / 2 + Math.max(...xs) + w / 2) / 2).toBeCloseTo(576, 0);
  });
});

describe('test table 6: hex layout per instrument (written pitch, Fit range)', () => {
  const hexIn = (id: string, concertChord: string): SlotHex => {
    const inst = instrumentOf(id);
    const h = slotHex(slotHarmony({ chord: writtenChord(concertChord, inst) }), hexRange(inst));
    if (!h) throw new Error('no hex');
    return h;
  };
  const top = (hex: SlotHex) => row(hex, 3)[row(hex, 3).length - 1];

  it('trombone E2–B♭4 over Dm7: 18 steps → 10·11·11·12, anchor E2, top cell A4, all in range', () => {
    const hex = hexIn('trombone', 'Dm7');
    expect(hex.stepsInRange).toBe(18);
    expect(hex.rowLengths).toEqual([10, 11, 11, 12]);
    expect(hex.anchor).toBe(40);
    expect(top(hex).midi).toBe(69);
    expect(hex.cells.every((c) => c.inRange)).toBe(true);
  });

  it('violin G3–E7 over Dm7: 27 steps → 19·20·20·21, anchor G3, top cell E7', () => {
    const hex = hexIn('violin', 'Dm7');
    expect(hex.stepsInRange).toBe(27);
    expect(hex.rowLengths).toEqual([19, 20, 20, 21]);
    expect(hex.anchor).toBe(55);
    expect(top(hex).midi).toBe(100);
  });

  it('B♭ tenor sax over Dm7 shows written Em7 (E Dorian): B♭3–F♯6 → 19 steps, anchor B3, names up a M9', () => {
    const hex = hexIn('bb-tenor-sax', 'Dm7');
    expect(hex.stepsInRange).toBe(19);
    expect(hex.rowLengths).toEqual([11, 12, 12, 13]);
    expect(hex.anchor).toBe(59);
    expect(top(hex).midi).toBe(90);
    expect(row(hex, 0).slice(0, 7).map((c) => `${c.name}${c.degree}${c.role[0]}`)).toEqual([
      'B5c', 'C#6s', 'D7c', 'E1c', 'F#2s', 'G3c', 'A4s',
    ]);
  });

  it('degrees for G7 / Cmaj7 / G7alt are the same in every view (interval from the root → degree)', () => {
    const pcOf = (n: string) => ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[n[0]]! + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0);
    const map = (hex: SlotHex, root: string) =>
      [...new Set(hex.cells.map((c) => `${(((c.midi - pcOf(root)) % 12) + 12) % 12}:${c.degree}`))].sort();
    for (const id of ['trombone', 'violin', 'bb-tenor-sax']) {
      const inst = instrumentOf(id);
      for (const c of ['G7', 'Cmaj7', 'G7alt']) {
        const w = writtenChord(c, inst);
        expect(map(hexIn(id, c), w.match(/^[A-G][#b]?/)![0])).toEqual(map(hexFor(c), c.match(/^[A-G][#b]?/)![0]));
      }
    }
  });

  it('ii–V–I anchor stability in each view', () => {
    for (const id of ['trombone', 'violin', 'bb-tenor-sax']) {
      const [ii, V, I] = ['Dm7', 'G7', 'Cmaj7'].map((c) => hexIn(id, c));
      expect(V.anchor).toBe(ii.anchor);
      expect(I.anchor).toBe(ii.anchor);
      expect(V.cells.map((c) => c.midi)).toEqual(ii.cells.map((c) => c.midi));
    }
  });

  it('a tiny range leaves grey out-of-range cells (shown, inactive)', () => {
    const hex = slotHex(slotHarmony({ chord: 'C' }), { lo: 60, hi: 67, limited: true })!;
    expect(hex.rowLengths).toEqual([2, 3, 3, 4]);
    expect(hex.cells.some((c) => !c.inRange)).toBe(true);
  });
});

describe('test table 6: §8.4 slots without a scale', () => {
  const hs = (...chords: string[]) => chords.map((chord) => slotHarmony({ chord }));
  const pitches = (hex: SlotHex) => hex.cells.map((c) => c.midi);

  it('N.C. after a scaled slot: that slot\'s layout, rests only', () => {
    const d = dockHex(hs('Dm7', 'G7', 'N.C.'), 2);
    expect(d.mode).toBe('rests-only');
    expect(d.label).toBe('N.C. — rests only');
    expect(d.labelEditsChord).toBe(false);
    expect(pitches(d.hex)).toEqual(pitches(hexFor('G7')));
    expect(d.hex.cells.find((c) => c.name === 'G')!.degree).toBe(1); // G Mixolydian rings
  });

  it('N.C. before any scaled slot: the next scaled slot\'s layout', () => {
    const d = dockHex(hs('N.C.', 'N.C.', 'Bbm7'), 0);
    expect(pitches(d.hex)).toEqual(pitches(hexFor('Bbm7')));
  });

  it('skips no-fit and unscaled slots when looking for a layout', () => {
    const d = dockHex(hs('Dm7', 'C7sus4b9', '', 'N.C.'), 3);
    expect(pitches(d.hex)).toEqual(pitches(hexFor('Dm7')));
  });

  it('no scaled slot anywhere (form start): C major', () => {
    const d = dockHex(hs('N.C.', ''), 0);
    expect(pitches(d.hex)).toEqual(pitches(hexFor('C')));
  });

  it('empty and unparseable slots: their labels, which edit the chord', () => {
    expect(dockHex(hs('Dm7', ''), 1)).toMatchObject({ mode: 'rests-only', label: 'No chord yet: type one to enter notes', labelEditsChord: true });
    expect(dockHex(hs('Dm7', 'Hm7'), 1)).toMatchObject({ label: 'Chord not recognised: fix the symbol to enter notes', labelEditsChord: true });
  });

  it('a no-fit chord (C7sus4b9) shows the chord-tones hex: each cell the next chord tone, all white', () => {
    const d = dockHex(hs('C7sus4b9'), 0);
    expect(d.mode).toBe('chord-tones');
    expect(d.label).toBe('No scale fits: chord tones only');
    const row0 = d.hex.cells.filter((c) => c.r === 0);
    expect(row0.slice(0, 5).map((c) => c.name)).toEqual(['C', 'Db', 'F', 'G', 'Bb']);
    expect(row0.slice(0, 5).map((c) => c.degree)).toEqual([1, 2, 4, 5, 7]);
    expect(d.hex.cells.every((c) => c.role === 'chord')).toBe(true);
    expect(d.hex.anchor).toBe(48); // C3, lowest in-range chord tone
    for (const c of d.hex.cells) expect(c.step).toBe(c.c + 2 * c.r);
  });

  it('an ordinary scaled slot: no label', () => {
    expect(dockHex(hs('Dm7'), 0)).toMatchObject({ mode: 'scale', label: null });
  });
});

describe('triad tones (always coloured)', () => {
  const triadNames = (chord: string) => [...new Set(hexFor(chord).cells.filter((c) => c.triad).map((c) => c.name))].sort();
  it('root, 3rd and 5th; 7ths, extensions and scale tones are not', () => {
    expect(triadNames('Dm7')).toEqual(['A', 'D', 'F']);
    expect(triadNames('G13')).toEqual(['B', 'D', 'G']);
    expect(triadNames('Cmaj7')).toEqual(['C', 'E', 'G']);
  });
  it('altered 5ths count; a sus 2nd / 4th stands in for the missing 3rd', () => {
    expect(triadNames('Bm7b5')).toEqual(['B', 'D', 'F']);
    expect(triadNames('G7alt')).toEqual(['B', 'D#', 'G']);
    expect(triadNames('Csus4')).toEqual(['C', 'F', 'G']);
  });
  it('a slash bass is not a triad tone', () => {
    expect(triadNames('C/D')).toEqual(['C', 'E', 'G']);
  });
});
