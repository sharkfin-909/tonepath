// Test table 2 (SPEC §14.2): default scale — the worked list plus one row per family — and
// override validity, the scale override setter and classification.
import { describe, expect, it } from 'vitest';
import { RANKED, SCALES, classify, familyOf, scaleLabel, slotHarmony, withValidOverride, type ScaleId } from './harmony';
import { parseChord } from './chords';
import { commitChordText, newProgression, setChord, setScaleOverride, type Progression } from './progression';

const harmony = (chord: string, scale?: string) => slotHarmony({ chord, ...(scale ? { scale } : {}) });
const defaultScale = (chord: string) => {
  const h = harmony(chord);
  return h.kind === 'chord' ? h.scale : 'none';
};
const family = (chord: string) => {
  const c = parseChord(chord);
  return c.kind === 'chord' ? familyOf(c.intervals) : null;
};

describe('test table 2: default scale — worked list', () => {
  it.each<[string, ScaleId]>([
    ['C7b9', 'half-whole-diminished'],
    ['C7#9', 'half-whole-diminished'],
    ['C7#11', 'lydian-dominant'],
    ['C7#5', 'whole-tone'],
    ['C7b13', 'mixolydian-b6'],
    ['C7b9b13', 'phrygian-dominant'],
    ['C7alt', 'altered'],
    ['C7#9b13', 'altered'],
    ['Cmaj7#11', 'lydian'],
    ['Cm(maj7)', 'melodic-minor'],
  ])('%s → %s', (chord, scale) => expect(defaultScale(chord)).toBe(scale));
});

describe('test table 2: default scale — one row per family', () => {
  it.each<[string, string, ScaleId | null]>([
    ['Cmaj7', 'major', 'ionian'],
    ['C', 'major', 'ionian'],
    ['C6/9', 'major', 'ionian'],
    ['C5', 'major', 'ionian'],
    ['Cmaj7#5', 'major', 'lydian-augmented'],
    ['G7', 'dominant', 'mixolydian'],
    ['G13', 'dominant', 'mixolydian'],
    ['G7b5', 'dominant', 'lydian-dominant'],
    ['G7sus4', 'sus', 'mixolydian'],
    ['Csus2', 'sus', 'mixolydian'],
    ['C11', 'sus', 'mixolydian'],
    ['Cmaj11', 'sus', 'ionian'],
    ['Dm7', 'minor', 'dorian'],
    ['Dm7b13', 'minor', 'aeolian'],
    ['Dm7b9', 'minor', 'phrygian'],
    ['Dm6', 'minor', 'dorian'],
    ['Cm(maj7)b13', 'minor', 'harmonic-minor'],
    ['Bm7b5', 'half-diminished', 'locrian'],
    ['Bm9b5', 'half-diminished', 'locrian-nat2'],
    ['Cdim7', 'diminished', 'whole-half-diminished'],
    ['Cdim', 'diminished', 'whole-half-diminished'],
    ['Caug', 'augmented', 'whole-tone'],
    ['Caug(add9)', 'augmented', 'whole-tone'],
    ['C7sus4b9', 'sus', null],
  ])('%s is %s → %s', (chord, fam, scale) => {
    expect(family(chord)).toBe(fam);
    expect(defaultScale(chord)).toBe(scale);
  });
});

describe('slotHarmony', () => {
  it('empty, unparseable and N.C. slots have no harmony', () => {
    expect(harmony('')).toEqual({ kind: 'none', reason: 'empty' });
    expect(harmony('C4')).toEqual({ kind: 'none', reason: 'invalid' });
    expect(harmony('N.C.')).toEqual({ kind: 'none', reason: 'nc' });
  });

  it('candidates are the family list filtered to scales holding every chord tone', () => {
    const h = harmony('G7');
    expect(h.kind === 'chord' && h.candidates).toEqual(['mixolydian', 'lydian-dominant', 'mixolydian-b6', 'half-whole-diminished', 'phrygian-dominant']);
    const alt = harmony('G7alt');
    expect(alt.kind === 'chord' && alt.candidates).toEqual(['altered']);
  });

  it('a slash bass is a chord tone but not part of the fit', () => {
    const h = harmony('C/Bb');
    expect(h.kind === 'chord' && h.scale).toBe('ionian');
    expect(h.kind === 'chord' && [...h.chordTones].sort((a, b) => a - b)).toEqual([0, 4, 7, 10]);
  });

  it('a valid override replaces the default and is flagged', () => {
    const h = harmony('Dm7', 'aeolian');
    expect(h.kind === 'chord' && [h.scale, h.overridden]).toEqual(['aeolian', true]);
  });

  it('an override that is not a candidate (or not a scale id) is ignored', () => {
    for (const bad of ['locrian', 'bogus']) {
      const h = harmony('Dm7', bad);
      expect(h.kind === 'chord' && [h.scale, h.overridden]).toEqual(['dorian', false]);
    }
  });

  it('every ranked id is a known scale', () => {
    for (const ids of Object.values(RANKED)) for (const id of ids) expect(SCALES[id]).toBeDefined();
    expect(Object.keys(SCALES)).toHaveLength(18);
  });

  it('labels a scale on its root', () => expect(scaleLabel('Bb', 'mixolydian-b6')).toBe('Bb Mixolydian ♭6'));
});

