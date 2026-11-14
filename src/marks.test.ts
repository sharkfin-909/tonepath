import { describe, expect, it } from 'vitest';
import { slotHarmony } from './harmony';
import { instrumentOf } from './instruments';
import { noteMark } from './marks';

const concert = instrumentOf('concert');
const trumpet = instrumentOf('bb-trumpet'); // written F♯3–C6 = 54–84
const mark = (midi: number, chord: string, inst = concert, scale?: string) =>
  noteMark(midi, slotHarmony({ chord, ...(scale ? { scale } : {}) }), chord, inst);

describe('note marks', () => {
  it('in scale, in range: unmarked', () => {
    expect(mark(62, 'Dm7')).toEqual({ outOfScale: false, range: null, reason: null });
  });

  it('out of scale after a chord edit: F# under Dm7', () => {
    expect(mark(66, 'Dm7')).toEqual({ outOfScale: true, range: null, reason: 'not in D Dorian' });
    expect(mark(68, 'G7alt').reason).toBe(null); // A♭ is in G altered
    expect(mark(67, 'G7alt').reason).toBe(null); // G root
    expect(mark(69, 'G7alt').reason).toBe('not in G Altered');
  });

  it('respects the scale override', () => {
    expect(mark(71, 'Dm7', concert, 'aeolian').reason).toBe('not in D Aeolian');
  });

  it('no-fit chord: only its own tones are in', () => {
    expect(mark(61, 'C7sus4b9').outOfScale).toBe(false);
    expect(mark(62, 'C7sus4b9').reason).toBe('not a chord tone of C7sus4♭9');
  });

  it('slots without a chord check nothing: no out-of-scale mark', () => {
    for (const chord of ['N.C.', '', 'Hm7']) expect(mark(61, chord)).toMatchObject({ outOfScale: false, reason: null });
  });

  it('out of range in written pitch; Concert never', () => {
    expect(mark(86, 'C', trumpet)).toMatchObject({ outOfScale: false, range: 'above', reason: 'above B♭ trumpet range' });
    expect(mark(53, 'F', trumpet).reason).toBe('below B♭ trumpet range');
    expect(mark(20, 'C').range).toBe(null);
  });

  it('both: both reasons', () => {
    expect(mark(85, 'Cmaj7', trumpet).reason).toBe('not in C Ionian · above B♭ trumpet range');
  });
});