describe('override across chord changes', () => {
  it('withValidOverride keeps a still-valid override and drops an invalid one', () => {
    expect(withValidOverride({ chord: 'Em7', scale: 'aeolian' })).toEqual({ chord: 'Em7', scale: 'aeolian' });
    expect(withValidOverride({ chord: 'E7', scale: 'aeolian' })).toEqual({ chord: 'E7' });
    expect(withValidOverride({ chord: 'N.C.', scale: 'aeolian' })).toEqual({ chord: 'N.C.' });
  });

  it('setChord: root-only change keeps the override; a family change drops it', () => {
    const p: Progression = { ...newProgression(), bars: [[{ chord: 'Dm7', scale: 'phrygian' }]] };
    expect(setChord(p, 0, 0, 'Em7').bars[0][0]).toEqual({ chord: 'Em7', scale: 'phrygian' });
    expect(setChord(p, 0, 0, 'Dm7b5').bars[0][0]).toEqual({ chord: 'Dm7b5' });
  });

  it('commitChordText applies the same rule', () => {
    const p: Progression = { ...newProgression(), bars: [[{ chord: 'G7b9', scale: 'phrygian-dominant' }]] };
    const r = commitChordText(p, 0, 0, 'G7b13');
    expect(r.ok && r.progression.bars[0][0]).toEqual({ chord: 'G7b13', scale: 'phrygian-dominant' });
    const r2 = commitChordText(p, 0, 0, 'G7#11');
    expect(r2.ok && r2.progression.bars[0][0]).toEqual({ chord: 'G7#11' });
  });
});

describe('setScaleOverride', () => {
  const p: Progression = { ...newProgression(), bars: [[{ chord: 'Dm7' }]] };

  it('stores a candidate', () => expect(setScaleOverride(p, 0, 0, 'aeolian').bars[0][0]).toEqual({ chord: 'Dm7', scale: 'aeolian' }));

  it('picking the default or null clears the override', () => {
    const o = setScaleOverride(p, 0, 0, 'aeolian');
    expect(setScaleOverride(o, 0, 0, 'dorian').bars[0][0]).toEqual({ chord: 'Dm7' });
    expect(setScaleOverride(o, 0, 0, null).bars[0][0]).toEqual({ chord: 'Dm7' });
  });

  it('ignores a non-candidate, a no-chord slot, and no-op picks', () => {
    expect(setScaleOverride(p, 0, 0, 'locrian')).toBe(p);
    expect(setScaleOverride(p, 0, 0, 'dorian')).toBe(p);
    const nc: Progression = { ...p, bars: [[{ chord: 'N.C.' }]] };
    expect(setScaleOverride(nc, 0, 0, 'dorian')).toBe(nc);
  });
});

describe('classify: chord tone > scale tone > chromatic', () => {
  const dm7 = harmony('Dm7');
  it.each<[number, string]>([
    [62, 'chord'], // D4
    [65, 'chord'], // F4
    [69 + 12, 'chord'], // A5: octave doesn't matter
    [72, 'chord'], // C5
    [64, 'scale'], // E4
    [71, 'scale'], // B4 (Dorian ♮6)
    [70, 'chromatic'], // Bb4
    [66, 'chromatic'], // F#4
  ])('Dm7 (Dorian): %i is a %s tone', (midi, role) => expect(classify(midi, dm7)).toBe(role));

  it('follows the override', () => expect(classify(70, harmony('Dm7', 'aeolian'))).toBe('scale'));

  it('a slash bass outside the scale is still a chord tone', () => {
    expect(classify(70, harmony('C/Bb'))).toBe('chord');
  });

  it('a chord tone wins even when no scale fits; the rest is chromatic', () => {
    const h = harmony('C7sus4b9');
    expect(classify(61, h)).toBe('chord');
    expect(classify(62, h)).toBe('chromatic');
  });

  it('slots without a chord classify everything as chromatic', () => {
    expect(classify(60, harmony('N.C.'))).toBe('chromatic');
    expect(classify(60, harmony(''))).toBe('chromatic');
  });
});
